import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';
import { SessionService, Session, SessionStatus } from '../../services/session.service';
import { AttendanceService, Attendance, AttendanceStatus } from '../../services/attendance.service';
import { RevenueService } from '../../services/revenue.service';
import { ApiService } from '../../services/api.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  clients = signal<User[]>([]);
  sessions = signal<Session[]>([]);
  attendance = signal<Attendance[]>([]);
  revenueData = this.revenueService.revenueData;
  dashboardOverview = signal({
    totalClients: 0,
    totalSessions: 0,
    completedSessions: 0,
    cancelledSessions: 0,
    attendanceRate: 0,
    totalRevenue: 0
  });
  
  selectedClientId = signal<string | null>(null);
  selectedPeriod = signal<'week' | 'month' | 'year'>('month');
  showSessionForm = signal(false);
  showAttendanceForm = signal(false);
  
  // Use regular properties for form data (not signals) to work with ngModel
  newSession: Partial<Session> = {
    childId: '',
    childName: '',
    clientId: '',
    clientName: '',
    date: new Date().toISOString().split('T')[0],
    time: '10:00',
    level: 1,
    status: 'scheduled',
    instructor: '',
    price: 50
  };

  newAttendance: Partial<Attendance> = {
    sessionId: '',
    childId: '',
    childName: '',
    clientId: '',
    clientName: '',
    date: new Date().toISOString().split('T')[0],
    status: 'present',
    checkInTime: ''
  };

  isLoading = signal(false);
  private refreshTimerId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
    private attendanceService: AttendanceService,
    private revenueService: RevenueService,
    private apiService: ApiService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.authService.isAuthenticated().subscribe((isAuthenticated) => {
      if (!isAuthenticated || !this.authService.isAdmin()) {
        this.router.navigate(['/dashboard']);
        return;
      }

      this.loadDataFromApi();
      this.refreshTimerId = setInterval(() => this.loadDataFromApi(false), 15000);
    });
  }

  ngOnDestroy(): void {
    if (this.refreshTimerId) {
      clearInterval(this.refreshTimerId);
    }
  }

  loadDataFromApi(showLoader = true): void {
    if (showLoader) {
      this.isLoading.set(true);
    }

    forkJoin({
      overview: this.apiService.getAdminOverview(),
      users: this.apiService.getAdminUsers().pipe(catchError(() => of([]))),
      sessions: this.sessionService.getSessions().pipe(catchError(() => of([]))),
      revenue: this.revenueService.getRevenueReport().pipe(catchError(() => of(null)))
    }).subscribe({
      next: ({ overview, users, sessions, revenue }) => {
        const totalSessions = Number(overview?.totalSessions || 0);
        const completedSessions = Number(overview?.completedSessions || 0);
        const cancelledSessions = Number(overview?.cancelledSessions || 0);
        const scheduledSessions = Math.max(totalSessions - completedSessions - cancelledSessions, 0);

        this.dashboardOverview.set({
          totalClients: Number(overview?.totalClients || 0),
          totalSessions,
          completedSessions,
          cancelledSessions,
          attendanceRate: Number(overview?.attendanceRate || 0),
          totalRevenue: Number(overview?.totalRevenue || 0)
        });

        this.clients.set(this.transformAdminUsers(users));
        this.sessions.set(sessions);

        this.revenueData.set({
          totalRevenue: Number(overview?.totalRevenue || 0),
          completedSessionsRevenue: Number(overview?.totalRevenue || 0),
          canceledSessionsRevenue: cancelledSessions,
          scheduledSessionsRevenue: scheduledSessions,
          periodRevenue: revenue?.periodRevenue || [],
          clientRevenue: revenue?.clientRevenue || []
        });

        if (showLoader) {
          this.isLoading.set(false);
        }
      },
      error: (error) => {
        console.error('Error loading dashboard data:', error);
        this.loadData();
        if (showLoader) {
          this.isLoading.set(false);
        }
      }
    });
  }
  transformAdminUsers(apiUsers: any[]): User[] {
    return (apiUsers || [])
      .filter((u) => (u?.role || '').toLowerCase() !== 'admin' && u?.isActive !== false)
      .map((u) => ({
        id: String(u.id),
        email: u.email || '',
        name: u.fullName || u.email || 'Client',
        role: 'user' as const,
        children: [],
        quizResults: []
      }));
  }


  loadData(): void {
    // Fallback to localStorage data
    this.clients.set(this.authService.getAllClients());
    this.loadSessions();
    this.loadAttendance();
    this.revenueService.calculateRevenue();
  }

  transformClients(apiClients: any[]): User[] {
    return apiClients.map(c => ({
      id: c.id,
      email: c.email,
      name: c.name,
      avatar: c.avatar,
      role: 'user' as const,
      children: (c.children || []).map((child: any) => ({
        id: child.id,
        name: child.name,
        age: child.age,
        level: child.level,
        profilePicture: child.profilePicture,
        progress: []
      })),
      quizResults: []
    }));
  }

  transformSessions(apiSessions: any[]): Session[] {
    return apiSessions.map(s => ({
      id: s.id,
      clientId: s.clientId,
      clientName: s.clientName,
      childId: s.childId,
      childName: s.childName,
      date: s.date,
      time: s.time,
      level: s.level,
      status: s.status as SessionStatus,
      instructor: s.instructor,
      price: s.price,
      notes: '',
      createdAt: s.createdAt || new Date().toISOString()
    }));
  }

  transformAttendance(apiAttendance: any[]): Attendance[] {
    return apiAttendance.map(a => ({
      id: a.id,
      sessionId: a.sessionId,
      clientId: a.clientId,
      clientName: a.clientName,
      childId: a.childId,
      childName: a.childName,
      date: a.date,
      status: a.status as AttendanceStatus,
      checkInTime: a.checkInTime,
      notes: a.notes || '',
      createdAt: a.createdAt || new Date().toISOString()
    }));
  }

  loadSessions(): void {
    this.sessions.set(this.sessionService.sessions());
  }

  loadAttendance(): void {
    this.attendance.set(this.attendanceService.attendance());
  }

  getSelectedClient(): User | null {
    const clientId = this.selectedClientId();
    if (!clientId) return null;
    return this.clients().find(c => c.id === clientId) || null;
  }

  getClientSessions(clientId: string): Session[] {
    return this.sessions().filter(s => s.clientId === clientId);
  }

  getClientChildren(clientId: string) {
    const client = this.clients().find(c => c.id === clientId);
    return client?.children || [];
  }

  getSessionStats() {
    const sessions = this.sessions();
    return {
      total: sessions.length,
      completed: this.sessionService.getCompletedSessionsCount(),
      canceled: this.sessionService.getCanceledSessionsCount(),
      scheduled: this.sessionService.getScheduledSessionsCount()
    };
  }

  getAttendanceStats() {
    return this.attendanceService.getAttendanceStats();
  }

  openSessionForm(clientId?: string, childId?: string): void {
    if (clientId && childId) {
      const client = this.clients().find(c => c.id === clientId);
      const child = client?.children.find(c => c.id === childId);
      if (client && child) {
        this.newSession = {
          ...this.newSession,
          clientId: client.id,
          clientName: client.name,
          childId: child.id,
          childName: child.name,
          level: child.level
        };
      }
    }
    this.showSessionForm.set(true);
  }

  closeSessionForm(): void {
    this.showSessionForm.set(false);
    this.newSession = {
      childId: '',
      childName: '',
      clientId: '',
      clientName: '',
      date: new Date().toISOString().split('T')[0],
      time: '10:00',
      level: 1,
      status: 'scheduled',
      instructor: '',
      price: 50
    };
  }

  saveSession(): void {
    const session = this.newSession;
    if (session.clientId && session.childId && session.date && session.time) {
      this.isLoading.set(true);
      this.sessionService.createSession({
        childId: session.childId!,
        childName: session.childName!,
        clientId: session.clientId!,
        clientName: session.clientName!,
        date: session.date!,
        time: session.time!,
        level: session.level || 1,
        status: (session.status as SessionStatus) || 'scheduled',
        instructor: session.instructor,
        notes: session.notes,
        price: session.price || 50
      }).subscribe({
        next: () => {
          this.loadDataFromApi(false);
          this.closeSessionForm();
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to create session:', error);
          this.isLoading.set(false);
        }
      });
    }
  }

  updateSessionStatus(sessionId: string, status: SessionStatus): void {
    this.isLoading.set(true);
    this.sessionService.updateSession(sessionId, { status }).subscribe({
      next: () => {
        this.loadDataFromApi(false);
        this.isLoading.set(false);
      },
      error: (error) => {
        console.error('Failed to update session status:', error);
        this.isLoading.set(false);
      }
    });
  }

  openAttendanceForm(sessionId: string): void {
    const session = this.sessions().find(s => s.id === sessionId);
    if (session) {
      this.newAttendance = {
        sessionId: session.id,
        childId: session.childId,
        childName: session.childName,
        clientId: session.clientId,
        clientName: session.clientName,
        date: session.date,
        status: 'present',
        checkInTime: session.time
      };
      this.showAttendanceForm.set(true);
    }
  }

  closeAttendanceForm(): void {
    this.showAttendanceForm.set(false);
  }

  saveAttendance(): void {
    const attendance = this.newAttendance;
    if (attendance.sessionId && attendance.childId && attendance.date) {
      this.isLoading.set(true);
      this.attendanceService.recordAttendance({
        sessionId: attendance.sessionId!,
        childId: attendance.childId!,
        childName: attendance.childName!,
        clientId: attendance.clientId!,
        clientName: attendance.clientName!,
        date: attendance.date!,
        status: (attendance.status as AttendanceStatus) || 'present',
        checkInTime: attendance.checkInTime,
        notes: attendance.notes
      }).subscribe({
        next: () => {
          this.loadDataFromApi(false);
          this.closeAttendanceForm();
          this.isLoading.set(false);
        },
        error: (error) => {
          console.error('Failed to save attendance:', error);
          this.isLoading.set(false);
        }
      });
    }
  }

  getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'completed': 'bg-green-100 text-green-800',
      'scheduled': 'bg-blue-100 text-blue-800',
      'canceled': 'bg-red-100 text-red-800',
      'present': 'bg-green-100 text-green-800',
      'absent': 'bg-red-100 text-red-800',
      'late': 'bg-yellow-100 text-yellow-800',
      'excused': 'bg-gray-100 text-gray-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  }

  onClientChange(clientId: string): void {
    const client = this.clients().find(c => c.id === clientId);
    if (client) {
      this.newSession = {
        ...this.newSession,
        clientId: client.id,
        clientName: client.name,
        childId: '',
        childName: ''
      };
    }
  }

  onChildChange(childId: string): void {
    const clientId = this.newSession?.clientId;
    if (!clientId) return;
    
    const client = this.clients().find(c => c.id === clientId);
    const child = client?.children.find(c => c.id === childId);
    
    if (child) {
      this.newSession = {
        ...this.newSession,
        childId: child.id,
        childName: child.name,
        level: child.level
      };
    }
  }

  getAttendanceRate(): number {
    const stats = this.getAttendanceStats();
    if (stats.total === 0) return 0;
    return Math.round((stats.present / stats.total) * 100);
  }

  getClientRevenue(clientId: string): number {
    const revenue = this.revenueData()?.clientRevenue?.find(c => c.clientId === clientId);
    return revenue?.revenue || 0;
  }

  getClientSessionsCount(clientId: string): number {
    const revenue = this.revenueData()?.clientRevenue?.find(c => c.clientId === clientId);
    return revenue?.sessions || 0;
  }
}
