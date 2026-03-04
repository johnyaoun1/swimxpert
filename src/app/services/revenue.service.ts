import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface RevenueData {
  totalRevenue: number;
  completedSessionsRevenue: number;
  canceledSessionsRevenue: number;
  scheduledSessionsRevenue: number;
  periodRevenue: { date: string; revenue: number }[];
  clientRevenue: { clientId: string; clientName: string; revenue: number; sessions: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class RevenueService {
  private readonly paymentsApi = `${environment.apiUrl}/payments`;
  revenueData = signal<RevenueData | null>(null);

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    this.revenueData.set({
      totalRevenue: 0,
      completedSessionsRevenue: 0,
      canceledSessionsRevenue: 0,
      scheduledSessionsRevenue: 0,
      periodRevenue: [],
      clientRevenue: []
    });
  }

  processPayment(amount: number, method: string, userId?: string, paymentDate?: string, reference?: string): Observable<any> {
    const currentUser = this.authService.getCurrentUser();
    const resolvedUserId = userId || currentUser?.id;
    if (!resolvedUserId) {
      return of({ message: 'No user selected for payment.' });
    }

    const normalizedPaymentDate =
      paymentDate && paymentDate.trim().length > 0
        ? new Date(`${paymentDate}T00:00:00Z`).toISOString()
        : null;

    return this.http.post(this.paymentsApi, {
      userId: Number(resolvedUserId),
      amount,
      method,
      status: 'Completed',
      paymentDate: normalizedPaymentDate,
      reference: reference || null
    });
  }

  getMyPayments(userId?: string): Observable<any[]> {
    const currentUser = this.authService.getCurrentUser();
    const resolvedUserId = userId || currentUser?.id;
    if (!resolvedUserId) {
      return of([]);
    }

    return this.http.get<any[]>(`${this.paymentsApi}/user/${resolvedUserId}`);
  }

  getRevenueReport(from?: string, to?: string): Observable<RevenueData> {
    let params = new HttpParams();
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);

    return this.http.get<any>(`${this.paymentsApi}/revenue`, { params }).pipe(
      map((response) => ({
        totalRevenue: Number(response?.totalRevenue || 0),
        completedSessionsRevenue: Number(response?.totalRevenue || 0),
        canceledSessionsRevenue: 0,
        scheduledSessionsRevenue: 0,
        periodRevenue: [],
        clientRevenue: []
      })),
      tap((data) => this.revenueData.set(data))
    );
  }

  calculateRevenue(): RevenueData {
    return this.revenueData() || {
      totalRevenue: 0,
      completedSessionsRevenue: 0,
      canceledSessionsRevenue: 0,
      scheduledSessionsRevenue: 0,
      periodRevenue: [],
      clientRevenue: []
    };
  }

  getRevenueByDateRange(startDate: string, endDate: string): number {
    const current = this.revenueData();
    return current?.totalRevenue || 0;
  }

  getRevenueByClient(clientId: string): number {
    const current = this.revenueData();
    const row = current?.clientRevenue.find((c) => c.clientId === clientId);
    return row?.revenue || 0;
  }

  getMonthlyRevenue(): { month: string; revenue: number }[] {
    return [];
  }
}
