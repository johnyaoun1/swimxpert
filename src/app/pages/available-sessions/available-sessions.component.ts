import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SessionService, AvailableSlot } from '../../services/session.service';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { MonthNamePipe } from '../../pipes/month-name.pipe';
import { environment } from '../../../environments/environment';

interface SlotDay {
  date: string;
  label: string;
  slots: AvailableSlot[];
}

interface Toast {
  message: string;
  type: 'success' | 'error';
}

interface SwimmerOption {
  id: string;
  name: string;
  level?: number;
}

const LF_RESULT_KEY  = 'lf_pending_result';
const GUEST_INFO_KEY = 'guestBookingInfo';

@Component({
  selector: 'app-available-sessions',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MonthNamePipe],
  templateUrl: './available-sessions.component.html',
  styleUrls: ['./available-sessions.component.scss']
})
export class AvailableSessionsComponent implements OnInit {
  days              = signal<SlotDay[]>([]);
  loading           = signal(true);
  errorMessage      = signal('');
  toast             = signal<Toast | null>(null);
  selectedSwimmerId = signal<string>('');
  isLoggedIn        = signal(false);
  swimmers          = signal<SwimmerOption[]>([]);

  // ── Add-swimmer modal (logged-in client with no swimmer yet) ─
  showAddSwimmerModal = signal(false);
  pendingSlot         = signal<AvailableSlot | null>(null);
  addSwimmerForm      = { name: '', age: '', level: '', isAccountHolder: false };
  addingSwimmer       = signal(false);
  addSwimmerError     = signal('');

  // ── Multi-step guest booking request modal ────────────────
  showRequestModal    = signal(false);
  requestStep         = signal<1 | 2 | 3 | 4>(1);
  requestSelectedSlot = signal<AvailableSlot | null>(null);
  requestForm = {
    name: '', email: '', phone: '',
    childName: '', childAge: '', childLevel: ''
  };
  requestLoading  = signal(false);
  requestError    = signal('');
  requestSubmitted = signal(false);
  bookingInProgress = signal(false);

  constructor(
    private sessionService: SessionService,
    private authService: AuthService,
    private apiService: ApiService,
    private http: HttpClient,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.authService.isAuthenticated().subscribe(auth => {
      this.isLoggedIn.set(auth);
      if (auth) this.loadSwimmers();
    });

    const cached = this.authService.currentUser()?.children ?? [];
    if (cached.length > 0) {
      this.swimmers.set(cached.map(c => ({ id: String(c.id), name: c.name, level: c.level })));
      if (cached.length === 1) this.selectedSwimmerId.set(String(cached[0].id));
    }

    this.sessionService.getAvailableSlots(14).subscribe({
      next: (slots) => {
        this.days.set(this.groupByDate(Array.isArray(slots) ? slots : []));
        this.loading.set(false);

        // Auto-open when redirected from level-finder
        this.route.queryParamMap.subscribe(params => {
          if (params.get('startBooking') !== '1') return;
          if (!this.isLoggedIn()) {
            this.openRequestModal();
          } else if (this.swimmers().length === 0) {
            this.openAddSwimmerModal();
          }
        });
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load available slots.');
        this.loading.set(false);
      }
    });
  }

  private loadSwimmers(): void {
    this.http.get<any[]>(`${environment.apiUrl}/swimmerskills/my`).subscribe({
      next: (list) => {
        const mapped = (list ?? []).map(s => ({ id: String(s.id), name: s.name ?? 'Swimmer', level: s.level as number | undefined }));
        this.swimmers.set(mapped);
        if (mapped.length === 1) this.selectedSwimmerId.set(mapped[0].id);
      },
      error: () => {
        const cached = this.authService.currentUser()?.children ?? [];
        this.swimmers.set(cached.map(c => ({ id: String(c.id), name: c.name, level: c.level })));
        if (cached.length === 1) this.selectedSwimmerId.set(String(cached[0].id));
      }
    });
  }

  // ── Logged-in client — request slot (no online payment; staff records payment offline) ──
  bookSlot(slot: AvailableSlot): void {
    if (this.swimmers().length === 0) {
      this.openAddSwimmerModal(slot);
      return;
    }
    const swimmerId = Number(this.selectedSwimmerId());
    if (!swimmerId) {
      this.showToast('Please select a swimmer first.', 'error');
      return;
    }
    if (this.bookingInProgress()) return;

    this.bookingInProgress.set(true);
    this.sessionService.bookSlot(slot.startUtc, swimmerId).subscribe({
      next: (res) => {
        this.bookingInProgress.set(false);
        this.showToast(
          res?.message || 'Booking request submitted. Payment is recorded by staff after you pay in person or by transfer.',
          'success'
        );
        // Refresh slots so the taken time disappears
        this.sessionService.getAvailableSlots(14).subscribe({
          next: (slots) => this.days.set(this.groupByDate(Array.isArray(slots) ? slots : [])),
          error: () => { /* keep current list */ }
        });
      },
      error: (err) => {
        this.bookingInProgress.set(false);
        this.showToast(err?.error?.message || err?.message || 'Could not book this slot. Try another time.', 'error');
      }
    });
  }

