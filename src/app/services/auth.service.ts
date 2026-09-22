import { Injectable, Inject, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, filter, finalize, map, shareReplay, switchMap, take, tap } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  date: string;
}

export interface QuizResult {
  score: number;
  totalQuestions: number;
  percentage: number;
  timestamp: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  /** Parent/client accounts use `user`; staff roles preserved for routing. */
  role?: 'user' | 'admin' | 'coach';
  /** False until an admin approves a self-registered parent. Login stays allowed. */
  isApproved?: boolean;
  /** True after an admin sets a temporary password. The account must replace it before anything else. */
  mustChangePassword?: boolean;
  emailVerified?: boolean;
  /** Server flag Features:EmailVerificationRequired. */
  emailVerificationRequired?: boolean;
  clientStatus?: 'New' | 'Returning' | string;
  /** Present when loaded from admin API (optional elsewhere). */
  phone?: string;
  username?: string;
  children: Child[];
  quizResults: QuizResult[];
}

export interface AuthApiResponse {
  id: number;
  email: string;
  fullName: string;
  role: string;
}

export interface Child {
  id: string;
  name: string;
  age: number;
  level: number;
  /** True when this profile is the logged-in account holder (not a child). */
  isAccountHolder?: boolean;
  profilePicture?: string;
  skillLevels?: { level: number; completionPercent: number; skills: { name: string; isUnlocked: boolean }[] }[];
  progress: ProgressEntry[];
}

export interface ProgressEntry {
  date: string;
  level: number;
  notes: string;
  skills: string[];
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private static readonly LEGACY_USER_KEY = 'swimxpert_user';
  private static readonly LEGACY_LEVEL_KEY = 'lf_pending_result';

  currentUser = signal<User | null>(null);
  /** One in-flight /me hydration so refresh and route guards share a single request. */
  private hydration$: Observable<boolean> | null = null;

  constructor(
    private router: Router,
    private apiService: ApiService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    // Avoid auth HTTP during SSR/prerender (Node has no browser APIs).
    if (isPlatformBrowser(this.platformId)) {
      this.clearLegacyStorage();
      const shellHidden = document.documentElement.classList.contains('sx-booting');
      if (!shellHidden) {
        this.hydrate().subscribe();
        return;
      }
      const navigationDone$ = this.router.navigated
        ? of(true)
        : this.router.events.pipe(
            filter((event): event is NavigationEnd => event instanceof NavigationEnd),
            take(1),
            map(() => true)
          );
      forkJoin([this.hydrate(), navigationDone$]).subscribe(() => this.revealShell());
    }
  }

  login(identifier: string, password: string): Observable<AuthApiResponse> {
    return this.apiService.login(identifier, password).pipe(
      tap((response: AuthApiResponse) => this.persistAuthResponse(response)),
      switchMap((response) => this.fetchMe().pipe(map(() => response)))
    );
  }

  register(email: string, password: string, fullName: string, phone?: string, birthDate?: string, phoneRegion?: string): Observable<AuthApiResponse> {
    return this.apiService.register(email, password, fullName, phone, birthDate, phoneRegion).pipe(
      tap((response: AuthApiResponse) => this.persistAuthResponse(response)),
      switchMap((response) => this.fetchMe().pipe(map(() => response)))
    );
  }

  signup(email: string, password: string, name: string, phone: string, phoneRegion = 'LB'): Observable<AuthApiResponse> {
    return this.register(email, password, name, phone, undefined, phoneRegion);
  }

  fetchMe(): Observable<boolean> {
    return this.apiService.getMe().pipe(
      tap((me) => {
        if (!me) {
          this.clearAuthState(false);
          return;
        }
        this.currentUser.set(this.meToUser(me));
      }),
      switchMap((me) => {
        if (!me) return of(false);
        return forkJoin([
          this.syncChildrenFromApi().pipe(catchError(() => of(void 0))),
          this.syncQuizResultsFromApi().pipe(catchError(() => of(void 0)))
        ]).pipe(map(() => true));
      }),
      catchError(() => {
        this.clearAuthState(false);
        return of(false);
      })
    );
  }

  validateToken(): Observable<boolean> {
    return this.apiService.getMe().pipe(
      map((me) => {
        if (!me) {
          this.clearAuthState(false);
          return false;
        }
        this.currentUser.set(this.meToUser(me));
        return true;
      }),
      catchError(() => {
        this.clearAuthState(false);
        return of(false);
      })
    );
  }

  private static normalizeUiRole(apiRole: string | undefined): 'admin' | 'coach' | 'user' {
    const r = (apiRole ?? 'Parent').toLowerCase();
    if (r === 'admin') return 'admin';
    if (r === 'coach') return 'coach';
    return 'user';
  }

