import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService, User } from '../../services/auth.service';
import { ProfileSrcPipe } from '../../pipes/profile-src.pipe';
import { getLevelFocus, getChildInitial } from '../../utils/swim-utils';
import { SessionService, Session, SessionStatus } from '../../services/session.service';
import { AttendanceService, Attendance } from '../../services/attendance.service';
import { RevenueService, MonthlyRevenue } from '../../services/revenue.service';
import { ApiService } from '../../services/api.service';
import { SwimmerSkillCard, SwimmerSkillsService } from '../../services/swimmer-skills.service';
import { forkJoin, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';

interface AdminCoachRow {
  id: string;
  name: string;
  email: string;
  phone?: string;
  username?: string;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ProfileSrcPipe],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss']
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  readonly missingPhotos = signal(new Set<string>());
  pendingBookings = signal<Array<{
    id: number;
    bookingStatus: string;
    swimmer: { id: number; name: string; level?: number; isAccountHolder?: boolean };
    client: { id: number; fullName: string; email: string; isApproved?: boolean; clientStatus?: string; emailVerified?: boolean };
    session: { id: number; title: string; startTime: string; endTime: string };
    sessionDate: string;
    sessionPrice?: number;
    createdAt: string;
    onlinePayment?: { status: string; amount: number; method: string } | null;
  }>>([]);
  pendingBookingsLoading = signal(false);
  processingBookingId = signal<number | null>(null);
  bookingActionError = signal<string>('');

  leads = signal<Array<{ id: number; name: string; email?: string | null; phone?: string | null; sourcePage?: string | null; sourceAction?: string | null; isContacted: boolean; contactedAt?: string | null; createdAt: string }>>([]);

  // Booking-request leads not yet converted → shown in "Waiting List"
  waitingList = computed(() =>
    this.leads().filter(l =>
      l.sourceAction?.startsWith('Booking Request') && !l.isContacted
    )
  );

  /** Submissions from the Contact Us page (`sourcePage` = Contact). */
  contactFormMessages = computed(() =>
    this.leads().filter(
      (l) => (l.sourcePage?.trim().toLowerCase() ?? '') === 'contact'
    )
  );

  leadSearch = signal('');
  leadStatusFilter = signal<'all' | 'new' | 'contacted'>('all');
  leadFromDate = signal('');
  leadToDate = signal('');
  updatingLeadId = signal<number | null>(null);
  clientSearch = signal('');
  /** Parent clients only (coaches listed separately). */
  clients = signal<User[]>([]);
  /** Active coach accounts for staff section. */
  adminDashboardCoaches = signal<AdminCoachRow[]>([]);
  coachSearch = signal('');
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

  // ── Create Client (inline in dashboard) ─────────────────────
  showCreateClientModal  = signal(false);
  createClientForm       = { fullName: '', email: '', phone: '', password: '', childName: '', childAge: '', childLevel: '' };
  showCreateClientPw     = false;
  createClientLoading    = signal(false);
  createClientError      = signal('');
  createClientResult     = signal<{ username: string; password: string; email: string } | null>(null);

  // ── Create Coach (inline in dashboard) ──────────────────────
  showCreateCoachModal   = signal(false);
  createCoachForm        = { fullName: '', email: '', phone: '', password: '' };
  showCreateCoachPw      = false;
  createCoachLoading     = signal(false);
  createCoachError       = signal('');
  createCoachResult      = signal<{ username: string; password: string; email: string } | null>(null);

  // ── Edit Client ──────────────────────────────────────────────
  showEditClientModal   = signal(false);
  editingClientId       = signal<number | null>(null);
  editClientForm        = { fullName: '', email: '', phone: '', newPassword: '' };
  showEditPw            = false;
  editClientLoading     = signal(false);
  editClientError       = signal('');
  editClientSuccess     = signal(false);
  editClientSavedPw     = signal('');
  editClientForcedReset = signal(false);

  // ── Add Child ────────────────────────────────────────────────
  showAddChildModal   = signal(false);
  addChildClientId    = signal<number | null>(null);
  addChildClientName  = signal('');
  addChildForm        = { name: '', age: '', level: '1' };
  addChildLoading     = signal(false);
  addChildError       = signal('');
  addChildSuccess     = signal(false);
  
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

  newAttendance: Partial<Attendance> & { registrationId?: string } = {
    sessionId: '',
    childId: '',
    childName: '',
    clientId: '',
    clientName: '',
    date: new Date().toISOString().split('T')[0],
    status: 'present',
    checkInTime: ''
  };

  /** Quick payment entry (writes to Payments API). */
  paymentUserId = '';
  paymentAmount: number | null = null;
  paymentMethod = 'Cash';
  paymentDate = '';
  paymentReference = '';
  paymentSaving = signal(false);
  paymentMessage = signal('');

  monthlyRevenue = signal<MonthlyRevenue[]>([]);
  monthlyRevenueError = signal('');
  isLoading = signal(false);
  skillSaving = signal<Record<string, boolean>>({});
  /** Aqua Cards–style skill accordions per swimmer (child id). */
  expandedSkillSectionsByChildId = signal<Record<string, Set<number>>>({});
  private refreshTimerId: ReturnType<typeof setInterval> | null = null;

  // ── Booking payment recording ────────────────────────────────
  bookingPaymentState = signal<Record<number, 'idle' | 'recording' | 'done'>>({});
  bookingPaymentMethod: Record<number, string> = {};

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
      sessions: this.sessionService.getSessionsForStaffDashboard().pipe(catchError(() => of([]))),
      attendance: this.attendanceService.getAllRegistrations().pipe(catchError(() => of([]))),
      revenue: this.revenueService.getRevenueReport().pipe(catchError(() => of(null))),
      monthlyRevenue: this.revenueService.getMonthlyRevenue(6).pipe(catchError(() => of([]))),
      swimmerSkills: this.swimmerSkillsService.getMySwimmers().pipe(catchError(() => of([]))),
      leads: this.apiService.getLeads(this.buildLeadQuery()).pipe(catchError(() => of([]))),
      pendingBookings: this.apiService.getPendingBookings().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ overview, users, sessions, attendance, revenue, monthlyRevenue, swimmerSkills, leads, pendingBookings }) => {
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
        this.pendingBookings.set(pendingBookings || []);
        this.monthlyRevenue.set(monthlyRevenue || []);

        this.revenueData.set({
          totalRevenue: Number(overview?.totalRevenue || 0),
          completedSessionsRevenue: Number(overview?.totalRevenue || 0),
          canceledSessionsRevenue: cancelledSessions,
          scheduledSessionsRevenue: scheduledSessions,
          periodRevenue: revenue?.periodRevenue || [],
          clientRevenue: revenue?.clientRevenue ?? []
        });

        if (showLoader) {
          this.isLoading.set(false);
        }
      },
      error: (error) => {
        if (!environment.production) { console.error('Error loading dashboard data:', error); }
        if (showLoader) {
          this.isLoading.set(false);
        }
      }
    });
  }
  // ── Pending (self-registered, not yet approved) accounts ────
  pendingAccounts = signal<Array<{ id: number; name: string; email: string; phone?: string; createdAt: string }>>([]);
  approvingUserId = signal<number | null>(null);
  rejectingUserId = signal<number | null>(null);

  transformAdminUsers(apiUsers: any[]): User[] {
    const pending = (apiUsers || [])
      .filter((u) => {
        const r = (u?.role || '').toLowerCase();
        return r !== 'admin' && r !== 'coach' && u?.isActive !== false && u?.isApproved === false;
      })
      .map((u: any) => ({ id: Number(u.id), name: u.fullName || u.email, email: u.email, phone: u.phone, createdAt: u.createdAt }));
    this.pendingAccounts.set(pending);

    const coaches: AdminCoachRow[] = (apiUsers || [])
      .filter((u) => (u?.role || '').toLowerCase() === 'coach' && u?.isActive !== false)
      .map((u: any) => ({
        id: String(u.id),
        name: u.fullName || u.email || 'Coach',
        email: u.email || '',
        phone: u.phone ?? undefined,
        username: u.username ?? undefined
      }));
    this.adminDashboardCoaches.set(coaches);

    return (apiUsers || [])
      .filter((u) => {
        const r = (u?.role || '').toLowerCase();
        return r !== 'admin' && r !== 'coach' && u?.isActive !== false && u?.isApproved !== false;
      })
      .map((u) => ({
        id: String(u.id),
        email: u.email || '',
        name: u.fullName || u.email || 'Client',
        phone: u.phone ?? undefined,
        username: u.username ?? undefined,
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

  coachRowToUser(row: AdminCoachRow): User {
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      phone: row.phone,
      username: row.username,
      role: 'user',
      children: [],
      quizResults: []
    };
  }

  openEditCoachModal(coach: AdminCoachRow): void {
    this.openEditClientModal(this.coachRowToUser(coach));
  }

  getFilteredCoaches(): AdminCoachRow[] {
    const q = this.coachSearch().trim().toLowerCase();
    const rows = this.adminDashboardCoaches();
    if (!q) return rows;
    return rows.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.username && c.username.toLowerCase().includes(q))
    );
  }

  whatsAppUrl(phone?: string): string | null {
    const digits = (phone || '').replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : null;
  }

  approvePendingAccount(userId: number): void {
    this.approvingUserId.set(userId);
    this.apiService.approveUser(userId).subscribe({
      next: () => {
        this.approvingUserId.set(null);
        this.pendingAccounts.update(list => list.filter(a => a.id !== userId));
        this.loadDataFromApi();
      },
      error: () => this.approvingUserId.set(null)
    });
  }

  rejectPendingAccount(userId: number): void {
    if (!confirm('Reject this account? The registration will be permanently deleted.')) return;
    this.rejectingUserId.set(userId);
    this.apiService.rejectPendingUser(userId).subscribe({
      next: () => {
        this.rejectingUserId.set(null);
        this.pendingAccounts.update(list => list.filter(a => a.id !== userId));
      },
      error: () => this.rejectingUserId.set(null)
    });
  }

  deletingLeadId = signal<number | null>(null);

  deleteLead(leadId: number, kind: 'booking' | 'contact' = 'booking'): void {
    const msg =
      kind === 'contact'
        ? 'Delete this contact message? This cannot be undone.'
        : 'Delete this booking request? This cannot be undone.';
    if (!confirm(msg)) return;
    this.deletingLeadId.set(leadId);
    this.apiService.deleteLead(leadId).subscribe({
      next: () => {
        this.deletingLeadId.set(null);
        this.leads.update(list => list.filter(l => l.id !== leadId));
      },
      error: () => this.deletingLeadId.set(null)
    });
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

  markPhotoMissing(childId: string): void {
    this.missingPhotos.update((current) => {
      const next = new Set(current);
      next.add(childId);
      return next;
    });
  }

  toggleSkillAccordion(childId: string, level: number): void {
    const prev = this.expandedSkillSectionsByChildId();
    const set = new Set(prev[childId] ?? []);
    if (set.has(level)) set.delete(level);
    else set.add(level);
    this.expandedSkillSectionsByChildId.set({ ...prev, [childId]: set });
  }

  skillAccordionExpanded(childId: string, level: number): boolean {
    return this.expandedSkillSectionsByChildId()[childId]?.has(level) ?? false;
  }

  skillSectionHeading(level: number): string {
    if (level <= 2) return 'Beginner skills';
    if (level === 3) return 'Intermediate skills';
    return 'Advanced skills';
  }

  skillHeaderTone(level: number): 'beginner' | 'intermediate' | 'advanced' {
    if (level <= 2) return 'beginner';
    if (level === 3) return 'intermediate';
    return 'advanced';
  }

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
        if (!environment.production) { console.error('Failed to update skill:', err); }
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
        price: session.price || 50,
        isPaid: false
      }).subscribe({
        next: () => {
          this.loadDataFromApi(false);
          this.closeSessionForm();
          this.isLoading.set(false);
        },
        error: (error) => {
          if (!environment.production) { console.error('Failed to create session:', error); }
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
        if (!environment.production) { console.error('Failed to update session status:', error); }
        this.isLoading.set(false);
      }
    });
  }

  openAttendanceForm(sessionId: string): void {
    const session = this.sessions().find(s => s.id === sessionId);
    if (session) {
      const regRow = this.attendance().find(
        (r) => r.sessionId === session.id && r.childId === session.childId
      );
      this.newAttendance = {
        sessionId: session.id,
        childId: session.childId,
        childName: session.childName,
        clientId: session.clientId,
        clientName: session.clientName,
        date: session.date,
        status: regRow?.status && regRow.status !== 'absent' ? regRow.status : 'present',
        checkInTime: session.time,
        registrationId: regRow?.id
      };
      this.showAttendanceForm.set(true);
    }
  }

  closeAttendanceForm(): void {
    this.showAttendanceForm.set(false);
  }

  saveAttendance(): void {
    const attendance = this.newAttendance;
    if (!attendance.sessionId || !attendance.childId || !attendance.date) {
      return;
    }
    // API stores present vs absent only; late/excused count as attended for stats.
    const attended = attendance.status !== 'absent';
    this.isLoading.set(true);

    const finish = (): void => {
      this.loadDataFromApi(false);
      this.closeAttendanceForm();
      this.isLoading.set(false);
    };
    const onErr = (error: unknown): void => {
      if (!environment.production) {
        console.error('Failed to save attendance:', error);
      }
      this.isLoading.set(false);
    };

    if (attendance.registrationId) {
      this.attendanceService.markAttendance(attendance.registrationId, attended).subscribe({
        next: () => finish(),
        error: onErr
      });
      return;
    }

    this.attendanceService
      .registerForSession(attendance.sessionId, attendance.childId)
      .pipe(switchMap((reg) => this.attendanceService.markAttendance(reg.id, attended)))
      .subscribe({
        next: () => finish(),
        error: onErr
      });
  }

  recordAdminPayment(): void {
    const uid = this.paymentUserId?.trim();
    const amt = this.paymentAmount;
    if (!uid || amt == null || amt <= 0) {
      this.paymentMessage.set('Choose a client and enter an amount greater than zero.');
      return;
    }
    this.paymentSaving.set(true);
    this.paymentMessage.set('');
    this.revenueService
      .processPayment(amt, this.paymentMethod, uid, this.paymentDate || undefined, this.paymentReference?.trim() || undefined)
      .subscribe({
        next: () => {
          this.paymentSaving.set(false);
          this.paymentMessage.set('Payment saved.');
          this.paymentAmount = null;
          this.paymentReference = '';
          this.loadDataFromApi(false);
        },
        error: () => {
          this.paymentSaving.set(false);
          this.paymentMessage.set('Could not save payment. Ensure you are logged in as admin and the API is running.');
        }
      });
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

  approveBooking(id: number): void {
    this.bookingActionError.set('');
    this.processingBookingId.set(id);
    this.apiService.approveBooking(id).subscribe({
      next: () => {
        this.pendingBookings.update(list => list.filter(b => b.id !== id));
        this.processingBookingId.set(null);
      },
      error: (err: { error?: { message?: string } }) => {
        this.processingBookingId.set(null);
        this.bookingActionError.set(err?.error?.message || 'Could not approve booking.');
      }
    });
  }

  rejectBooking(id: number): void {
    this.bookingActionError.set('');
    this.processingBookingId.set(id);
    this.apiService.rejectBooking(id).subscribe({
      next: () => {
        this.pendingBookings.update(list => list.filter(b => b.id !== id));
        this.processingBookingId.set(null);
      },
      error: (err: { error?: { message?: string } }) => {
        this.processingBookingId.set(null);
        this.bookingActionError.set(err?.error?.message || 'Could not reject booking.');
      }
    });
  }

  onlineCheckoutPending(booking: { onlinePayment?: { status: string } | null }): boolean {
    return booking.onlinePayment?.status === 'Pending';
  }

  getBookingPaymentState(id: number): 'idle' | 'recording' | 'done' {
    return this.bookingPaymentState()[id] ?? 'idle';
  }

  recordBookingPayment(booking: { id: number; client: { id: number; fullName: string }; onlinePayment?: { status: string } | null }): void {
    if (booking.onlinePayment?.status === 'Pending')
      return;
    const method = this.bookingPaymentMethod[booking.id] || 'Cash';
    this.bookingPaymentState.update(s => ({ ...s, [booking.id]: 'recording' }));
    this.revenueService.processPayment(30, method, String(booking.client.id)).subscribe({
      next: () => this.bookingPaymentState.update(s => ({ ...s, [booking.id]: 'done' })),
      error: () => this.bookingPaymentState.update(s => ({ ...s, [booking.id]: 'idle' }))
    });
  }

  formatBookingTime(startTime: string, endTime: string): string {
    const s = new Date(startTime);
    const e = new Date(endTime);
    return `${s.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}–${e.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
  }

  isProcessingBooking(id: number): boolean {
    return this.processingBookingId() === id;
  }

  createAccountFromLead(lead: { id: number; name: string; email?: string | null; phone?: string | null; sourceAction?: string | null }): void {
    const params: Record<string, string> = { prefillName: lead.name };
    if (lead.email) params['prefillEmail'] = lead.email;
    if (lead.phone) params['prefillPhone'] = lead.phone;
    params['leadId'] = String(lead.id);

    // Parse child info from booking request message
    const child = this.parseChildFromAction(lead.sourceAction);
    if (child.name)  params['prefillChildName']  = child.name;
    if (child.age)   params['prefillChildAge']   = child.age;
    if (child.level) params['prefillChildLevel'] = child.level;

    this.router.navigate(['/admin/users'], { queryParams: params });
  }

  private parseChildFromAction(action?: string | null): { name?: string; age?: string; level?: string } {
    if (!action?.startsWith('Booking Request')) return {};
    const nameMatch  = /Child:\s*([^,]+)/.exec(action);
    const ageMatch   = /Age:\s*(\d+)/.exec(action);
    const levelMatch = /Level:\s*([^,]+?)(?:,\s*Session|$)/.exec(action);
    return {
      name:  nameMatch?.[1]?.trim(),
      age:   ageMatch?.[1]?.trim(),
      level: levelMatch?.[1]?.trim()
    };
  }

  // ── Create Client (in dashboard) ─────────────────────────────
  openCreateClientModal(): void {
    this.createClientForm = { fullName: '', email: '', phone: '', password: '', childName: '', childAge: '', childLevel: '' };
    this.showCreateClientPw = false;
    this.createClientError.set('');
    this.createClientResult.set(null);
    this.showCreateClientModal.set(true);
  }

  closeCreateClientModal(): void {
    this.showCreateClientModal.set(false);
    if (this.createClientResult()) this.loadDataFromApi();
  }

  generateCreateClientPw(): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
    this.createClientForm.password = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    this.showCreateClientPw = true;
  }

  submitCreateClient(): void {
    if (!this.createClientForm.fullName.trim() || !this.createClientForm.email.trim()) {
      this.createClientError.set('Full name and email are required.');
      return;
    }
    this.createClientLoading.set(true);
    this.createClientError.set('');
    this.apiService.createClientAccount({
      fullName:   this.createClientForm.fullName.trim(),
      email:      this.createClientForm.email.trim(),
      phone:      this.createClientForm.phone.trim()      || undefined,
      password:   this.createClientForm.password.trim()   || undefined,
      childName:  this.createClientForm.childName.trim()  || undefined,
      childAge:   this.createClientForm.childAge          ? Number(this.createClientForm.childAge) : undefined,
      childLevel: this.createClientForm.childLevel.trim() || undefined
    }).subscribe({
      next: (res) => {
        this.createClientResult.set(res);
        this.createClientLoading.set(false);
        this.loadDataFromApi();
      },
      error: (err) => {
        this.createClientError.set(err?.message || 'Failed to create account.');
        this.createClientLoading.set(false);
      }
    });
  }

  openCreateCoachModal(): void {
    this.createCoachForm = { fullName: '', email: '', phone: '', password: '' };
    this.showCreateCoachPw = false;
    this.createCoachError.set('');
    this.createCoachResult.set(null);
    this.showCreateCoachModal.set(true);
  }

  closeCreateCoachModal(): void {
    this.showCreateCoachModal.set(false);
    if (this.createCoachResult()) this.loadDataFromApi();
  }

  generateCreateCoachPw(): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
    this.createCoachForm.password = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    this.showCreateCoachPw = true;
  }

  submitCreateCoach(): void {
    if (!this.createCoachForm.fullName.trim() || !this.createCoachForm.email.trim()) {
      this.createCoachError.set('Full name and email are required.');
      return;
    }
    this.createCoachLoading.set(true);
    this.createCoachError.set('');
    this.apiService.createCoachAccount({
      fullName: this.createCoachForm.fullName.trim(),
      email:    this.createCoachForm.email.trim(),
      phone:    this.createCoachForm.phone.trim() || undefined,
      password: this.createCoachForm.password.trim() || undefined
    }).subscribe({
      next: (res) => {
        this.createCoachResult.set(res);
        this.createCoachLoading.set(false);
        this.loadDataFromApi();
      },
      error: (err) => {
        this.createCoachError.set(err?.message || 'Failed to create coach account.');
        this.createCoachLoading.set(false);
      }
    });
  }

  // ── Edit Client ───────────────────────────────────────────────
  openEditClientModal(client: User): void {
    this.editingClientId.set(Number(client.id));
    this.editClientForm = {
      fullName:    client.name  ?? '',
      email:       client.email ?? '',
      phone:       client.phone ?? '',
      newPassword: ''
    };
    this.showEditPw = false;
    this.editClientError.set('');
    this.editClientSuccess.set(false);
    this.editClientSavedPw.set('');
    this.editClientForcedReset.set(false);
    this.showEditClientModal.set(true);
  }

  closeEditClientModal(): void {
    this.showEditClientModal.set(false);
    if (this.editClientSuccess()) this.loadDataFromApi();
  }

  generateEditPw(): void {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%^&*';
    this.editClientForm.newPassword = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    this.showEditPw = true;
  }

  submitEditClient(): void {
    const id = this.editingClientId();
    if (!id) return;
    this.editClientLoading.set(true);
    this.editClientError.set('');
    const savedPw = this.editClientForm.newPassword.trim();
    this.apiService.updateClientProfile(id, {
      fullName:    this.editClientForm.fullName.trim()    || undefined,
      email:       this.editClientForm.email.trim()       || undefined,
      phone:       this.editClientForm.phone,
      newPassword: savedPw || undefined
    }).subscribe({
      next: () => {
        this.editClientSavedPw.set(savedPw);
        this.editClientForcedReset.set(false);
        this.editClientLoading.set(false);
        this.editClientSuccess.set(true);
      },
      error: (err) => {
        this.editClientError.set(err?.message || 'Failed to update profile.');
        this.editClientLoading.set(false);
      }
    });
  }

  setTemporaryPassword(): void {
    const id = this.editingClientId();
    if (!id) return;
    this.editClientLoading.set(true);
    this.editClientError.set('');
    this.apiService.resetUserPassword(id).subscribe({
      next: (res) => {
        this.editClientSavedPw.set(res.temporaryPassword);
        this.editClientForcedReset.set(true);
        this.editClientLoading.set(false);
        this.editClientSuccess.set(true);
      },
      error: (err) => {
        this.editClientError.set(err?.message || 'Could not set a temporary password.');
        this.editClientLoading.set(false);
      }
    });
  }

  // ── Add Child ────────────────────────────────────────────────
  openAddChildModal(client: User): void {
    this.addChildClientId.set(Number(client.id));
    this.addChildClientName.set(client.name);
    this.addChildForm = { name: '', age: '', level: '1' };
    this.addChildError.set('');
    this.addChildSuccess.set(false);
    this.showAddChildModal.set(true);
  }

  closeAddChildModal(): void {
    this.showAddChildModal.set(false);
    if (this.addChildSuccess()) this.loadDataFromApi();
  }

  submitAddChild(): void {
    if (!this.addChildForm.name.trim() || !this.addChildForm.age) {
      this.addChildError.set('Child name and age are required.');
      return;
    }
    this.addChildLoading.set(true);
    this.addChildError.set('');
    this.apiService.createSwimmer({
      name: this.addChildForm.name.trim(),
      age: Number(this.addChildForm.age),
      level: Number(this.addChildForm.level),
      parentUserId: this.addChildClientId()!
    }).subscribe({
      next: () => {
        this.addChildLoading.set(false);
        this.addChildSuccess.set(true);
        this.loadDataFromApi();
      },
      error: (err) => {
        this.addChildError.set(err?.message || 'Failed to add child.');
        this.addChildLoading.set(false);
      }
    });
  }

  copyToClipboardDash(text: string): void {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  toggleLeadContacted(leadId: number, isContacted: boolean): void {
    this.updatingLeadId.set(leadId);
    this.apiService.updateLeadStatus(leadId, isContacted).subscribe({
      next: () => {
        this.leads.update((items) => items.map((l) => (l.id === leadId ? { ...l, isContacted } : l)));
        this.updatingLeadId.set(null);
      },
      error: (err) => {
        if (!environment.production) { console.error('Failed to update lead status', err); }
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

  getMonthlyRevenueTotal(): number {
    return this.monthlyRevenue().reduce((sum, e) => sum + e.total, 0);
  }

  getMonthlyRevenueMax(): number {
    const entries = this.monthlyRevenue();
    return Math.max(...entries.map((e) => e.total), 1);
  }

  getBarPercent(total: number): number {
    const max = this.getMonthlyRevenueMax();
    return Math.round((total / max) * 100);
  }

  getLevelFocus = getLevelFocus;
}