  // ── Guest — open 4-step booking request modal ─────────────
  openRequestModal(preSlot?: AvailableSlot): void {
    this.requestError.set('');

    // Read level from level-finder localStorage result
    let preLevel = '';
    const lfStored = localStorage.getItem(LF_RESULT_KEY);
    if (lfStored) {
      try {
        const parsed = JSON.parse(lfStored);
        const num = Number(parsed.determinedLevel ?? 0);
        preLevel = this.numberToLevelLabel(num);
      } catch { /* ignore */ }
    }

    // Restore previously filled info from sessionStorage
    const savedRaw = sessionStorage.getItem(GUEST_INFO_KEY);
    const saved = savedRaw ? (() => { try { return JSON.parse(savedRaw); } catch { return null; } })() : null;

    if (saved?.name) {
      this.requestForm = {
        name:       saved.name      ?? '',
        email:      saved.email     ?? '',
        phone:      saved.phone     ?? '',
        childName:  saved.childName ?? '',
        childAge:   saved.childAge  ?? '',
        childLevel: saved.childLevel || preLevel
      };
    } else {
      this.requestForm = { name: '', email: '', phone: '', childName: '', childAge: '', childLevel: preLevel };
    }

    // Pre-select the slot the guest tapped
    this.requestSelectedSlot.set(preSlot ?? null);

    // If personal+child info already saved AND a specific slot was tapped → jump to step 3
    if (saved?.name && saved?.email && saved?.childName && preSlot) {
      this.requestStep.set(3);
    } else {
      this.requestStep.set(1);
    }

    this.showRequestModal.set(true);
  }

  closeRequestModal(): void {
    this.showRequestModal.set(false);
  }

  nextStep(): void {
    this.requestError.set('');
    const step = this.requestStep();

    if (step === 1) {
      if (!this.requestForm.name.trim()) {
        this.requestError.set('Please enter your full name.');
        return;
      }
      if (!this.requestForm.email.trim()) {
        this.requestError.set('Please enter your email address.');
        return;
      }
      if (!this.requestForm.phone.trim()) {
        this.requestError.set('Please enter your phone number.');
        return;
      }
      this.requestStep.set(2);
    } else if (step === 2) {
      if (!this.requestForm.childName.trim()) {
        this.requestError.set("Please enter the swimmer's full name.");
        return;
      }
      if (!this.requestForm.childAge) {
        this.requestError.set("Please enter the swimmer's age.");
        return;
      }
      // Persist to sessionStorage so step 3 jumps are possible next time
      sessionStorage.setItem(GUEST_INFO_KEY, JSON.stringify({
        name:       this.requestForm.name,
        email:      this.requestForm.email,
        phone:      this.requestForm.phone,
        childName:  this.requestForm.childName,
        childAge:   this.requestForm.childAge,
        childLevel: this.requestForm.childLevel
      }));
      this.requestStep.set(3);
    } else if (step === 3) {
      if (!this.requestSelectedSlot()) {
        this.requestError.set('Please select a session to continue.');
        return;
      }
      this.requestStep.set(4);
    }
  }

  prevStep(): void {
    const step = this.requestStep();
    if (step === 2) this.requestStep.set(1);
    else if (step === 3) this.requestStep.set(2);
    else if (step === 4) this.requestStep.set(3);
  }

  selectSlot(slot: AvailableSlot): void {
    this.requestSelectedSlot.set(slot);
    this.requestError.set('');
  }

  submitGuestRequest(): void {
    const slot = this.requestSelectedSlot();
    if (!slot) {
      this.requestError.set('Please select a session first.');
      this.requestStep.set(3);
      return;
    }

    this.requestLoading.set(true);
    this.requestError.set('');

    const level  = this.requestForm.childLevel || 'Not sure';
    const action = `Booking Request — Swimmer: ${this.requestForm.childName.trim()}, Age: ${this.requestForm.childAge}, Level: ${level}, Session: ${slot.date} ${slot.startLocal}`;

    this.http.post(`${environment.apiUrl}/leads/capture`, {
      name:         this.requestForm.name.trim(),
      email:        this.requestForm.email.trim(),
      phone:        this.requestForm.phone.trim() || undefined,
      sourcePage:   'sessions/available',
      sourceAction: action.slice(0, 200)
    }).subscribe({
      next: () => {
        this.requestLoading.set(false);
        this.requestSubmitted.set(true);
        // Clear saved info — request is complete
        sessionStorage.removeItem(GUEST_INFO_KEY);
      },
      error: (err) => {
        this.requestError.set(err?.error?.message || 'Something went wrong. Please try again.');
        this.requestLoading.set(false);
      }
    });
  }