  private meToUser(me: {
    id: number;
    email: string;
    fullName: string;
    role: string;
    isApproved?: boolean;
    emailVerified?: boolean;
    emailVerificationRequired?: boolean;
    clientStatus?: string;
    mustChangePassword?: boolean;
  }): User {
    const role = AuthService.normalizeUiRole(me.role);
    const name = me.fullName || me.email?.split('@')?.[0] || 'User';
    return {
      id: String(me.id),
      email: me.email ?? '',
      name,
      avatar: this.generateAvatar(name),
      role,
      isApproved: me.isApproved ?? true,
      emailVerified: me.emailVerified ?? false,
      emailVerificationRequired: me.emailVerificationRequired === true,
      mustChangePassword: me.mustChangePassword === true,
      clientStatus: me.clientStatus ?? 'New',
      children: this.currentUser()?.children ?? [],
      quizResults: this.currentUser()?.quizResults ?? []
    };
  }

  isAdmin(): boolean {
    const user = this.currentUser();
    return user?.role?.toLowerCase() === 'admin';
  }

  isCoach(): boolean {
    const user = this.currentUser();
    return user?.role?.toLowerCase() === 'coach';
  }

  /** Authenticated parent/client (approval no longer required for nav / dashboard). */
  isApprovedClient(): boolean {
    const user = this.currentUser();
    return !!user && !this.isAdmin() && !this.isCoach();
  }

  needsEmailVerification(): boolean {
    const user = this.currentUser();
    return !!user && !this.isAdmin() && !this.isCoach()
      && user.emailVerificationRequired === true
      && user.emailVerified === false;
  }

  needsAccountApproval(): boolean {
    const user = this.currentUser();
    return !!user && !this.isAdmin() && !this.isCoach() && user.isApproved === false;
  }

  getAllClients(): User[] {
    return [];
  }

  logout(): void {
    this.apiService.logout().subscribe({
      next: () => this.clearAuthState(true),
      error: () => this.clearAuthState(true)
    });
  }

  /** Drops the boot screen after the first session check and the first navigation. */
  private revealShell(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    document.documentElement.classList.remove('sx-booting');
    document.getElementById('sx-boot')?.remove();
  }

