import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({ 'Content-Type': 'application/json' });
  }

  private handleError(error: HttpErrorResponse) {
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Error Code: ${error.status}\nMessage: ${error.error?.message || error.message}`;
    }
    
    if (!environment.production) { console.error(errorMessage); }
    return throwError(() => new Error(errorMessage));
  }

  // ========== AUTH ENDPOINTS ==========
  
  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, { email, password }).pipe(
      catchError((err) => throwError(() => err))
    );
  }

  register(email: string, password: string, fullName: string, phone?: string, birthDate?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, { 
      email, 
      password, 
      fullName, 
      phone: phone || '',
      birthDate: birthDate || null
    }).pipe(catchError(this.handleError));
  }

  validateToken(): Observable<any> {
    return this.http.get(`${this.apiUrl}/auth/validate-token`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  getMe(): Observable<{ id: number; email: string; fullName: string; role: string; twoFactorEnabled?: boolean }> {
    return this.http.get<{ id: number; email: string; fullName: string; role: string; twoFactorEnabled?: boolean }>(`${this.apiUrl}/auth/me`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  logout(): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/logout`, {}, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  resendVerification(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/resend-verification`, { email }, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/forgot-password`, { email }, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/reset-password`, { token, newPassword }, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  verifyEmail(token: string): Observable<{ message: string }> {
    return this.http.get<{ message: string }>(`${this.apiUrl}/auth/verify-email`, {
      params: { token },
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  verify2Fa(email: string, code: string): Observable<{ id: number; email: string; fullName: string; role: string }> {
    return this.http.post<{ id: number; email: string; fullName: string; role: string }>(`${this.apiUrl}/auth/2fa/verify`, { email, code }, {
      headers: this.getHeaders()
    }).pipe(catchError((e) => throwError(() => e)));
  }

  setup2Fa(): Observable<{ secret: string; qrCodeUri: string }> {
    return this.http.post<{ secret: string; qrCodeUri: string }>(`${this.apiUrl}/auth/2fa/setup`, {}, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  enable2Fa(code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/2fa/enable`, { code }, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  disable2Fa(code: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/2fa/disable`, { code }, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  refresh(): Observable<{ id: number; email: string; fullName: string; role: string }> {
    return this.http.post<{ id: number; email: string; fullName: string; role: string }>(`${this.apiUrl}/auth/refresh`, {}, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ========== ADMIN DASHBOARD ENDPOINTS ==========
  
  getAdminOverview(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admindashboard/overview`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  getAuditLogs(params: { page?: number; pageSize?: number; action?: string; from?: string; to?: string }): Observable<{ total: number; page: number; pageSize: number; items: any[] }> {
    const q = new URLSearchParams();
    if (params.page != null) q.set('page', String(params.page));
    if (params.pageSize != null) q.set('pageSize', String(params.pageSize));
    if (params.action) q.set('action', params.action);
    if (params.from) q.set('from', params.from);
    if (params.to) q.set('to', params.to);
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return this.http.get<{ total: number; page: number; pageSize: number; items: any[] }>(`${this.apiUrl}/admin/audit-logs${suffix}`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  getLeads(params?: { search?: string; isContacted?: boolean | null; from?: string; to?: string }): Observable<any[]> {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.isContacted !== undefined && params?.isContacted !== null) query.set('isContacted', String(params.isContacted));
    if (params?.from) query.set('from', params.from);
    if (params?.to) query.set('to', params.to);

    const suffix = query.toString() ? `?${query.toString()}` : '';
    return this.http.get<any[]>(`${this.apiUrl}/leads${suffix}`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateLeadStatus(leadId: number, isContacted: boolean): Observable<any> {
    return this.http.put(`${this.apiUrl}/leads/${leadId}/status`, { isContacted }, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ========== ADMIN USERS ENDPOINTS ==========

  getAdminUsers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/admin/users`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateAdminUser(userId: number, payload: { role?: string; isActive?: boolean }): Observable<any> {
    return this.http.put(`${this.apiUrl}/admin/users/${userId}`, payload, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteAdminUser(userId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/admin/users/${userId}`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ========== SWIMMERS / SKILLS ENDPOINTS ==========

  getMySwimmers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/swimmerskills/my`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  createSwimmer(payload: { name: string; age: number; level: number; profilePictureUrl?: string | null; parentUserId?: number }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/swimmerskills`, payload, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  updateSwimmer(swimmerId: number, payload: { name?: string; age?: number; level?: number; profilePictureUrl?: string | null }): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/swimmerskills/${swimmerId}`, payload, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  getSwimmerProgress(swimmerId: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/swimmerskills/${swimmerId}/progress`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  addProgressEntry(swimmerId: number, payload: { date?: string; level: number; notes?: string; skills?: string[] }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/swimmerskills/${swimmerId}/progress`, payload, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  getQuizResults(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/user/quiz-results`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  addQuizResult(payload: { score: number; totalQuestions: number; percentage: number }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/user/quiz-results`, payload, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  getLeaderboard(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/user/leaderboard`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  uploadProfilePicture(file: File): Observable<{ url: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ url: string }>(`${this.apiUrl}/upload/profile-picture`, formData).pipe(catchError(this.handleError));
  }

  // ========== GOOGLE CALENDAR (admin) ==========

  getGoogleCalendarStatus(): Observable<{
    connected: boolean;
    lastSyncUtc: string | null;
    calendarIdConfigured: boolean;
    oauthConfigured: boolean;
  }> {
    return this.http.get<{
      connected: boolean;
      lastSyncUtc: string | null;
      calendarIdConfigured: boolean;
      oauthConfigured: boolean;
    }>(`${this.apiUrl}/admin/google-calendar/status`, { headers: this.getHeaders() }).pipe(catchError(this.handleError));
  }

  getGoogleCalendarAuthorizationUrl(): Observable<{ url: string }> {
    return this.http.get<{ url: string }>(`${this.apiUrl}/admin/google-calendar/authorization-url`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  syncGoogleCalendar(): Observable<{
    created: number;
    updated: number;
    skipped: number;
    cancelledInDb: number;
    errors: string[];
  }> {
    return this.http
      .post<{
        created: number;
        updated: number;
        skipped: number;
        cancelledInDb: number;
        errors: string[];
      }>(`${this.apiUrl}/admin/google-calendar/sync`, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }

  disconnectGoogleCalendar(): Observable<{ message: string }> {
    return this.http
      .post<{ message: string }>(`${this.apiUrl}/admin/google-calendar/disconnect`, {}, { headers: this.getHeaders() })
      .pipe(catchError(this.handleError));
  }
}
