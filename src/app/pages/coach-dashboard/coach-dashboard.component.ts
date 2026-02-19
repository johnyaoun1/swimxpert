import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Session, SessionService } from '../../services/session.service';
import { AttendanceService } from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-coach-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './coach-dashboard.component.html',
  styleUrls: ['./coach-dashboard.component.scss']
})
export class CoachDashboardComponent implements OnInit {
  sessions: Session[] = [];
  loading = false;
  errorMessage = '';

  constructor(
    private sessionService: SessionService,
    private attendanceService: AttendanceService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.loading = true;
    const coachName = this.authService.getCurrentUser()?.name?.toLowerCase() || '';

    this.sessionService.getUpcomingSessions().subscribe({
      next: (sessions) => {
        this.sessions = coachName ? sessions.filter((s) => (s.instructor || '').toLowerCase().includes(coachName)) : sessions;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.message || 'Failed to load coach sessions';
        this.loading = false;
      }
    });
  }

  markAttendance(sessionId: string): void {
    this.attendanceService.getSessionAttendees(sessionId).subscribe({
      next: (rows) => {
        rows.forEach((r) => {
          this.attendanceService.markAttendance(r.id, true).subscribe();
        });
      }
    });
  }
}
