import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { addWeeks } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { environment } from '../../../environments/environment';
import { ApiService } from '../../services/api.service';
import { AuthService, User } from '../../services/auth.service';
import { Session, SessionService, SessionStatus } from '../../services/session.service';
import { BEIRUT_TZ, formatBeirutWeekRangeLabel, getBeirutWeekDayHeaders, getBeirutWeekIntervalIso } from '../../utils/beirut-week';
import { of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

const GRID_START_HOUR = 7;
const GRID_END_HOUR = 21;
const GRID_MINUTES = (GRID_END_HOUR - GRID_START_HOUR) * 60;

/** Left-axis hour only (12h clock, no am/pm): 7…12, 1…8 for 7:00–20:00 rows. */
function formatHourLabel(h: number): string {
  const x = h % 12;
  return x === 0 ? '12' : String(x);
}

@Component({
  selector: 'app-admin-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './admin-schedule.component.html',
  styleUrls: ['./admin-schedule.component.scss']
})
export class AdminScheduleComponent implements OnInit {
  /** One label per hour row (7am–8pm). */
  hourSlots = Array.from({ length: GRID_END_HOUR - GRID_START_HOUR }, (_, i) => {
    const h = GRID_START_HOUR + i;
    return { h, label: formatHourLabel(h) };
  });

  weekAnchor = signal(new Date());
  sessions = signal<Session[]>([]);
  clients = signal<User[]>([]);
  loading = signal(true);
  error = signal('');
  /** Shown after e.g. weekly repeat success (green banner). */
  scheduleNotice = signal('');
  googleMessage = signal('');
  googleConnected = signal(false);
  googleOAuthReady = signal(false);
  googleCalendarReady = signal(false);
  syncingGoogle = signal(false);

  showModal = signal(false);
  saving = signal(false);

  /** Click a calendar block to edit price, location, cancel, etc. */
  showSessionOptions = signal(false);
  selectedSession = signal<Session | null>(null);
  sessionOptionsSaving = signal(false);
  sessionOptionsForm = {
    price: 0,
    poolLocation: '',
    isPaid: false,
    repeatWeekly: false,
    repeatWeeks: 8
  };

  /** Google-style: this event | this and following | all (in weekly package). */
  showCalendarScopeModal = signal(false);
  calendarScopeHeading = signal('');
  calendarScopeOp = signal<'save' | 'delete' | 'cancel' | 'restore' | null>(null);
  calendarScopePick: 'thisEvent' | 'thisAndFollowing' | 'allEvents' = 'thisEvent';

  form = {
    clientId: '',
    childId: '',
    date: '',
    startTime: '15:00',
    endTime: '15:45',
    price: null as number | null,
    poolLocation: '',
    isPaid: false
  };

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private sessionService: SessionService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  weekLabel = computed(() => formatBeirutWeekRangeLabel(this.weekAnchor()));
  dayHeaders = computed(() => getBeirutWeekDayHeaders(this.weekAnchor()));

  /** API `getSessions({ from, to })` already scopes this week; no second client filter (avoids TZ edge cases). */
  sessionsInWeek = computed(() => this.sessions());

  /** Brief income: paid sessions only, excluding canceled (per your 2C). */
  briefIncome = computed(() =>
    this.sessionsInWeek()
      .filter((s) => s.isPaid && s.status !== 'canceled')
      .reduce((sum, s) => sum + (Number(s.price) || 0), 0)
  );

  canceledInWeek = computed(() => this.sessionsInWeek().filter((s) => s.status === 'canceled'));

  ngOnInit(): void {
    if (!this.authService.isAdmin()) {
      this.router.navigate(['/dashboard']);
      return;
    }
    const q = this.route.snapshot.queryParamMap;
    const err = q.get('googleError');
    const ok = q.get('googleConnected');
    if (err) {
      this.googleMessage.set(err);
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    } else if (ok === '1') {
      this.googleMessage.set('Google Calendar connected. Run “Sync from Google” to import sessions.');
      this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
    }
    this.loadClients();
    this.loadWeek();
    this.loadGoogleStatus();
  }

  loadGoogleStatus(): void {
    this.apiService.getGoogleCalendarStatus().subscribe({
      next: (s) => {
        this.googleConnected.set(!!s.connected);
        this.googleOAuthReady.set(!!s.oauthConfigured);
        this.googleCalendarReady.set(!!s.calendarIdConfigured);
      },
      error: () => {
        this.googleOAuthReady.set(false);
        this.googleCalendarReady.set(false);
      }
    });
  }

  connectGoogleCalendar(): void {
    this.apiService.getGoogleCalendarAuthorizationUrl().subscribe({
      next: (r) => {
        if (r?.url) window.location.href = r.url;
      },
      error: (e) => this.googleMessage.set(e?.message || 'Could not start Google connection.')
    });
  }

  syncFromGoogle(): void {
    this.syncingGoogle.set(true);
    this.googleMessage.set('');
    this.apiService.syncGoogleCalendar().subscribe({
      next: (r) => {
        this.syncingGoogle.set(false);
        const parts = [`Created ${r.created}`, `updated ${r.updated}`, `skipped ${r.skipped}`];
        if (r.cancelledInDb > 0) parts.push(`canceled in app ${r.cancelledInDb}`);
        this.googleMessage.set(`Sync: ${parts.join(', ')}.`);
        if (r.errors?.length) this.googleMessage.update((m) => `${m} ${r.errors.join(' ')}`);
        this.loadGoogleStatus();
        this.loadWeek();
      },
      error: (e) => {
        this.syncingGoogle.set(false);
        this.googleMessage.set(e?.message || 'Sync failed.');
      }
    });
  }

  disconnectGoogle(): void {
    if (!confirm('Disconnect Google Calendar? You can reconnect later.')) return;
    this.apiService.disconnectGoogleCalendar().subscribe({
      next: () => {
        this.googleMessage.set('Disconnected from Google.');
        this.loadGoogleStatus();
      },
      error: (e) => this.googleMessage.set(e?.message || 'Could not disconnect.')
    });
  }

  sessionsForDay(col: number): Session[] {
    return this.sessionsInWeek().filter((s) => this.dayColumn(s) === col);
  }

  loadClients(): void {
    this.apiService.getAdminUsers().subscribe({
      next: (users) => {
        const clients = (users || [])
          .filter((u: { role?: string; isActive?: boolean }) => (u?.role || '').toLowerCase() !== 'admin' && u?.isActive !== false)
          .map((u: any) => ({
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
        this.clients.set(clients);
      },
      error: () => this.clients.set([])
    });
  }

  loadWeek(): void {
    this.loading.set(true);
    this.error.set('');
    const { fromIso, toIso } = getBeirutWeekIntervalIso(this.weekAnchor());
    this.sessionService.getSessions({ from: fromIso, to: toIso }).subscribe({
      next: (rows) => {
        this.sessions.set(rows);
        this.loading.set(false);
      },
      error: (e) => {
        if (!environment.production) console.error(e);
        this.error.set('Could not load sessions.');
        this.loading.set(false);
      }
    });
  }

  prevWeek(): void {
    this.weekAnchor.set(addWeeks(this.weekAnchor(), -1));
    this.loadWeek();
  }

  nextWeek(): void {
    this.weekAnchor.set(addWeeks(this.weekAnchor(), 1));
    this.loadWeek();
  }

  thisWeek(): void {
    this.weekAnchor.set(new Date());
    this.loadWeek();
  }

  openAdd(ymd?: string): void {
    this.form = {
      clientId: '',
      childId: '',
      date: ymd || this.dayHeaders()[0]?.ymd || '',
      startTime: '15:00',
      endTime: '15:45',
      price: null,
      poolLocation: '',
      isPaid: false
    };
    this.showModal.set(true);
  }

  closeModal(): void {
    this.showModal.set(false);
  }

  openSessionOptions(s: Session): void {
    this.selectedSession.set(s);
    this.sessionOptionsForm = {
      price: Number(s.price) || 0,
      poolLocation: s.poolLocation ?? '',
      isPaid: !!s.isPaid,
      repeatWeekly: false,
      repeatWeeks: 8
    };
    this.error.set('');
    this.scheduleNotice.set('');
    this.showSessionOptions.set(true);
  }

  closeSessionOptions(): void {
    this.showSessionOptions.set(false);
    this.selectedSession.set(null);
  }

  saveSessionOptions(): void {
    const s = this.selectedSession();
    if (!s) return;
    const price = Number(this.sessionOptionsForm.price);
    if (Number.isNaN(price) || price < 0) {
      this.error.set('Enter a valid price (0 or more).');
      return;
    }
    if (this.sessionOptionsForm.repeatWeekly) {
      const w = Math.floor(Number(this.sessionOptionsForm.repeatWeeks));
      if (w < 1 || w > 52) {
        this.error.set('Repeat: enter a number of weeks between 1 and 52.');
        return;
      }
    }
    if (s.recurrenceSeriesId && s.status !== 'canceled') {
      this.calendarScopeHeading.set('Apply price, location & paid to');
      this.calendarScopePick = 'thisEvent';
      this.calendarScopeOp.set('save');
      this.showCalendarScopeModal.set(true);
      return;
    }
    this.executeSaveSessionOptions('thisEvent');
  }

  private toUpdateRecurrenceApply(
    scope: 'thisEvent' | 'thisAndFollowing' | 'allEvents'
  ): 'single' | 'thisAndFollowing' | 'allInSeries' {
    if (scope === 'thisEvent') return 'single';
    if (scope === 'thisAndFollowing') return 'thisAndFollowing';
    return 'allInSeries';
  }

  confirmCalendarScope(): void {
    const op = this.calendarScopeOp();
    const scope = this.calendarScopePick;
    this.showCalendarScopeModal.set(false);
    this.calendarScopeOp.set(null);
    if (!op) return;
    if (op === 'save') this.executeSaveSessionOptions(scope);
    else if (op === 'delete') this.executeDeleteAfterScope(scope);
    else if (op === 'cancel') this.executeMarkCanceled(scope);
    else if (op === 'restore') this.executeRestore(scope);
  }

  closeCalendarScopeModal(): void {
    this.showCalendarScopeModal.set(false);
    this.calendarScopeOp.set(null);
  }

  private executeSaveSessionOptions(scope: 'thisEvent' | 'thisAndFollowing' | 'allEvents'): void {
    const s = this.selectedSession();
    if (!s) return;
    const price = Number(this.sessionOptionsForm.price);
    if (Number.isNaN(price) || price < 0) return;
    if (this.sessionOptionsForm.repeatWeekly) {
      const w = Math.floor(Number(this.sessionOptionsForm.repeatWeeks));
      if (w < 1 || w > 52) return;
    }
    const apply = this.toUpdateRecurrenceApply(scope);
    this.sessionOptionsSaving.set(true);
    this.error.set('');
    this.scheduleNotice.set('');
    this.sessionService
      .updateSession(
        s.id,
        {
          price,
          poolLocation: this.sessionOptionsForm.poolLocation.trim() || undefined,
          isPaid: this.sessionOptionsForm.isPaid
        },
        apply
      )
      .pipe(
        switchMap((updated) => {
          if (s.status === 'canceled' || !this.sessionOptionsForm.repeatWeekly) {
            return of({ repeat: null as { created: number; skipped: number } | null });
          }
          const weeks = Math.min(52, Math.max(1, Math.floor(Number(this.sessionOptionsForm.repeatWeeks))));
          return this.sessionService.repeatWeeklySession(updated.id, weeks).pipe(
            map((repeat) => ({ repeat }))
          );
        })
      )
      .subscribe({
        next: ({ repeat }) => {
          this.sessionOptionsSaving.set(false);
          if (repeat) {
            if (repeat.created > 0) {
              this.scheduleNotice.set(
                `Added ${repeat.created} weekly session(s) with the same price and location.` +
                  (repeat.skipped > 0 ? ` ${repeat.skipped} week(s) skipped (already existed).` : '')
              );
            } else if (repeat.skipped > 0) {
              this.scheduleNotice.set(`No new sessions added — ${repeat.skipped} week(s) already had this slot.`);
            }
          }
          this.closeSessionOptions();
          this.loadWeek();
        },
        error: (e: unknown) => {
          this.sessionOptionsSaving.set(false);
          this.error.set(this.apiErrorMessage(e) || 'Could not save session.');
        }
      });
  }

  markSessionCanceledFromOptions(): void {
    const s = this.selectedSession();
    if (!s || s.status === 'canceled') return;
    if (s.recurrenceSeriesId) {
      this.calendarScopeHeading.set('Cancel recurring session');
      this.calendarScopePick = 'thisEvent';
      this.calendarScopeOp.set('cancel');
      this.showCalendarScopeModal.set(true);
      return;
    }
    if (!confirm(`Mark this session as canceled? (${s.childName})`)) return;
    this.executeMarkCanceled('thisEvent');
  }

  private executeMarkCanceled(scope: 'thisEvent' | 'thisAndFollowing' | 'allEvents'): void {
    const s = this.selectedSession();
    if (!s) return;
    this.sessionOptionsSaving.set(true);
    this.error.set('');
    this.sessionService
      .updateSession(s.id, { status: 'canceled' }, this.toUpdateRecurrenceApply(scope))
      .subscribe({
        next: () => {
          this.sessionOptionsSaving.set(false);
          this.closeSessionOptions();
          this.loadWeek();
        },
        error: (e: unknown) => {
          this.sessionOptionsSaving.set(false);
          this.error.set(this.apiErrorMessage(e) || 'Could not cancel.');
        }
      });
  }

  restoreSessionFromOptions(): void {
    const s = this.selectedSession();
    if (!s || s.status !== 'canceled') return;
    if (s.recurrenceSeriesId) {
      this.calendarScopeHeading.set('Restore recurring session');
      this.calendarScopePick = 'thisEvent';
      this.calendarScopeOp.set('restore');
      this.showCalendarScopeModal.set(true);
      return;
    }
    if (!confirm(`Restore this session to scheduled? (${s.childName})`)) return;
    this.executeRestore('thisEvent');
  }

  private executeRestore(scope: 'thisEvent' | 'thisAndFollowing' | 'allEvents'): void {
    const s = this.selectedSession();
    if (!s) return;
    this.sessionOptionsSaving.set(true);
    this.error.set('');
    this.sessionService
      .updateSession(s.id, { status: 'scheduled' }, this.toUpdateRecurrenceApply(scope))
      .subscribe({
        next: (updated) => {
          this.sessionOptionsSaving.set(false);
          this.selectedSession.set(updated);
          this.sessionOptionsForm = {
            price: Number(updated.price) || 0,
            poolLocation: updated.poolLocation ?? '',
            isPaid: !!updated.isPaid,
            repeatWeekly: false,
            repeatWeeks: 8
          };
          this.loadWeek();
        },
        error: (e: unknown) => {
          this.sessionOptionsSaving.set(false);
          this.error.set(this.apiErrorMessage(e) || 'Could not restore session.');
        }
      });
  }

  deleteSessionFromOptions(): void {
    const s = this.selectedSession();
    if (!s || !this.authService.isAdmin()) return;
    if (s.recurrenceSeriesId) {
      this.calendarScopeHeading.set('Delete recurring event');
      this.calendarScopePick = 'thisEvent';
      this.calendarScopeOp.set('delete');
      this.showCalendarScopeModal.set(true);
      return;
    }
    const extra = s.googleEventId ? ' This also removes the event from Google Calendar.' : '';
    if (!confirm(`Delete this session permanently?${extra}`)) return;
    this.executeDeleteAfterScope('thisEvent');
  }

  private executeDeleteAfterScope(scope: 'thisEvent' | 'thisAndFollowing' | 'allEvents'): void {
    const s = this.selectedSession();
    if (!s || !this.authService.isAdmin()) return;
    this.sessionOptionsSaving.set(true);
    this.error.set('');
    this.sessionService.deleteSession(s.id, scope).subscribe({
      next: () => {
        this.sessionOptionsSaving.set(false);
        this.closeSessionOptions();
        this.loadWeek();
      },
      error: (e: unknown) => {
        this.sessionOptionsSaving.set(false);
        this.error.set(this.apiErrorMessage(e) || 'Could not delete.');
      }
    });
  }

  getChildren(): { id: string; name: string }[] {
    const c = this.clients().find((x) => x.id === this.form.clientId);
    return c?.children || [];
  }

  saveSession(): void {
    const client = this.clients().find((x) => x.id === this.form.clientId);
    const child = client?.children.find((ch) => ch.id === this.form.childId);
    if (!client || !child || !this.form.date || !this.form.startTime || !this.form.endTime) {
      return;
    }
    const price = this.form.price;
    if (price == null || price < 0) {
      this.error.set('Enter a valid price (0 or more).');
      return;
    }
    this.saving.set(true);
    this.error.set('');
    this.sessionService
      .createSessionBeirut({
        clientId: client.id,
        clientName: client.name,
        childId: child.id,
        childName: child.name,
        date: this.form.date,
        time: this.form.startTime,
        endTime: this.form.endTime,
        level: child.level,
        status: 'scheduled' as SessionStatus,
        poolLocation: this.form.poolLocation || undefined,
        price,
        isPaid: this.form.isPaid,
        maxSwimmers: 10
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.closeModal();
          this.loadWeek();
        },
        error: (e) => {
          if (!environment.production) console.error(e);
          this.saving.set(false);
          this.error.set('Could not create session.');
        }
      });
  }

  isAdmin(): boolean {
    return this.authService.isAdmin();
  }

  /** Column index 0–6 (Sun–Sat); grid is Sunday-first. */
  dayColumn(s: Session): number {
    if (!s.startTimeUtc) return 0;
    const isoDow = parseInt(formatInTimeZone(new Date(s.startTimeUtc), BEIRUT_TZ, 'i'), 10);
    return isoDow === 7 ? 0 : isoDow;
  }

  /** Top % within [GRID_START_HOUR, GRID_END_HOUR). */
  topPct(s: Session): number {
    if (!s.startTimeUtc) return 0;
    const h = parseInt(formatInTimeZone(new Date(s.startTimeUtc), BEIRUT_TZ, 'H'), 10);
    const m = parseInt(formatInTimeZone(new Date(s.startTimeUtc), BEIRUT_TZ, 'm'), 10);
    const mins = h * 60 + m - GRID_START_HOUR * 60;
    return Math.max(0, Math.min(100, (mins / GRID_MINUTES) * 100));
  }

  heightPct(s: Session): number {
    if (!s.startTimeUtc || !s.endTimeUtc) return (45 / GRID_MINUTES) * 100;
    const a = new Date(s.startTimeUtc).getTime();
    const b = new Date(s.endTimeUtc).getTime();
    const durMin = Math.max(5, (b - a) / 60000);
    return Math.min(100, (durMin / GRID_MINUTES) * 100);
  }

  /**
   * Short sessions get a tiny vertical slice of the grid; a dense one-line row
   * keeps time, price, and location visible instead of clipping under overflow:hidden.
   */
  isCompactBlock(s: Session): boolean {
    return this.heightPct(s) < 5.5;
  }

  /**
   * Informal 12h times, no am/pm, no 24h (e.g. 4-4:45). Asia/Beirut when UTC is known.
   */
  sessionTimeLabel(s: Session): string {
    const hasEnd = !!(s.endTime?.trim() || s.endTimeUtc);
    const start = this.formatInformalClock(s.startTimeUtc, s.time);
    if (!hasEnd) return start;
    const end = this.formatInformalClock(s.endTimeUtc, s.endTime);
    return `${start}-${end}`;
  }

  private formatInformalClock(iso: string | undefined, hmFallback: string | undefined): string {
    if (iso) {
      const d = new Date(iso);
      const H = parseInt(formatInTimeZone(d, BEIRUT_TZ, 'H'), 10);
      const M = parseInt(formatInTimeZone(d, BEIRUT_TZ, 'm'), 10);
      return this.informalHM(H, M);
    }
    return this.formatHmStringInformal(hmFallback);
  }

  /** 1–12 clock: on the hour show hour only; otherwise h:mm. */
  private informalHM(h24: number, minute: number): string {
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const mm = Math.min(59, Math.max(0, minute));
    if (mm === 0) return String(h12);
    return `${h12}:${mm.toString().padStart(2, '0')}`;
  }

  private formatHmStringInformal(hm: string | undefined): string {
    if (!hm?.trim()) return '—';
    const [hStr, mStr = '00'] = hm.trim().split(':');
    const h24 = parseInt(hStr, 10);
    const minute = parseInt((mStr || '0').slice(0, 2), 10) || 0;
    if (Number.isNaN(h24)) return hm.trim();
    return this.informalHM(Math.min(23, Math.max(0, h24)), minute);
  }

  private apiErrorMessage(err: unknown): string {
    if (err && typeof err === 'object' && 'error' in err) {
      const body = (err as { error?: unknown }).error;
      if (body && typeof body === 'object' && body !== null && 'message' in body) {
        const m = (body as { message?: unknown }).message;
        if (typeof m === 'string' && m.trim()) return m;
      }
    }
    if (err instanceof Error && err.message) return err.message;
    return '';
  }

  /** Native tooltip: full summary when hover (esp. when block is clipped). */
  sessionHoverTitle(s: Session): string {
    const parts = [
      s.childName,
      this.sessionTimeLabel(s),
      `$${(Number(s.price) || 0).toFixed(2)}`
    ];
    if (s.poolLocation?.trim()) parts.push(s.poolLocation.trim());
    if (s.clientName?.trim()) parts.push(s.clientName.trim());
    return parts.join(' · ');
  }

}
