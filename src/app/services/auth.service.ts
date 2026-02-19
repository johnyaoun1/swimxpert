import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { ApiService } from './api.service';

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
  token: string;
}

export interface Child {
  id: string;
  name: string;
  age: number;
  level: number;
  profilePicture?: string;
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
  private readonly TOKEN_KEY = 'swimxpert_token';
  private readonly USER_KEY = 'swimxpert_user';
  
  currentUser = signal<User | null>(null);

  constructor(
    private router: Router,
    private apiService: ApiService
  ) {
    this.loadUserFromStorage();
    this.validateToken().subscribe();
  }

  login(email: string, password: string): Observable<AuthApiResponse> {
    return this.apiService.login(email, password).pipe(
      tap((response: AuthApiResponse) => {
        this.persistAuthResponse(response);
      })
    );
  }

  register(email: string, password: string, fullName: string, phone?: string, birthDate?: string): Observable<AuthApiResponse> {
    return this.apiService.register(email, password, fullName, phone, birthDate).pipe(
      tap((response: AuthApiResponse) => {
        this.persistAuthResponse(response);
      })
    );
  }

  signup(email: string, password: string, name: string): Observable<AuthApiResponse> {
    return this.register(email, password, name);
  }

  validateToken(): Observable<boolean> {
    if (!this.getToken()) {
      this.clearAuthState(false);
      return of(false);
    }

    return this.apiService.validateToken().pipe(
      map(() => true),
      catchError(() => {
        this.clearAuthState(false);
        return of(false);
      })
    );
  }

  isAdmin(): boolean {
    const user = this.currentUser();
    return user?.role?.toLowerCase() === 'admin';
  }

  getAllClients(): User[] {
    const allUsers: User[] = [];
    const keys = Object.keys(localStorage);
    
    keys.forEach(key => {
      if (key.startsWith('swimxpert_user_') || key === 'swimxpert_user') {
        try {
          const userData = JSON.parse(localStorage.getItem(key) || '{}');
          if (userData.role !== 'admin') {
            allUsers.push(userData);
          }
        } catch (e) {
          console.error('Error parsing user data', e);
        }
      }
    });
    
    return allUsers;
  }

  logout(): void {
    this.clearAuthState(true);
  }

  isAuthenticated(): Observable<boolean> {
    if (!this.getToken()) {
      return of(false);
    }

    return this.validateToken();
  }

  isAuthenticatedSync(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
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
        console.error('Error loading user from storage', e);
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

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private persistAuthResponse(response: any): void {
    const role = (response?.role ?? 'Parent').toString().toLowerCase() === 'admin' ? 'admin' : 'user';
    const name = response?.fullName || response?.name || response?.email?.split('@')?.[0] || 'User';

    const user: User = {
      id: String(response?.id ?? ''),
      email: response?.email ?? '',
      name,
      avatar: this.generateAvatar(name),
      role,
      children: [],
      quizResults: []
    };

    const token = response?.token ?? '';
    localStorage.setItem(this.TOKEN_KEY, token);
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

  addQuizResult(result: QuizResult): void {
    const user = this.currentUser();
    if (user) {
      if (!user.quizResults) user.quizResults = [];
      user.quizResults.push(result);
      // Keep only top 10 results
      user.quizResults.sort((a, b) => b.percentage - a.percentage);
      user.quizResults = user.quizResults.slice(0, 10);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      this.currentUser.set({ ...user });
    }
  }

  getAllUsers(): User[] {
    const currentUser = this.currentUser();
    if (currentUser) {
      return [currentUser];
    }
    return [];
  }

  addChild(child: Omit<Child, 'id'>): void {
    const user = this.currentUser();
    if (user) {
      const newChild: Child = {
        ...child,
        id: Date.now().toString()
      };
      user.children.push(newChild);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      this.currentUser.set({ ...user });
    }
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

  addProgressEntry(childId: string, entry: ProgressEntry): void {
    const user = this.currentUser();
    if (user) {
      const child = user.children.find(c => c.id === childId);
      if (child) {
        child.progress.push(entry);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.currentUser.set({ ...user });
      }
    }
  }

  private clearAuthState(redirectToLogin: boolean): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    if (redirectToLogin) {
      this.router.navigate(['/login']);
    }
  }
}
