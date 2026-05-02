import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, EMPTY } from 'rxjs';
import { map, switchMap, tap, catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { toDate } from 'date-fns-tz';
import { BEIRUT_TZ } from '../utils/beirut-week';

export type SessionStatus = 'scheduled' | 'completed' | 'canceled';

export interface AvailableSlot {
  date: string;       // "2026-04-30"
  startLocal: string; // "09:00"
  endLocal: string;   // "09:45"
  startUtc: string;   // ISO
  endUtc: string;     // ISO
}

export interface Session {
  id: string;
  childId: string;
  childName: string;
  clientId: string;
  clientName: string;
  date: string;
  time: string;
  endTime?: string;
  level: number;
  status: SessionStatus;
  instructor?: string;
  notes?: string;
  poolLocation?: string;
  maxSwimmers?: number;
  price: number;
  /** Counts toward weekly brief income when true (and session not canceled). */
  isPaid: boolean;
  /** Original API timestamps (UTC ISO) — use for timezone-accurate calendar layout. */
  startTimeUtc?: string;
  endTimeUtc?: string;
  /** Present when this row was synced from Google Calendar. */
  googleEventId?: string;
  /** Same id for all sessions in a weekly package (repeat weekly). */
  recurrenceSeriesId?: string;
  createdAt: string;
}

interface ApiRegistrationRow {
  id: number;
  swimmerId: number;
  swimmerName: string;
  parentUserId: number;
  parentName: string;
  isPresent: boolean;
}

interface ApiSession {
  id: number;
  title: string;
  startTime: string;
  endTime: string;
  maxSwimmers?: number;
  poolLocation?: string;
  status: string;
  createdAt: string;
  price?: number;
  isPaid?: boolean;
  googleEventId?: string;
  recurrenceSeriesId?: string;
  registrations?: ApiRegistrationRow[];
}

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private readonly baseUrl = environment.apiUrl;
  private readonly apiUrl = `${this.baseUrl}/sessions`;
  private readonly registrationsUrl = `${this.baseUrl}/registrations`;
  sessions = signal<Session[]>([]);

  constructor(private http: HttpClient) {
    // Only Coach/Admin can fetch full sessions; silently skip for clients.
    this.getSessions().pipe(catchError(() => EMPTY)).subscribe();
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
    const endTime = session.endTime
      ? this.toIsoDateTime(session.date, session.endTime)
      : this.toIsoDateTime(session.date, session.time, 60);

    const payload = {
      title: session.childName ? `${session.childName} Session` : 'Training Session',
      startTime: this.toIsoDateTime(session.date, session.time),
      endTime,
      maxSwimmers: session.maxSwimmers ?? 10,
      poolLocation: session.poolLocation ?? null,
      status: this.toApiStatus(session.status),
      price: session.price ?? 0,
      isPaid: !!session.isPaid
    };

    return this.http.post<ApiSession>(this.apiUrl, payload).pipe(
      switchMap((created) => this.ensureSwimmerRegistration(created, session)),
      map((created) => this.fromApiSession(created, session)),
      tap((created) => this.sessions.update((sessions) => [...sessions, created]))
    );
  }

  /** Create session with date/time interpreted in Asia/Beirut (admin schedule). */
  createSessionBeirut(session: Omit<Session, 'id' | 'createdAt' | 'startTimeUtc' | 'endTimeUtc'> & { endTime: string }): Observable<Session> {
    const startTime = toDate(`${session.date}T${session.time}:00`, { timeZone: BEIRUT_TZ }).toISOString();
    const endTime = toDate(`${session.date}T${session.endTime}:00`, { timeZone: BEIRUT_TZ }).toISOString();
    const payload = {
      title: session.childName ? `${session.childName} Session` : 'Training Session',
      startTime,
      endTime,
      maxSwimmers: session.maxSwimmers ?? 10,
      poolLocation: session.poolLocation ?? null,
      status: this.toApiStatus(session.status),
      price: session.price ?? 0,
      isPaid: !!session.isPaid
    };

    return this.http.post<ApiSession>(this.apiUrl, payload).pipe(
      switchMap((created) => this.ensureSwimmerRegistration(created, session)),
      map((created) => this.fromApiSession(created, session)),
      tap((created) => this.sessions.update((sessions) => [...sessions, created]))
    );
  }

  /** Links swimmer ↔ session in the API after creating a session (required for attendance & client lists). */
  private ensureSwimmerRegistration(created: ApiSession, session: Omit<Session, 'id' | 'createdAt'>): Observable<ApiSession> {
    const swimmerId = Number(session.childId);
    if (!Number.isFinite(swimmerId) || swimmerId <= 0) {
      return of(created);
    }
    return this.http
      .post<{ id: number }>(this.registrationsUrl, {
        swimmerId,
        trainingSessionId: created.id
      })
      .pipe(
        switchMap(() => this.http.get<ApiSession>(`${this.apiUrl}/${created.id}`)),
        catchError((err: { status?: number }) => {
          if (err?.status === 409) {
            return this.http.get<ApiSession>(`${this.apiUrl}/${created.id}`);
          }
          return of(created);
        })
      );
  }

  /**
   * @param recurrenceApply For weekly packages: which rows get the same price/location/paid/status (API: single | thisAndFollowing | allInSeries).
   */
  updateSession(
    sessionId: string,
    updates: Partial<Session>,
    recurrenceApply?: 'single' | 'thisAndFollowing' | 'allInSeries'
  ): Observable<Session> {
    return this.getSessionById(sessionId).pipe(
      switchMap((existing) => {
        const merged = { ...existing, ...updates };
        const timeFieldsChanged = ['date', 'time', 'endTime'].some((k) => k in updates);

        let startIso: string;
        let endIso: string;
        if (!timeFieldsChanged && existing.startTimeUtc && existing.endTimeUtc) {
          startIso = existing.startTimeUtc;
          endIso = existing.endTimeUtc;
        } else {
          endIso = merged.endTime
            ? this.toIsoDateTime(merged.date, merged.endTime)
            : this.toIsoDateTime(merged.date, merged.time, 60);
          startIso = this.toIsoDateTime(merged.date, merged.time);
        }

        const payload: Record<string, unknown> = {
          title: merged.childName ? `${merged.childName} Session` : 'Training Session',
          startTime: startIso,
          endTime: endIso,
          maxSwimmers: merged.maxSwimmers ?? 10,
          poolLocation: merged.poolLocation ?? null,
          status: this.toApiStatus(merged.status),
          price: merged.price ?? 0,
          isPaid: !!merged.isPaid
        };
        if (recurrenceApply && recurrenceApply !== 'single') {
          payload['recurrenceApply'] = recurrenceApply;
        }

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

  /** scope: thisEvent (default) | thisAndFollowing | allEvents (maps to API delete scope). */
  deleteSession(
    sessionId: string,
    scope: 'thisEvent' | 'thisAndFollowing' | 'allEvents' = 'thisEvent'
  ): Observable<void> {
    let params = new HttpParams();
    if (scope === 'thisAndFollowing') params = params.set('scope', 'thisAndFollowing');
    else if (scope === 'allEvents') params = params.set('scope', 'allInSeries');

    return this.http.delete<void>(`${this.apiUrl}/${sessionId}`, { params });
  }

  /** Returns free 45-minute slots (9 AM–8 PM Beirut) for the next N days. */
  getAvailableSlots(days = 14): Observable<AvailableSlot[]> {
    return this.http.get<AvailableSlot[]>(`${this.apiUrl}/available`, { params: { days: String(days) } });
  }

  /** Books a free slot for a swimmer. Creates the session and registration. */
  bookSlot(startUtc: string, swimmerId: number): Observable<{ message: string; registrationId: number; date: string; startLocal: string; endLocal: string }> {
    return this.http.post<{ message: string; registrationId: number; date: string; startLocal: string; endLocal: string }>(
      `${this.apiUrl}/book-slot`,
      { startUtc, swimmerId }
    );
  }

  /** Clone this session forward by 7 days per week (same price, location, registrations). */
  repeatWeeklySession(sessionId: string, weeks: number): Observable<{ created: number; skipped: number; recurrenceSeriesId?: string }> {
    return this.http.post<{ created: number; skipped: number; recurrenceSeriesId?: string }>(`${this.apiUrl}/${sessionId}/repeat-weekly`, {
      weeks
    });
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
    const end = new Date(api.endTime);
    const reg = api.registrations?.[0];
    const titleChild = this.childNameFromSessionTitle(api.title);
    return {
      id: String(api.id),
      childId: fallback?.childId || (reg?.swimmerId != null ? String(reg.swimmerId) : ''),
      childName: fallback?.childName || reg?.swimmerName || titleChild || api.title || '',
      clientId: fallback?.clientId || (reg?.parentUserId != null ? String(reg.parentUserId) : ''),
      clientName: fallback?.clientName || reg?.parentName || '',
      date: start.toISOString().split('T')[0],
      time: start.toTimeString().slice(0, 5),
      endTime: end.toTimeString().slice(0, 5),
      level: fallback?.level || 1,
      status: this.fromApiStatus(api.status),
      instructor: fallback?.instructor,
      notes: fallback?.notes,
      poolLocation: api.poolLocation ?? fallback?.poolLocation,
      maxSwimmers: api.maxSwimmers ?? fallback?.maxSwimmers ?? 10,
      price: Number(api.price ?? fallback?.price ?? 0),
      isPaid: api.isPaid ?? fallback?.isPaid ?? false,
      startTimeUtc: api.startTime,
      endTimeUtc: api.endTime,
      googleEventId: api.googleEventId || undefined,
      recurrenceSeriesId: api.recurrenceSeriesId != null ? String(api.recurrenceSeriesId) : undefined,
      createdAt: api.createdAt
    };
  }

  /** When title was saved as "{Child} Session", recover child name for display. */
  private childNameFromSessionTitle(title: string): string {
    const m = title?.trim().match(/^(.+?)\s+Session$/i);
    return m ? m[1].trim() : '';
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
