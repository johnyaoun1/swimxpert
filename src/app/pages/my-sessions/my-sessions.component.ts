import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Attendance, AttendanceService } from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-my-sessions',
  standalone: true,
  imports: [CommonModule],
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
    const userId = this.authService.getCurrentUser()?.id;
    if (!userId) return;

    this.loading = true;
    this.attendanceService.getMySessions(userId).subscribe({
      next: (rows) => {
        const today = new Date();
        this.futureSessions = rows.filter((r) => new Date(r.date) >= today);
        this.pastSessions = rows.filter((r) => new Date(r.date) < today);
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.message || 'Failed to load sessions';
        this.loading = false;
      }
    });
  }

  cancel(id: string): void {
    this.attendanceService.cancelRegistration(id).subscribe({
      next: () => this.futureSessions = this.futureSessions.filter((s) => s.id !== id),
      error: (error) => this.errorMessage = error?.message || 'Failed to cancel'
    });
  }
}
