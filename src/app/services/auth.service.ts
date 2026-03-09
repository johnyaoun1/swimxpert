import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';

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
  role?: 'user' | 'admin';
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
  private readonly USER_KEY = 'swimxpert_user';

  currentUser = signal<User | null>(null);

  constructor(
    private router: Router,
    private apiService: ApiService
  ) {
    this.loadUserFromStorage();
    this.fetchMe().subscribe();
  }

  login(email: string, password: string): Observable<AuthApiResponse> {
    return this.apiService.login(email, password).pipe(
      tap((response: AuthApiResponse) => this.persistAuthResponse(response))
    );
  }

  register(email: string, password: string, fullName: string, phone?: string, birthDate?: string): Observable<AuthApiResponse> {
    return this.apiService.register(email, password, fullName, phone, birthDate).pipe(
      tap((response: AuthApiResponse) => this.persistAuthResponse(response))
    );
  }

  signup(email: string, password: string, name: string): Observable<AuthApiResponse> {
    return this.register(email, password, name);
  }

  fetchMe(): Observable<boolean> {
    return this.apiService.getMe().pipe(
      tap((me) => {
        const user = this.meToUser(me);
        this.currentUser.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }),
      switchMap(() =>
        forkJoin([
          this.syncChildrenFromApi().pipe(catchError(() => of(void 0))),
          this.syncQuizResultsFromApi().pipe(catchError(() => of(void 0)))
        ]).pipe(map(() => true))
      ),
      catchError(() => {
        this.clearAuthState(false);
        return of(false);
      })
    );
  }

  validateToken(): Observable<boolean> {
    return this.apiService.getMe().pipe(
      map((me) => {
        const user = this.meToUser(me);
        this.currentUser.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        return true;
      }),
      catchError(() => {
        this.clearAuthState(false);
        return of(false);
      })
    );
  }

  private meToUser(me: { id: number; email: string; fullName: string; role: string }): User {
    const role = (me.role ?? 'Parent').toLowerCase() === 'admin' ? 'admin' : 'user';
    const name = me.fullName || me.email?.split('@')?.[0] || 'User';
    return {
      id: String(me.id),
      email: me.email ?? '',
      name,
      avatar: this.generateAvatar(name),
      role,
      children: this.currentUser()?.children ?? [],
      quizResults: this.currentUser()?.quizResults ?? []
    };
  }

  isAdmin(): boolean {
    const user = this.currentUser();
    return user?.role?.toLowerCase() === 'admin';
  }

  getAllClients(): User[] {
    return [];
  }

  logout(): void {
    this.apiService.logout().subscribe({
      complete: () => this.clearAuthState(true)
    });
  }

  isAuthenticated(): Observable<boolean> {
    return this.apiService.getMe().pipe(
      map((me) => {
        this.currentUser.set(this.meToUser(me));
        localStorage.setItem(this.USER_KEY, JSON.stringify(this.currentUser()));
        return true;
      }),
      catchError(() => of(false))
    );
  }

  isAuthenticatedSync(): boolean {
    return this.currentUser() !== null;
  }

  private loadUserFromStorage(): void {
    const userStr = localStorage.getItem(this.USER_KEY);
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        // Ensure backward compatibility
        if (!user.quizResults) user.quizResults = [];
        if (!user.avatar) user.avatar = this.generateAvatar(user.name);
        this.currentUser.set(user);
      } catch (e) {
        if (!environment.production) { console.error('Error loading user from storage', e); }
      }
    }
  }

  getCurrentUser(): User | null {
    const current = this.currentUser();
    if (current) return current;

    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;

    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }

  persistAuthResponseFromMe(response: AuthApiResponse): void {
    this.persistAuthResponse(response);
  }

  private persistAuthResponse(response: AuthApiResponse): void {
    const role = (response?.role ?? 'Parent').toString().toLowerCase() === 'admin' ? 'admin' : 'user';
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
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
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
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
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
      profilePictureUrl: child.profilePicture || null
    }).pipe(
      map((created: any) => ({
        id: String(created?.id ?? ''),
        name: created?.name || child.name,
        age: Number(created?.age ?? child.age),
        level: Number(created?.level ?? child.level),
        profilePicture: created?.profilePictureUrl || child.profilePicture,
        skillLevels: created?.levels || [],
        progress: []
      } as Child)),
      tap((newChild) => {
        const current = this.currentUser();
        if (!current) return;
        current.children = [...(current.children || []), newChild];
        localStorage.setItem(this.USER_KEY, JSON.stringify(current));
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
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
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

  private clearAuthState(redirectToLogin: boolean): void {
    localStorage.removeItem(this.USER_KEY);
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
        const nextUser: User = { ...user, children: mappedChildren };
        localStorage.setItem(this.USER_KEY, JSON.stringify(nextUser));
        this.currentUser.set(nextUser);
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
        const nextUser: User = { ...user, quizResults };
        localStorage.setItem(this.USER_KEY, JSON.stringify(nextUser));
        this.currentUser.set(nextUser);
      }),
      map(() => void 0)
    );
  }
}