  /**
   * Loads the session from GET /api/auth/me. The user, including children, is kept
   * in memory only. A refresh shares this request with route guards.
   */
  hydrate(): Observable<boolean> {
    if (this.currentUser()) return of(true);
    if (!this.hydration$) {
      this.hydration$ = this.fetchMe().pipe(
        finalize(() => { this.hydration$ = null; }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
    }
    return this.hydration$;
  }

  isAuthenticated(): Observable<boolean> {
    return this.hydrate();
  }

  isAuthenticatedSync(): boolean {
    return this.currentUser() !== null;
  }

  getCurrentUser(): User | null {
    return this.currentUser();
  }

  persistAuthResponseFromMe(response: AuthApiResponse): void {
    this.persistAuthResponse(response);
  }

  private persistAuthResponse(response: AuthApiResponse): void {
    const role = AuthService.normalizeUiRole(response?.role);
    const name = response?.fullName || response?.email?.split('@')?.[0] || 'User';
    const user: User = {
      id: String(response?.id ?? ''),
      email: response?.email ?? '',
      name,
      avatar: this.generateAvatar(name),
      role,
      children: [],
      quizResults: []
    };
    this.currentUser.set(user);
  }

  generateAvatar(name: string): string {
    // Generate a colorful avatar based on name
    const colors = [
      '#1890ff', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', 
      '#8b5cf6', '#ec4899', '#06b6d4', '#14b8a6', '#f97316'
    ];
    const initial = name.charAt(0).toUpperCase();
    const colorIndex = name.charCodeAt(0) % colors.length;
    return `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='${colors[colorIndex]}' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='white' font-size='50' font-weight='bold'%3E${initial}%3C/text%3E%3C/svg%3E`;
  }

  updateAvatar(avatarUrl: string): void {
    const user = this.currentUser();
    if (user) {
      user.avatar = avatarUrl;
      this.currentUser.set({ ...user });
    }
  }

  addQuizResult(result: QuizResult): Observable<void> {
    return this.apiService.addQuizResult({
      score: result.score,
      totalQuestions: result.totalQuestions,
      percentage: result.percentage
    }).pipe(
      switchMap(() => this.syncQuizResultsFromApi())
    );
  }

  getAllUsers(): User[] {
    const currentUser = this.currentUser();
    if (currentUser) {
      return [currentUser];
    }
    return [];
  }

  getLeaderboard(): Observable<LeaderboardEntry[]> {
    return this.apiService.getLeaderboard();
  }

  addChild(child: Omit<Child, 'id'>): Observable<Child> {
    const user = this.currentUser();
    if (!user) {
      return of({
        ...child,
        id: ''
      });
    }

    return this.apiService.createSwimmer({
      name: child.name,
      age: child.age,
      level: child.level,
      isAccountHolder: !!child.isAccountHolder,
      profilePictureUrl: child.profilePicture || null
    }).pipe(
      map((created: any) => ({
        id: String(created?.id ?? ''),
        name: created?.name || child.name,
        age: Number(created?.age ?? child.age),
        level: Number(created?.level ?? child.level),
        isAccountHolder: !!created?.isAccountHolder || !!child.isAccountHolder,
        profilePicture: created?.profilePictureUrl || child.profilePicture,
        skillLevels: created?.levels || [],
        progress: []
      } as Child)),
      tap((newChild) => {
        const current = this.currentUser();
        if (!current) return;
        current.children = [...(current.children || []), newChild];
        this.currentUser.set({ ...current });
      })
    );
  }

  updateChild(childId: string, updates: Partial<Child>): void {
    const user = this.currentUser();
    if (user) {
      const childIndex = user.children.findIndex(c => c.id === childId);
      if (childIndex !== -1) {
        user.children[childIndex] = { ...user.children[childIndex], ...updates };
        this.currentUser.set({ ...user });
      }
    }
  }

  updateChildApi(childId: string, updates: { name?: string; age?: number; level?: number; profilePicture?: string | null }): Observable<Child> {
    const id = parseInt(childId, 10);
    if (isNaN(id)) {
      return of({} as Child);
    }
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload['name'] = updates.name;
    if (updates.age !== undefined) payload['age'] = updates.age;
    if (updates.level !== undefined) payload['level'] = updates.level;
    if ('profilePicture' in updates) payload['profilePictureUrl'] = updates.profilePicture ?? null;

    return this.apiService.updateSwimmer(id, payload).pipe(
      map((res: any) => ({
        id: String(res?.id ?? childId),
        name: res?.name ?? updates.name ?? '',
        age: Number(res?.age ?? updates.age ?? 0),
        level: Number(res?.level ?? updates.level ?? 1),
        profilePicture: res?.profilePictureUrl ?? updates.profilePicture,
        skillLevels: res?.levels ?? [],
        progress: []
      } as Child)),
      switchMap((child) => this.syncChildrenFromApi().pipe(map(() => child)))
    );
  }

  addProgressEntry(childId: string, entry: ProgressEntry): Observable<void> {
    const swimmerId = parseInt(childId, 10);
    if (isNaN(swimmerId)) {
      return of(void 0);
    }
    return this.apiService.addProgressEntry(swimmerId, {
      date: entry.date,
      level: entry.level,
      notes: entry.notes,
      skills: entry.skills?.length ? entry.skills : undefined
    }).pipe(
      switchMap(() => this.syncChildrenFromApi())
    );
  }

  private clearLegacyStorage(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    localStorage.removeItem(AuthService.LEGACY_USER_KEY);
    localStorage.removeItem(AuthService.LEGACY_LEVEL_KEY);
  }

  private clearAuthState(redirectToLogin: boolean): void {
    this.clearLegacyStorage();
    this.hydration$ = null;
    this.currentUser.set(null);
    if (redirectToLogin) {
      this.router.navigate(['/login']);
    }
  }

  syncChildrenFromApi(): Observable<void> {
    const user = this.currentUser();
    if (!user) {
      return of(void 0);
    }

    return this.apiService.getMySwimmers().pipe(
      switchMap((swimmers) => {
        const list = swimmers || [];
        if (list.length === 0) {
          return of(list.map((s: any) => ({
            id: String(s.id),
            name: s.name || 'Swimmer',
            age: Number(s.age || 0),
            level: Number(s.level || 1),
            isAccountHolder: !!s.isAccountHolder,
            profilePicture: s.profilePictureUrl || undefined,
            skillLevels: s.levels || [],
            progress: [] as ProgressEntry[]
          })));
        }
        const progressCalls = list.map((s: any) =>
          this.apiService.getSwimmerProgress(s.id).pipe(
            map((entries) => ({
              swimmer: s,
              entries: entries || []
            }))
          )
        );
        return forkJoin(progressCalls).pipe(
          map((results) =>
            results.map(({ swimmer: s, entries }) => ({
              id: String(s.id),
              name: s.name || 'Swimmer',
              age: Number(s.age || 0),
              level: Number(s.level || 1),
              isAccountHolder: !!s.isAccountHolder,
              profilePicture: s.profilePictureUrl || undefined,
              skillLevels: s.levels || [],
              progress: entries.map((e: any) => ({
                date: e.date,
                level: e.level,
                notes: e.notes || '',
                skills: Array.isArray(e.skills) ? e.skills : []
              })) as ProgressEntry[]
            }))
          )
        );
      }),
      tap((mappedChildren) => {
        const current = this.currentUser();
        if (!current) return;
        this.currentUser.set({ ...current, children: mappedChildren });
      }),
      map(() => void 0)
    );
  }

  syncQuizResultsFromApi(): Observable<void> {
    const user = this.currentUser();
    if (!user) {
      return of(void 0);
    }

    return this.apiService.getQuizResults().pipe(
      tap((results) => {
        const quizResults: QuizResult[] = (results || []).map((r: any) => ({
          score: r.score,
          totalQuestions: r.totalQuestions,
          percentage: r.percentage,
          timestamp: r.timestamp ? new Date(r.timestamp) : new Date()
        }));
        const current = this.currentUser();
        if (!current) return;
        this.currentUser.set({ ...current, quizResults });
      }),
      map(() => void 0)
    );
  }
}
