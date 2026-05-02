import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { SessionService, AvailableSlot } from '../../services/session.service';
import { AuthService } from '../../services/auth.service';
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

@Component({
  selector: 'app-available-sessions',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, MonthNamePipe],
  templateUrl: './available-sessions.component.html',
  styleUrls: ['./available-sessions.component.scss']
})
export class AvailableSessionsComponent implements OnInit {
  days            = signal<SlotDay[]>([]);
  loading         = signal(true);
  errorMessage    = signal('');
  toast           = signal<Toast | null>(null);
  selectedSwimmerId = signal<string>('');

  // Local swimmer list — populated by a lightweight API call (no progress fetch)
  swimmers = signal<SwimmerOption[]>([]);

  constructor(
    private sessionService: SessionService,
    private authService: AuthService,
    private http: HttpClient,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadSwimmers();

    // Also populate from cache immediately to avoid flicker
    const cached = this.authService.currentUser()?.children ?? [];
    if (cached.length > 0) {
      this.swimmers.set(cached.map(c => ({ id: String(c.id), name: c.name, level: c.level })));
      if (cached.length === 1) this.selectedSwimmerId.set(String(cached[0].id));
    }

    this.sessionService.getAvailableSlots(14).subscribe({
      next: (slots) => {
        this.days.set(this.groupByDate(Array.isArray(slots) ? slots : []));
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message || 'Failed to load available slots.');
        this.loading.set(false);
      }
    });
  }

  private loadSwimmers(): void {
    // Lightweight call — only fetches names, NO progress data (avoids the 403 from getSwimmerProgress)
    this.http.get<any[]>(`${environment.apiUrl}/swimmerskills/my`).subscribe({
      next: (list) => {
        const mapped = (list ?? []).map(s => ({ id: String(s.id), name: s.name ?? 'Swimmer', level: s.level as number | undefined }));
        this.swimmers.set(mapped);
        if (mapped.length === 1) this.selectedSwimmerId.set(mapped[0].id);
      },
      error: () => {
        // Silently fall back to cached children if API call fails
        const cached = this.authService.currentUser()?.children ?? [];
        this.swimmers.set(cached.map(c => ({ id: String(c.id), name: c.name, level: c.level })));
        if (cached.length === 1) this.selectedSwimmerId.set(String(cached[0].id));
      }
    });
  }

  book(slot: AvailableSlot): void {
    const swimmerId = Number(this.selectedSwimmerId());
    if (!swimmerId) {
      this.showToast('Please select a swimmer first.', 'error');
      return;
    }

    const swimmer = this.swimmers().find(s => Number(s.id) === swimmerId);

    this.router.navigate(['/checkout'], {
      queryParams: {
        startUtc:    slot.startUtc,
        swimmerId,
        date:        slot.date,
        startLocal:  slot.startLocal,
        endLocal:    slot.endLocal,
        swimmerName: swimmer?.name ?? ''
      }
    });
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
