import { Component, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';
import { SessionService, Session, SessionStatus } from '../../services/session.service';
import { AttendanceService, Attendance, AttendanceStatus } from '../../services/attendance.service';
import { RevenueService } from '../../services/revenue.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit {
  clients = signal<User[]>([]);
  sessions = signal<Session[]>([]);
  attendance = signal<Attendance[]>([]);
  revenueData = this.revenueService.revenueData;
  
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

  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
    private attendanceService: AttendanceService,
    private revenueService: RevenueService,
    private router: Router
  ) {}

  ngOnInit(): void {
    if (!this.authService.isAuthenticated() || !this.authService.isAdmin()) {
      this.router.navigate(['/dashboard']);
      return;
    }

    this.loadData();
    
    // Watch session changes to recalculate revenue
    effect(() => {
      this.sessionService.sessions();
      this.revenueService.calculateRevenue();
      this.loadSessions();
    });
  }

  loadData(): void {
    this.clients.set(this.authService.getAllClients());
    this.loadSessions();
    this.loadAttendance();
    this.revenueService.calculateRevenue();
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
      });
      this.closeSessionForm();
    }
  }

  updateSessionStatus(sessionId: string, status: SessionStatus): void {
    this.sessionService.updateSession(sessionId, { status });
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
      });
      this.closeAttendanceForm();
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
