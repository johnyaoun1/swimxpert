import { Injectable, signal } from '@angular/core';

export type SessionStatus = 'scheduled' | 'completed' | 'canceled';

export interface Session {
  id: string;
  childId: string;
  childName: string;
  clientId: string;
  clientName: string;
  date: string;
  time: string;
  level: number;
  status: SessionStatus;
  instructor?: string;
  notes?: string;
  price: number;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly SESSIONS_KEY = 'swimxpert_sessions';
  sessions = signal<Session[]>([]);

  constructor() {
    this.loadSessions();
    // Initialize with some mock data if empty
    if (this.sessions().length === 0) {
      this.initializeMockData();
    }
  }

  private loadSessions(): void {
    const sessionsStr = localStorage.getItem(this.SESSIONS_KEY);
    if (sessionsStr) {
      try {
        this.sessions.set(JSON.parse(sessionsStr));
      } catch (e) {
        console.error('Error loading sessions', e);
        this.sessions.set([]);
      }
    }
  }

  private saveSessions(): void {
    localStorage.setItem(this.SESSIONS_KEY, JSON.stringify(this.sessions()));
  }

  private initializeMockData(): void {
    const mockSessions: Session[] = [
      {
        id: '1',
        childId: '1',
        childName: 'Emma',
        clientId: '2',
        clientName: 'Alex',
        date: new Date().toISOString().split('T')[0],
        time: '10:00',
        level: 2,
        status: 'completed',
        instructor: 'John Smith',
        price: 50,
        createdAt: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: '2',
        childId: '1',
        childName: 'Emma',
        clientId: '2',
        clientName: 'Alex',
        date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        time: '10:00',
        level: 2,
        status: 'scheduled',
        instructor: 'John Smith',
        price: 50,
        createdAt: new Date().toISOString()
      },
      {
        id: '3',
        childId: '3',
        childName: 'Olivia',
        clientId: '3',
        clientName: 'Sarah',
        date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
        time: '14:00',
        level: 2,
        status: 'canceled',
        instructor: 'Jane Doe',
        price: 50,
        createdAt: new Date(Date.now() - 259200000).toISOString()
      },
      {
        id: '4',
        childId: '4',
        childName: 'Noah',
        clientId: '4',
        clientName: 'Mike',
        date: new Date().toISOString().split('T')[0],
        time: '16:00',
        level: 4,
        status: 'scheduled',
        instructor: 'John Smith',
        price: 60,
        createdAt: new Date(Date.now() - 43200000).toISOString()
      }
    ];
    this.sessions.set(mockSessions);
    this.saveSessions();
  }

  createSession(session: Omit<Session, 'id' | 'createdAt'>): Session {
    const newSession: Session = {
      ...session,
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    this.sessions.update(sessions => [...sessions, newSession]);
    this.saveSessions();
    return newSession;
  }

  updateSession(sessionId: string, updates: Partial<Session>): void {
    this.sessions.update(sessions =>
      sessions.map(s => s.id === sessionId ? { ...s, ...updates } : s)
    );
    this.saveSessions();
  }

  deleteSession(sessionId: string): void {
    this.sessions.update(sessions => sessions.filter(s => s.id !== sessionId));
    this.saveSessions();
  }

  getSessionsByClient(clientId: string): Session[] {
    return this.sessions().filter(s => s.clientId === clientId);
  }

  getSessionsByChild(childId: string): Session[] {
    return this.sessions().filter(s => s.childId === childId);
  }

  getSessionsByStatus(status: SessionStatus): Session[] {
    return this.sessions().filter(s => s.status === status);
  }

  getSessionsByDateRange(startDate: string, endDate: string): Session[] {
    return this.sessions().filter(s => {
      const sessionDate = new Date(s.date);
      const start = new Date(startDate);
      const end = new Date(endDate);
      return sessionDate >= start && sessionDate <= end;
    });
  }

  getCompletedSessionsCount(): number {
    return this.sessions().filter(s => s.status === 'completed').length;
  }

  getCanceledSessionsCount(): number {
    return this.sessions().filter(s => s.status === 'canceled').length;
  }

  getScheduledSessionsCount(): number {
    return this.sessions().filter(s => s.status === 'scheduled').length;
  }
}
