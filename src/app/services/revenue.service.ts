import { Injectable, signal } from '@angular/core';
import { SessionService, Session } from './session.service';

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
  revenueData = signal<RevenueData | null>(null);

  constructor(private sessionService: SessionService) {
    this.calculateRevenue();
  }

  calculateRevenue(): RevenueData {
    const sessions = this.sessionService.sessions();
    
    const totalRevenue = sessions
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + s.price, 0);

    const completedSessionsRevenue = sessions
      .filter(s => s.status === 'completed')
      .reduce((sum, s) => sum + s.price, 0);

    const canceledSessionsRevenue = sessions
      .filter(s => s.status === 'canceled')
      .reduce((sum, s) => sum + s.price, 0);

    const scheduledSessionsRevenue = sessions
      .filter(s => s.status === 'scheduled')
      .reduce((sum, s) => sum + s.price, 0);

    // Calculate revenue by date (last 30 days)
    const periodRevenue: { date: string; revenue: number }[] = [];
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    last30Days.forEach(date => {
      const dayRevenue = sessions
        .filter(s => s.date === date && s.status === 'completed')
        .reduce((sum, s) => sum + s.price, 0);
      periodRevenue.push({ date, revenue: dayRevenue });
    });

    // Calculate revenue by client
    const clientRevenueMap = new Map<string, { clientName: string; revenue: number; sessions: number }>();
    
    sessions
      .filter(s => s.status === 'completed')
      .forEach(session => {
        const existing = clientRevenueMap.get(session.clientId) || {
          clientName: session.clientName,
          revenue: 0,
          sessions: 0
        };
        existing.revenue += session.price;
        existing.sessions += 1;
        clientRevenueMap.set(session.clientId, existing);
      });

    const clientRevenue = Array.from(clientRevenueMap.entries()).map(([clientId, data]) => ({
      clientId,
      ...data
    })).sort((a, b) => b.revenue - a.revenue);

    const revenueData: RevenueData = {
      totalRevenue,
      completedSessionsRevenue,
      canceledSessionsRevenue,
      scheduledSessionsRevenue,
      periodRevenue,
      clientRevenue
    };

    this.revenueData.set(revenueData);
    return revenueData;
  }

  getRevenueByDateRange(startDate: string, endDate: string): number {
    const sessions = this.sessionService.sessions();
    return sessions
      .filter(s => {
        const sessionDate = new Date(s.date);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return sessionDate >= start && sessionDate <= end && s.status === 'completed';
      })
      .reduce((sum, s) => sum + s.price, 0);
  }

  getRevenueByClient(clientId: string): number {
    const sessions = this.sessionService.sessions();
    return sessions
      .filter(s => s.clientId === clientId && s.status === 'completed')
      .reduce((sum, s) => sum + s.price, 0);
  }

  getMonthlyRevenue(): { month: string; revenue: number }[] {
    const sessions = this.sessionService.sessions();
    const monthlyRevenue = new Map<string, number>();

    sessions
      .filter(s => s.status === 'completed')
      .forEach(session => {
        const date = new Date(session.date);
        const month = date.getMonth() + 1;
        const monthKey = `${date.getFullYear()}-${month < 10 ? '0' + month : month}`;
        const existing = monthlyRevenue.get(monthKey) || 0;
        monthlyRevenue.set(monthKey, existing + session.price);
      });

    return Array.from(monthlyRevenue.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}
