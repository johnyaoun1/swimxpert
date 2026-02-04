import { Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';

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
  children: Child[];
  quizResults: QuizResult[];
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

  constructor(private router: Router) {
    this.loadUserFromStorage();
  }

  login(email: string, password: string): boolean {
    // Mock authentication - in production, this would call an API
    if (email && password) {
      const user: User = {
        id: '1',
        email,
        name: email.split('@')[0],
        children: [],
        quizResults: []
      };
      
      const token = 'mock_jwt_token_' + Date.now();
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      this.currentUser.set(user);
      return true;
    }
    return false;
  }

  signup(email: string, password: string, name: string): boolean {
    // Mock signup - in production, this would call an API
    if (email && password && name) {
      const user: User = {
        id: Date.now().toString(),
        email,
        name,
        avatar: this.generateAvatar(name),
        children: [],
        quizResults: []
      };
      
      const token = 'mock_jwt_token_' + Date.now();
      localStorage.setItem(this.TOKEN_KEY, token);
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      this.currentUser.set(user);
      return true;
    }
    return false;
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/']);
  }

  isAuthenticated(): boolean {
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
    // For leaderboard - in production, this would come from an API
    // For now, we'll return the current user and some mock users
    const currentUser = this.currentUser();
    const mockUsers: User[] = [
      {
        id: '2',
        email: 'alex@example.com',
        name: 'Alex',
        avatar: this.generateAvatar('Alex'),
        children: [],
        quizResults: [{ score: 9, totalQuestions: 10, percentage: 90, timestamp: new Date() }]
      },
      {
        id: '3',
        email: 'sarah@example.com',
        name: 'Sarah',
        avatar: this.generateAvatar('Sarah'),
        children: [],
        quizResults: [{ score: 8, totalQuestions: 10, percentage: 80, timestamp: new Date() }]
      },
      {
        id: '4',
        email: 'mike@example.com',
        name: 'Mike',
        avatar: this.generateAvatar('Mike'),
        children: [],
        quizResults: [{ score: 10, totalQuestions: 10, percentage: 100, timestamp: new Date() }]
      }
    ];
    
    if (currentUser) {
      return [currentUser, ...mockUsers];
    }
    return mockUsers;
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
}
