import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

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

interface ApiSession {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  capacity: number;
  status: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly baseUrl = environment.apiUrl;
  private readonly apiUrl = `${this.baseUrl}/sessions`;
  sessions = signal<Session[]>([]);

  constructor(private http: HttpClient) {
    this.getSessions().subscribe();
  }

  getSessions(filters?: { status?: string; from?: string; to?: string }): Observable<Session[]> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', this.toApiStatus(filters.status));
    if (filters?.from) params = params.set('from', filters.from);
    if (filters?.to) params = params.set('to', filters.to);

    return this.http.get<ApiSession[]>(this.apiUrl, { params }).pipe(
      map((sessions) => sessions.map((s) => this.fromApiSession(s))),
      tap((sessions) => this.sessions.set(sessions))
    );
  }

  getUpcomingSessions(): Observable<Session[]> {
    return this.http.get<ApiSession[]>(`${this.apiUrl}/upcoming`).pipe(
      map((sessions) => sessions.map((s) => this.fromApiSession(s))),
      tap((sessions) => this.sessions.set(sessions))
    );
  }

  getSessionById(id: string | number): Observable<Session> {
    return this.http.get<ApiSession>(`${this.apiUrl}/${id}`).pipe(
      map((session) => this.fromApiSession(session))
    );
  }

  createSession(session: Omit<Session, 'id' | 'createdAt'>): Observable<Session> {
    const payload = {
      title: session.childName ? `${session.childName} Session` : 'Training Session',
      startTime: this.toIsoDateTime(session.date, session.time),
      endTime: this.toIsoDateTime(session.date, session.time, 60),
      capacity: 10,
      status: this.toApiStatus(session.status)
    };

    return this.http.post<ApiSession>(this.apiUrl, payload).pipe(
      map((created) => this.fromApiSession(created, session)),
      tap((created) => this.sessions.update((sessions) => [...sessions, created]))
    );
  }

  updateSession(sessionId: string, updates: Partial<Session>): Observable<Session> {
    return this.getSessionById(sessionId).pipe(
      switchMap((existing) => {
        const merged = { ...existing, ...updates };
        const payload = {
          title: merged.childName ? `${merged.childName} Session` : 'Training Session',
          startTime: this.toIsoDateTime(merged.date, merged.time),
          endTime: this.toIsoDateTime(merged.date, merged.time, 60),
          capacity: 10,
          status: this.toApiStatus(merged.status)
        };

        return this.http.put<ApiSession>(`${this.apiUrl}/${sessionId}`, payload).pipe(
          map((updated) => this.fromApiSession(updated, merged)),
          tap((updated) =>
            this.sessions.update((sessions) => {
              const hasExisting = sessions.some((s) => s.id === sessionId);
              return hasExisting
                ? sessions.map((s) => (s.id === sessionId ? updated : s))
                : [...sessions, updated];
            })
          )
        );
      })
    );
  }

  deleteSession(sessionId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${sessionId}`).pipe(
      tap(() => this.sessions.update((sessions) => sessions.filter((s) => s.id !== sessionId)))
    );
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

  private fromApiSession(api: ApiSession, fallback?: Partial<Session>): Session {
    const start = new Date(api.startTime);
    return {
      id: String(api.id),
      childId: fallback?.childId || '',
      childName: fallback?.childName || api.title || '',
      clientId: fallback?.clientId || '',
      clientName: fallback?.clientName || '',
      date: start.toISOString().split('T')[0],
      time: start.toTimeString().slice(0, 5),
      level: fallback?.level || 1,
      status: this.fromApiStatus(api.status),
      instructor: fallback?.instructor,
      notes: fallback?.notes || api.title,
      price: fallback?.price || 0,
      createdAt: api.createdAt
    };
  }

  private toApiStatus(status: string): string {
    const s = status.toLowerCase();
    if (s === 'completed') return 'Completed';
    if (s === 'canceled') return 'Cancelled';
    return 'Scheduled';
  }

  private fromApiStatus(status: string): SessionStatus {
    const s = status.toLowerCase();
    if (s === 'completed') return 'completed';
    if (s === 'cancelled' || s === 'canceled') return 'canceled';
    return 'scheduled';
  }

  private toIsoDateTime(date: string, time: string, plusMinutes = 0): string {
    const dt = new Date(`${date}T${time}:00`);
    if (!Number.isNaN(dt.getTime()) && plusMinutes > 0) {
      dt.setMinutes(dt.getMinutes() + plusMinutes);
    }
    return dt.toISOString();
  }
}
