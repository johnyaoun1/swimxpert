import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Session, SessionService } from '../../services/session.service';
import { Attendance, AttendanceService } from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './session-detail.component.html',
  styleUrls: ['./session-detail.component.scss']
})
export class SessionDetailComponent implements OnInit {
  session: Session | null = null;
  attendees: Attendance[] = [];
  loading = false;
  errorMessage = '';

  constructor(
    private route: ActivatedRoute,
    private sessionService: SessionService,
    private attendanceService: AttendanceService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadSession(id);
      this.loadAttendees(id);
    }
  }

  loadSession(id: string): void {
    this.loading = true;
    this.sessionService.getSessionById(id).subscribe({
      next: (session) => {
        this.session = session;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.message || 'Failed to load session';
        this.loading = false;
      }
    });
  }

  loadAttendees(sessionId: string): void {
    this.attendanceService.getSessionAttendees(sessionId).subscribe({
      next: (attendees) => (this.attendees = attendees),
      error: (error) => (this.errorMessage = error?.message || 'Failed to load attendees')
    });
  }

  register(): void {
    if (!this.session) return;
    const user = this.authService.getCurrentUser();
    if (!user) return;

    this.attendanceService.registerForSession(this.session.id, user.id).subscribe({
      next: () => this.loadAttendees(this.session!.id),
      error: (error) => (this.errorMessage = error?.message || 'Registration failed')
    });
  }

  unregister(registrationId: string): void {
    this.attendanceService.cancelRegistration(registrationId).subscribe({
      next: () => this.loadAttendees(this.session!.id),
      error: (error) => (this.errorMessage = error?.message || 'Unregister failed')
    });
  }

  markAttendance(registrationId: string, present: boolean): void {
    this.attendanceService.markAttendance(registrationId, present).subscribe({
      next: () => this.loadAttendees(this.session!.id),
      error: (error) => (this.errorMessage = error?.message || 'Attendance update failed')
    });
  }

  isCoachOrAdmin(): boolean {
    const role = (this.authService.getCurrentUser()?.role || '').toLowerCase();
    return role === 'admin' || role === 'coach';
  }
}
