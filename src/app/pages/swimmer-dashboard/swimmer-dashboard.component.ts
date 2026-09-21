import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { Attendance, AttendanceService } from '../../services/attendance.service';
import { AuthService, Child } from '../../services/auth.service';
import { ProfileSrcPipe } from '../../pipes/profile-src.pipe';
import { getLevelFocus, getChildInitial as swimChildInitial } from '../../utils/swim-utils';

@Component({
  selector: 'app-swimmer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, ProfileSrcPipe],
  templateUrl: './swimmer-dashboard.component.html',
  styleUrls: ['./swimmer-dashboard.component.scss']
})
export class SwimmerDashboardComponent implements OnInit {
  readonly registrationsByChildId = signal<Record<string, Attendance[]>>({});
  readonly expandedLevelsByChildId = signal<Record<string, Set<number>>>({});
  loading = false;
  errorMessage = '';

  readonly ringRadii = { outer: 46, mid: 37, inner: 28 };
  readonly getChildInitial = swimChildInitial;

  constructor(private attendanceService: AttendanceService, public authService: AuthService) {}

  ngOnInit(): void {
    this.loading = true;
    this.authService.syncChildrenFromApi().subscribe({
      next: () => {
        this.loading = false;
        this.loadSessionsForInProgressChildren();
      },
      error: (error) => {
        this.errorMessage = error?.message || 'Failed to load profile';
        this.loading = false;
      }
    });
  }

  private loadSessionsForInProgressChildren(): void {
    const kids = this.filteredChildren();
    if (!kids.length) {
      this.registrationsByChildId.set({});
      return;
    }
    const now = new Date();
    const reqs = kids.map((c) =>
      this.attendanceService.getMySessions(c.id).pipe(
        catchError(() => of([] as Attendance[])),
        map((rows) => ({
          id: c.id,
          rows: rows.filter((r) => new Date(r.date) >= now)
        }))
      )
    );
    forkJoin(reqs).subscribe({
      next: (results) => {
        const rec: Record<string, Attendance[]> = {};
        for (const r of results) rec[r.id] = r.rows;
        this.registrationsByChildId.set(rec);
      },
      error: (error) => {
        this.errorMessage = error?.message || 'Failed to load sessions';
      }
    });
  }

  /** In-progress swimmers only (Level &lt; 4). */
  filteredChildren(): Child[] {
    const kids = this.authService.currentUser()?.children ?? [];
    return kids.filter((c) => (c.level ?? 1) < 4);
  }

  gradientIdSafe(childId: string): string {
    return childId.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  sessionsForChild(childId: string): Attendance[] {
    return this.registrationsByChildId()[childId] ?? [];
  }

  toggleSection(childId: string, level: number): void {
    const prev = this.expandedLevelsByChildId();
    const set = new Set(prev[childId] ?? []);
    if (set.has(level)) set.delete(level);
    else set.add(level);
    this.expandedLevelsByChildId.set({ ...prev, [childId]: set });
  }

  sectionExpanded(childId: string, level: number): boolean {
    return this.expandedLevelsByChildId()[childId]?.has(level) ?? false;
  }

  ringDash(pct: number, r: number): string {
    const c = 2 * Math.PI * r;
    const p = Math.min(100, Math.max(0, pct)) / 100;
    return `${p * c} ${c}`;
  }

  ringStats(child: Child): { beginner: number; intermediate: number; advanced: number } {
    const blocks = child.skillLevels ?? [];
    let begSum = 0;
    let begN = 0;
    let inter = 0;
    let adv = 0;
    for (const b of blocks) {
      if (b.level <= 2) {
        begSum += b.completionPercent;
        begN++;
      } else if (b.level === 3) {
        inter = b.completionPercent;
      } else if (b.level >= 4) {
        adv = Math.max(adv, b.completionPercent);
      }
    }
    return {
      beginner: begN ? Math.round(begSum / begN) : 0,
      intermediate: inter,
      advanced: adv
    };
  }

  sectionHeading(level: number): string {
    if (level <= 2) return 'Beginner skills';
    if (level === 3) return 'Intermediate skills';
    return 'Advanced skills';
  }

  headerTone(level: number): 'beginner' | 'intermediate' | 'advanced' {
    if (level <= 2) return 'beginner';
    if (level === 3) return 'intermediate';
    return 'advanced';
  }

  levelBadgeClass(level: number): string {
    if (level <= 2) return 'aqua-badge aqua-badge--beginner';
    if (level === 3) return 'aqua-badge aqua-badge--intermediate';
    if (level === 4) return 'aqua-badge aqua-badge--advanced';
    return 'aqua-badge aqua-badge--elite';
  }

  levelFocus(child: Child): string {
    return getLevelFocus(child.level);
  }

  cancelRegistration(childId: string, registrationId: string): void {
    this.attendanceService.cancelRegistration(registrationId).subscribe({
      next: () => {
        const prev = this.registrationsByChildId();
        const list = prev[childId] ?? [];
        this.registrationsByChildId.set({
          ...prev,
          [childId]: list.filter((r) => r.id !== registrationId)
        });
      },
      error: (error) => (this.errorMessage = error?.message || 'Failed to cancel registration')
    });
  }

  handleImageError(event: Event, childName: string): void {
    const img = event.target as HTMLImageElement;
    const firstLetter = childName.charAt(0).toUpperCase();
    const svgData = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23e5e7eb' width='100' height='100'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='40'%3E${firstLetter}%3C/text%3E%3C/svg%3E`;
    img.src = svgData;
  }
}
