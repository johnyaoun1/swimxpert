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
    // Extract the human-readable message from the server response, falling back gracefully
    const message: string =
      error.error?.message ||
      error.error?.title  ||
      error.message       ||
      'Something went wrong. Please try again.';

    if (!environment.production) {
      console.error(`API error [${error.status}]:`, message, error);
    }

    const out = new Error(message) as Error & { status: number };
    out.status = error.status;
    return throwError(() => out);
  }

  // ========== AUTH ENDPOINTS ==========
  
  login(identifier: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, { identifier, password }).pipe(
      catchError((err) => throwError(() => err))
    );
  }

  register(email: string, password: string, fullName: string, phone?: string, birthDate?: string, phoneRegion?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, {
      email,
      password,
      fullName,
      phone: phone || '',
      phoneRegion: phoneRegion || 'LB',
      birthDate: birthDate || null
    }).pipe(catchError(this.handleError));
  }

  validateToken(): Observable<any> {
    return this.http.get(`${this.apiUrl}/auth/validate-token`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  getMe(): Observable<{
    id: number;
    email: string;
    fullName: string;
    role: string;
    twoFactorEnabled?: boolean;
    /** Server-side Features:TwoFactorEnabled gate — UI must not offer 2FA when false. */
    twoFactorFeatureEnabled?: boolean;
    emailVerificationRequired?: boolean;
    isApproved?: boolean;
    emailVerified?: boolean;
    clientStatus?: string;
    mustChangePassword?: boolean;
  }> {
    return this.http.get<{
      id: number;
      email: string;
      fullName: string;
      role: string;
      twoFactorEnabled?: boolean;
      twoFactorFeatureEnabled?: boolean;
      emailVerificationRequired?: boolean;
      isApproved?: boolean;
      emailVerified?: boolean;
      clientStatus?: string;
      mustChangePassword?: boolean;
    }>(`${this.apiUrl}/auth/me`, {
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

  changePassword(currentPassword: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/auth/change-password`, { currentPassword, newPassword }, {
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

  deleteLead(leadId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/leads/${leadId}`, {
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

  // ========== PENDING BOOKINGS (Admin) ==========

  getPendingBookings(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/sessions/bookings/pending`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  approveBooking(attendanceId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/sessions/bookings/${attendanceId}/approve`, {}, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  rejectBooking(attendanceId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/sessions/bookings/${attendanceId}/reject`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  // ========== DIRECT SLOT BOOKING (Client) ==========

  bookSlot(startUtc: string, swimmerId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/sessions/book-slot`, { startUtc, swimmerId }, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  createClientAccount(payload: {
    fullName: string;
    email: string;
    phone?: string;
    password?: string;
    childName?: string;
    childAge?: number;
    childLevel?: string;
  }): Observable<{ username: string; password: string; email: string }> {
    return this.http.post<{ username: string; password: string; email: string }>(
      `${this.apiUrl}/admin/users/create-client`, payload, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  createCoachAccount(payload: {
    fullName: string;
    email: string;
    phone?: string;
    password?: string;
  }): Observable<{ username: string; password: string; email: string }> {
    return this.http.post<{ username: string; password: string; email: string }>(
      `${this.apiUrl}/admin/users/create-coach`, payload, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  approveUser(id: number, newPassword?: string): Observable<{ message: string }> {
    const body = newPassword ? { newPassword } : {};
    return this.http.put<{ message: string }>(
      `${this.apiUrl}/admin/users/${id}/approve`,
      body,
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  rejectPendingUser(id: number): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/admin/users/${id}/reject`, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  resetUserPassword(id: number): Observable<{ temporaryPassword: string; message: string }> {
    return this.http.post<{ temporaryPassword: string; message: string }>(
      `${this.apiUrl}/admin/users/${id}/reset-password`,
      {},
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  updateClientProfile(id: number, payload: {
    fullName?: string;
    email?: string;
    phone?: string;
    newPassword?: string;
  }): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(
      `${this.apiUrl}/admin/users/${id}/update-profile`, payload, { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  // ========== SWIMMERS / SKILLS ENDPOINTS ==========

  getMySwimmers(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/swimmerskills/my`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  createSwimmer(payload: {
    name: string;
    age: number;
    level: number;
    isAccountHolder?: boolean;
    profilePictureUrl?: string | null;
    parentUserId?: number;
  }): Observable<any> {
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
    syncDisabled: boolean;
    syncDisabledMessage: string | null;
  }> {
    return this.http.get<{
      connected: boolean;
      lastSyncUtc: string | null;
      calendarIdConfigured: boolean;
      oauthConfigured: boolean;
      syncDisabled: boolean;
      syncDisabledMessage: string | null;
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