  // ── Add-swimmer modal methods ─────────────────────────────
  openAddSwimmerModal(slot?: AvailableSlot): void {
    this.pendingSlot.set(slot ?? null);
    this.addSwimmerError.set('');
    // Pre-fill level from level-finder result
    let preLevel = '';
    const lfStored = localStorage.getItem(LF_RESULT_KEY);
    if (lfStored) {
      try {
        const parsed = JSON.parse(lfStored);
        preLevel = this.numberToLevelLabel(Number(parsed.determinedLevel ?? 0));
      } catch { /* ignore */ }
    }
    this.addSwimmerForm = { name: '', age: '', level: preLevel, isAccountHolder: false };
    this.showAddSwimmerModal.set(true);
  }

  closeAddSwimmerModal(): void {
    this.showAddSwimmerModal.set(false);
    this.pendingSlot.set(null);
  }

  onAddSwimmerAccountHolderToggle(): void {
    if (this.addSwimmerForm.isAccountHolder) {
      const u = this.authService.currentUser();
      if (u?.name) this.addSwimmerForm.name = u.name;
    }
  }

  saveSwimmerAndBook(): void {
    this.addSwimmerError.set('');
    if (!this.addSwimmerForm.name.trim()) {
      this.addSwimmerError.set('Please enter a name.');
      return;
    }
    const age = Number(this.addSwimmerForm.age);
    if (!age || age < 1 || age > 100) {
      this.addSwimmerError.set('Please enter a valid age (1–100).');
      return;
    }
    const levelMap: Record<string, number> = { Beginner: 1, Intermediate: 2, Advanced: 3, Elite: 4 };
    const levelNum = levelMap[this.addSwimmerForm.level] ?? 1;

    this.addingSwimmer.set(true);
    this.apiService.createSwimmer({
      name: this.addSwimmerForm.name.trim(),
      age,
      level: levelNum,
      isAccountHolder: !!this.addSwimmerForm.isAccountHolder
    }).subscribe({
      next: (swimmer: any) => {
        const newSwimmer: SwimmerOption = {
          id: String(swimmer.id),
          name: swimmer.name ?? this.addSwimmerForm.name.trim(),
          level: swimmer.level ?? levelNum
        };
        this.swimmers.update(list => [...list, newSwimmer]);
        this.selectedSwimmerId.set(newSwimmer.id);
        this.addingSwimmer.set(false);
        this.showAddSwimmerModal.set(false);

        // If a slot was pending, book it now
        const slot = this.pendingSlot();
        if (slot) {
          this.pendingSlot.set(null);
          this.bookSlot(slot);
        }
      },
      error: (err: any) => {
        this.addingSwimmer.set(false);
        this.addSwimmerError.set(err?.error?.message || 'Failed to save. Please try again.');
      }
    });
  }

  // ── Helpers ───────────────────────────────────────────────
  private numberToLevelLabel(n: number): string {
    const map: Record<number, string> = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced', 4: 'Elite' };
    return map[n] ?? '';
  }

  private groupByDate(slots: AvailableSlot[]): SlotDay[] {
    const map = new Map<string, AvailableSlot[]>();
    for (const s of slots) {
      if (!map.has(s.date)) map.set(s.date, []);
      map.get(s.date)!.push(s);
    }
    const today    = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    return Array.from(map.entries()).map(([date, daySlots]) => ({
      date,
      label: this.formatDayLabel(date, today, tomorrow),
      slots: daySlots
    }));
  }

  formatDayLabel(date: string, today?: string, tomorrow?: string): string {
    const t  = today    ?? new Date().toISOString().split('T')[0];
    const tm = tomorrow ?? new Date(Date.now() + 86400000).toISOString().split('T')[0];
    const d  = new Date(date + 'T00:00:00');
    const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
    const short   = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    if (date === t)  return `Today — ${short}`;
    if (date === tm) return `Tomorrow — ${short}`;
    return `${weekday} — ${short}`;
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    this.toast.set({ message, type });
    setTimeout(() => this.toast.set(null), 4500);
  }
}
