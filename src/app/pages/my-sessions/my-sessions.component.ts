import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Attendance, AttendanceService } from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-my-sessions',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './my-sessions.component.html',
  styleUrls: ['./my-sessions.component.scss']
})
export class MySessionsComponent implements OnInit {
  futureSessions: Attendance[] = [];
  pastSessions: Attendance[] = [];
  loading = false;
  errorMessage = '';

  constructor(private attendanceService: AttendanceService, private authService: AuthService) {}

  ngOnInit(): void {
    const children = this.authService.getCurrentUser()?.children ?? [];
    if (children.length === 0) {
      return;
    }

    this.loading = true;

    const requests = children.map((child) =>
      this.attendanceService.getMySessions(child.id).pipe(catchError(() => of([] as Attendance[])))
    );

    forkJoin(requests).subscribe({
      next: (results) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const all = results.flat();
        // Deduplicate by registration ID
        const seen = new Set<string>();
        const unique = all.filter((r) => {
          if (seen.has(r.id)) return false;
          seen.add(r.id);
          return true;
        });
        this.futureSessions = unique
          .filter((r) => new Date(r.date) >= today)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        this.pastSessions = unique
          .filter((r) => new Date(r.date) < today)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Failed to load sessions.';
        this.loading = false;
      }
    });
  }

  cancel(id: string): void {
    this.attendanceService.cancelRegistration(id).subscribe({
      next: () => this.futureSessions = this.futureSessions.filter((s) => s.id !== id),
      error: (error) => this.errorMessage = error?.error?.message || error?.message || 'Failed to cancel'
    });
  }
}
