import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Session, SessionService } from '../../services/session.service';

@Component({
  selector: 'app-sessions-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sessions-list.component.html',
  styleUrls: ['./sessions-list.component.scss']
})
export class SessionsListComponent implements OnInit {
  sessions: Session[] = [];
  filteredSessions: Session[] = [];
  loading = false;
  errorMessage = '';

  filters = {
    date: '',
    pool: '',
    coach: ''
  };

  constructor(private sessionService: SessionService, private router: Router) {}

  ngOnInit(): void {
    this.loadSessions();
  }

  loadSessions(): void {
    this.loading = true;
    this.sessionService.getSessions().subscribe({
      next: (sessions) => {
        this.sessions = sessions;
        this.applyFilters();
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.message || 'Failed to load sessions';
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    const date = this.filters.date;
    const pool = this.filters.pool.toLowerCase();
    const coach = this.filters.coach.toLowerCase();

    this.filteredSessions = this.sessions.filter((s) => {
      const dateMatch = !date || s.date === date;
      const poolMatch = !pool || (s.notes || '').toLowerCase().includes(`pool:${pool}`);
      const coachMatch = !coach || (s.instructor || '').toLowerCase().includes(coach);
      return dateMatch && poolMatch && coachMatch;
    });
  }

  openSession(id: string): void {
    this.router.navigate(['/sessions', id]);
  }
}
