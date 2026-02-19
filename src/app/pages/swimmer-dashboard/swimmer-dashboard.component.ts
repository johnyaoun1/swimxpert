import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Attendance, AttendanceService } from '../../services/attendance.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-swimmer-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './swimmer-dashboard.component.html',
  styleUrls: ['./swimmer-dashboard.component.scss']
})
export class SwimmerDashboardComponent implements OnInit {
  registrations: Attendance[] = [];
  loading = false;
  errorMessage = '';

  constructor(private attendanceService: AttendanceService, private authService: AuthService) {}

  ngOnInit(): void {
    const userId = this.authService.getCurrentUser()?.id;
    if (!userId) return;

    this.loading = true;
    this.attendanceService.getMySessions(userId).subscribe({
      next: (rows) => {
        const now = new Date();
        this.registrations = rows.filter((r) => new Date(r.date) >= now);
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.message || 'Failed to load sessions';
        this.loading = false;
      }
    });
  }

  cancelRegistration(id: string): void {
    this.attendanceService.cancelRegistration(id).subscribe({
      next: () => this.registrations = this.registrations.filter((r) => r.id !== id),
      error: (error) => this.errorMessage = error?.message || 'Failed to cancel registration'
    });
  }
}
