import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

interface CoachSession {
  id: number;
  title: string;
  date: string;
  time: string;
  endTime: string;
  startTimeUtc: string;
  endTimeUtc: string;
  poolLocation: string | null;
  status: string;
  price: number;
  isPaid: boolean;
  coachAccepted: boolean | null;
  coachDeclineReason?: string | null;
}

interface RevenueStats {
  totalRevenue: number;
  acceptedCount: number;
  pendingCount: number;
}

// Beirut is UTC+3
const BEIRUT_OFFSET_MS = 3 * 60 * 60 * 1000;

function toBeirutDate(isoUtc: string): Date {
  return new Date(new Date(isoUtc).getTime() + BEIRUT_OFFSET_MS);
}

function startOfBeirutWeek(anchor: Date): Date {
  const d = new Date(anchor);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

@Component({
  selector: 'app-coach-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './coach-dashboard.component.html',
  styleUrls: ['./coach-dashboard.component.scss']
})
export class CoachDashboardComponent implements OnInit {
  private readonly api = environment.apiUrl;

  sessions = signal<CoachSession[]>([]);
  revenue  = signal<RevenueStats>({ totalRevenue: 0, acceptedCount: 0, pendingCount: 0 });
  loading  = signal(true);
  error    = signal('');

  // Calendar
  weekAnchor = signal<Date>(new Date());

  dayHeaders = computed(() => {
    const monday = startOfBeirutWeek(this.weekAnchor());
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return {
        label: days[d.getDay()],
        dateNum: d.getDate(),
        ymd: d.toISOString().split('T')[0],
        isToday: d.toDateString() === new Date().toDateString()
      };
    });
  });

  timeLabels = Array.from({ length: 13 }, (_, i) => {
    const h = i + 8;
    return h < 10 ? `0${h}:00` : `${h}:00`;
  }); // 08:00 – 20:00

  readonly SCHED_START_H = 8;
  readonly SCHED_END_H   = 21;

  sessionsInWeek = computed(() => {
    const headers = this.dayHeaders();
    const first = headers[0].ymd;
    const last  = headers[6].ymd;
    return this.sessions().filter((s) => s.date >= first && s.date <= last);
  });

  sessionsForDay(col: number): CoachSession[] {
    return this.sessionsInWeek().filter((s) => {
      const colYmd = this.dayHeaders()[col]?.ymd;
      return s.date === colYmd;
    });
  }

  topPct(s: CoachSession): number {
    const d = toBeirutDate(s.startTimeUtc);
    const mins = d.getHours() * 60 + d.getMinutes();
    const startMins = this.SCHED_START_H * 60;
    const totalMins = (this.SCHED_END_H - this.SCHED_START_H) * 60;
    return Math.max(0, Math.min(100, ((mins - startMins) / totalMins) * 100));
  }

  heightPct(s: CoachSession): number {
    const start  = toBeirutDate(s.startTimeUtc);
    const end    = toBeirutDate(s.endTimeUtc);
    const durMin = (end.getTime() - start.getTime()) / 60000;
    const totalMins = (this.SCHED_END_H - this.SCHED_START_H) * 60;
    return Math.max(2, Math.min(100, (durMin / totalMins) * 100));
  }

  isCompactBlock(s: CoachSession): boolean {
    return this.heightPct(s) < 8;
  }

  sessionTimeLabel(s: CoachSession): string {
    return `${s.time} – ${s.endTime}`;
  }

  // Selected session panel
  selectedSession = signal<CoachSession | null>(null);
  responding = signal(false);
  responseMsg = signal('');

  showDeclineModal = signal(false);
  declineReasonDraft = '';
  declineModalError = signal('');

  ngOnInit(): void {
    this.loadWeek();
    this.loadRevenue();
  }

  loadWeek(): void {
    this.loading.set(true);
    this.error.set('');
    const headers = this.dayHeaders();
    const from = headers[0].ymd;
    const to   = new Date(new Date(headers[6].ymd).getTime() + 86400000).toISOString().split('T')[0];
    const params = new HttpParams().set('from', from).set('to', to);
    this.http.get<CoachSession[]>(`${this.api}/coach/sessions`, { params }).subscribe({
      next: (rows) => { this.sessions.set(rows); this.loading.set(false); },
      error: (e) => {
        this.error.set(e?.error?.message || 'Failed to load sessions.');
        this.loading.set(false);
      }
    });
  }

  loadRevenue(): void {
    this.http.get<RevenueStats>(`${this.api}/coach/revenue`).subscribe({
      next: (r) => this.revenue.set(r),
      error: () => {}
    });
  }

  prevWeek(): void {
    const d = new Date(this.weekAnchor());
    d.setDate(d.getDate() - 7);
    this.weekAnchor.set(d);
    this.loadWeek();
  }

  nextWeek(): void {
    const d = new Date(this.weekAnchor());
    d.setDate(d.getDate() + 7);
    this.weekAnchor.set(d);
    this.loadWeek();
  }

  goToday(): void {
    this.weekAnchor.set(new Date());
    this.loadWeek();
  }

  openSession(s: CoachSession): void {
    this.selectedSession.set(s);
    this.responding.set(false);
    this.responseMsg.set('');
    this.showDeclineModal.set(false);
    this.declineReasonDraft = '';
    this.declineModalError.set('');
  }

  closePanel(): void {
    this.selectedSession.set(null);
    this.showDeclineModal.set(false);
    this.declineModalError.set('');
  }

  accept(): void {
    const s = this.selectedSession();
    if (!s) return;
    this.responding.set(true);
    this.responseMsg.set('');
    this.http.put<{ coachAccepted: boolean }>(`${this.api}/coach/sessions/${s.id}/accept`, {}).subscribe({
      next: (res) => {
        this.patchSession(s.id, { coachAccepted: res.coachAccepted, coachDeclineReason: null });
        this.responding.set(false);
        this.responseMsg.set('Session accepted!');
        this.loadRevenue();
      },
      error: () => { this.responding.set(false); this.responseMsg.set('Error. Try again.'); }
    });
  }

  openDeclineModal(): void {
    if (!this.selectedSession()) return;
    this.declineReasonDraft = '';
    this.responseMsg.set('');
    this.declineModalError.set('');
    this.showDeclineModal.set(true);
  }

  closeDeclineModal(): void {
    this.showDeclineModal.set(false);
    this.declineModalError.set('');
  }

  submitDecline(): void {
    const s = this.selectedSession();
    if (!s) return;
    const reason = this.declineReasonDraft.trim();
    if (reason.length < 3) {
      this.declineModalError.set('Please enter a reason (at least 3 characters).');
      return;
    }
    this.declineModalError.set('');
    this.responding.set(true);
    this.responseMsg.set('');
    this.http
      .put<{ coachAccepted: boolean; coachDeclineReason?: string | null }>(`${this.api}/coach/sessions/${s.id}/decline`, { reason })
      .subscribe({
        next: (res) => {
          this.patchSession(s.id, {
            coachAccepted: res.coachAccepted,
            coachDeclineReason: res.coachDeclineReason ?? reason
          });
          this.responding.set(false);
          this.showDeclineModal.set(false);
          this.responseMsg.set('Session declined.');
          this.loadRevenue();
        },
        error: (err) => {
          this.responding.set(false);
          const msg = err?.error?.message || 'Could not decline. Try again.';
          this.declineModalError.set(typeof msg === 'string' ? msg : 'Could not decline. Try again.');
        }
      });
  }

  private patchSession(id: number, patch: Partial<CoachSession>): void {
    this.sessions.update((ss) => ss.map((s) => s.id === id ? { ...s, ...patch } : s));
    const sel = this.selectedSession();
    if (sel?.id === id) this.selectedSession.set({ ...sel, ...patch });
  }

  weekLabel = computed(() => {
    const headers = this.dayHeaders();
    const first = headers[0];
    const last  = headers[6];
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const fDate = new Date(first.ymd);
    const lDate = new Date(last.ymd);
    if (fDate.getMonth() === lDate.getMonth())
      return `${months[fDate.getMonth()]} ${first.dateNum}–${last.dateNum}, ${fDate.getFullYear()}`;
    return `${months[fDate.getMonth()]} ${first.dateNum} – ${months[lDate.getMonth()]} ${last.dateNum}, ${lDate.getFullYear()}`;
  });

  sessionStatusClass(s: CoachSession): string {
    if (s.coachAccepted === true)  return 'block--accepted';
    if (s.coachAccepted === false) return 'block--declined';
    return 'block--pending';
  }

  constructor(private http: HttpClient) {}
}
