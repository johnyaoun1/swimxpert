import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService, User } from '../../services/auth.service';
import { getLevelFocus, getChildInitial } from '../../utils/swim-utils';
import { SessionService, Session, SessionStatus } from '../../services/session.service';
import { AttendanceService, Attendance, AttendanceStatus } from '../../services/attendance.service';
import { RevenueService } from '../../services/revenue.service';
import { ApiService } from '../../services/api.service';
import { SwimmerSkillCard, SwimmerSkillsService } from '../../services/swimmer-skills.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  leads = signal<Array<{ id: number; name: string; email?: string | null; phone?: string | null; sourcePage?: string | null; sourceAction?: string | null; isContacted: boolean; contactedAt?: string | null; createdAt: string }>>([]);
  leadSearch = signal('');
  leadStatusFilter = signal<'all' | 'new' | 'contacted'>('all');
  leadFromDate = signal('');
  leadToDate = signal('');
  updatingLeadId = signal<number | null>(null);
  clientSearch = signal('');
  sessionSearch = signal('');
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
  skillSaving = signal<Record<string, boolean>>({});
  private refreshTimerId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private authService: AuthService,
    private sessionService: SessionService,
    private attendanceService: AttendanceService,
    private revenueService: RevenueService,
    private apiService: ApiService,
    private swimmerSkillsService: SwimmerSkillsService,
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
      attendance: this.attendanceService.getAllRegistrations().pipe(catchError(() => of([]))),
      revenue: this.revenueService.getRevenueReport().pipe(catchError(() => of(null))),
      swimmerSkills: this.swimmerSkillsService.getMySwimmers().pipe(catchError(() => of([]))),
      leads: this.apiService.getLeads(this.buildLeadQuery()).pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ overview, users, sessions, attendance, revenue, swimmerSkills, leads }) => {
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

        const clients = this.transformAdminUsers(users);
        this.clients.set(this.mergeSkillCardsIntoClients(clients, swimmerSkills));
        this.sessions.set(sessions);
        this.attendance.set(attendance);
        this.leads.set(leads || []);

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
        children: (u.swimmers || []).map((s: any) => ({
          id: String(s.id),
          name: s.name,
          age: Number(s.age ?? 0),
          level: Number(s.level ?? 1),
          profilePicture: s.profilePictureUrl || undefined,
          progress: [],
          skillLevels: []
        })),
        quizResults: []
      }));
  }

  private mergeSkillCardsIntoClients(clients: User[], swimmerSkills: SwimmerSkillCard[]): User[] {
    const skillsById = new Map(swimmerSkills.map((s) => [String(s.id), s]));
    return clients.map((client) => ({
      ...client,
      children: client.children.map((child) => {
        const card = skillsById.get(child.id);
        if (!card) return child;
        return {
          ...child,
          level: card.level,
          profilePicture: card.profilePictureUrl || child.profilePicture,
          skillLevels: card.levels
        };
      })
    }));
  }


  selectClient(clientId: string | number): void {
    this.selectedClientId.set(clientId == null ? null : String(clientId));
  }

  isClientSelected(clientId: string | number): boolean {
    const id = clientId == null ? '' : String(clientId);
    return this.selectedClientId() === id;
  }

  getSelectedClient(): User | null {
    const clientId = this.selectedClientId();
    if (clientId == null || clientId === '') return null;
    const id = String(clientId);
    return this.clients().find(c => String(c.id) === id) || null;
  }

  getClientSessions(clientId: string): Session[] {
    return this.sessions().filter(s => s.clientId === clientId);
  }

  getClientChildren(clientId: string) {
    const client = this.clients().find(c => c.id === clientId);
    return client?.children || [];
  }

  getChildInitial = getChildInitial;

  isSkillUnlocked(child: { skillLevels?: { level: number; skills: { name: string; isUnlocked: boolean }[] }[] }, level: number, skillName: string): boolean {
    const levelBlock = (child.skillLevels || []).find((x) => x.level === level);
    const skill = levelBlock?.skills?.find((s) => s.name === skillName);
    return !!skill?.isUnlocked;
  }

  isSkillSaving(childId: string, level: number, skillName: string): boolean {
    return !!this.skillSaving()[`${childId}-${level}-${skillName}`];
  }

  toggleChildSkill(child: { id: string; skillLevels?: { level: number; skills: { name: string; isUnlocked: boolean }[] }[] }, level: number, skillName: string): void {
    const swimmerId = Number(child.id);
    if (!swimmerId) return;
    const currentlyUnlocked = this.isSkillUnlocked(child, level, skillName);
    const key = `${child.id}-${level}-${skillName}`;
    this.skillSaving.update((state) => ({ ...state, [key]: true }));
    this.swimmerSkillsService.toggleSkill(swimmerId, level, skillName, !currentlyUnlocked).subscribe({
      next: (updated) => {
        this.clients.update((clients) =>
          clients.map((c) => ({
            ...c,
            children: c.children.map((ch: any) =>
              ch.id === String(updated.id)
                ? { ...ch, level: updated.level, profilePicture: updated.profilePictureUrl || ch.profilePicture, skillLevels: updated.levels }
                : ch
            )
          }))
        );
        this.loadDataFromApi(false);
        this.skillSaving.update((state) => ({ ...state, [key]: false }));
      },
      error: (err) => {
        console.error('Failed to update skill:', err);
        this.skillSaving.update((state) => ({ ...state, [key]: false }));
      }
    });
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

  buildLeadQuery(): { search?: string; isContacted?: boolean | null; from?: string; to?: string } {
    const q: { search?: string; isContacted?: boolean | null; from?: string; to?: string } = {};
    if (this.leadSearch().trim()) q.search = this.leadSearch().trim();
    if (this.leadStatusFilter() === 'new') q.isContacted = false;
    if (this.leadStatusFilter() === 'contacted') q.isContacted = true;
    if (this.leadFromDate()) q.from = this.leadFromDate();
    if (this.leadToDate()) q.to = this.leadToDate();
    return q;
  }

  onLeadFiltersChanged(): void {
    this.apiService.getLeads(this.buildLeadQuery()).pipe(catchError(() => of([]))).subscribe((leads) => this.leads.set(leads));
  }

  clearLeadFilters(): void {
    this.leadSearch.set('');
    this.leadStatusFilter.set('all');
    this.leadFromDate.set('');
    this.leadToDate.set('');
    this.onLeadFiltersChanged();
  }

  formatLeadDate(createdAt: string): string {
    if (!createdAt) return '-';
    const d = new Date(createdAt);
    return isNaN(d.getTime()) ? createdAt : d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  isUpdatingLead(leadId: number): boolean {
    return this.updatingLeadId() === leadId;
  }

  toggleLeadContacted(leadId: number, isContacted: boolean): void {
    this.updatingLeadId.set(leadId);
    this.apiService.updateLeadStatus(leadId, isContacted).subscribe({
      next: () => {
        this.leads.update((items) => items.map((l) => (l.id === leadId ? { ...l, isContacted } : l)));
        this.updatingLeadId.set(null);
      },
      error: (err) => {
        console.error('Failed to update lead status', err);
        this.updatingLeadId.set(null);
      }
    });
  }

  exportLeadsCsv(): void {
    const rows = this.leads();
    if (rows.length === 0) return;
    const headers = ['Name', 'Email', 'Phone', 'Source Page', 'Source Action', 'Status', 'Created At'];
    const lines = [headers.join(',')];
    for (const r of rows) {
      const status = r.isContacted ? 'Contacted' : 'New';
      const createdAt = this.formatLeadDate(r.createdAt).replace(/,/g, ' ');
      lines.push([r.name, r.email ?? '', r.phone ?? '', r.sourcePage ?? '', r.sourceAction ?? '', status, createdAt].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `swimxpert-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  getFilteredClients(): User[] {
    const q = this.clientSearch().toLowerCase().trim();
    if (!q) return this.clients();
    return this.clients().filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }

  getFilteredSessions(): Session[] {
    const q = this.sessionSearch().toLowerCase().trim();
    if (!q) return this.sessions();
    return this.sessions().filter((s) => s.clientName?.toLowerCase().includes(q) || s.childName?.toLowerCase().includes(q) || s.status?.toLowerCase().includes(q));
  }

  getLevelFocus = getLevelFocus;
}
