import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl = 'http://localhost:5002/api';

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('swimxpert_token');
    let headers = new HttpHeaders({
      'Content-Type': 'application/json'
    });
    
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    
    return headers;
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
    
    console.error(errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  // ========== AUTH ENDPOINTS ==========
  
  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, { email, password })
      .pipe(catchError(this.handleError));
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

  // ========== ADMIN DASHBOARD ENDPOINTS ==========
  
  getAdminOverview(): Observable<any> {
    return this.http.get(`${this.apiUrl}/admindashboard/overview`, {
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
}
