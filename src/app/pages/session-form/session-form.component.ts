import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { SessionService } from '../../services/session.service';

@Component({
  selector: 'app-session-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './session-form.component.html',
  styleUrls: ['./session-form.component.scss']
})
export class SessionFormComponent implements OnInit {
  isEdit = false;
  loading = false;
  errorMessage = '';

  form = {
    poolId: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '10:00',
    endTime: '11:00',
    maxSwimmers: 10,
    skillLevel: 1,
    coach: ''
  };

  private sessionId: string | null = null;

  constructor(
    private sessionService: SessionService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.sessionId = this.route.snapshot.paramMap.get('id');
    this.isEdit = !!this.sessionId;

    if (this.sessionId) {
      this.sessionService.getSessionById(this.sessionId).subscribe({
        next: (s) => {
          this.form.date = s.date;
          this.form.startTime = s.time;
          this.form.coach = s.instructor || '';
          this.form.skillLevel = s.level;
          this.form.poolId = s.notes || '';
        },
        error: (error) => (this.errorMessage = error?.message || 'Failed to load session')
      });
    }
  }

  save(): void {
    this.loading = true;
    const payload = {
      childId: '',
      childName: 'Open Session',
      clientId: '',
      clientName: '',
      date: this.form.date,
      time: this.form.startTime,
      level: this.form.skillLevel,
      status: 'scheduled' as const,
      instructor: this.form.coach,
      notes: `pool:${this.form.poolId};end:${this.form.endTime};max:${this.form.maxSwimmers}`,
      price: 0
    };

    const request$ = this.isEdit && this.sessionId
      ? this.sessionService.updateSession(this.sessionId, payload)
      : this.sessionService.createSession(payload);

    request$.subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/sessions']);
      },
      error: (error) => {
        this.errorMessage = error?.message || 'Failed to save session';
        this.loading = false;
      }
    });
  }
}
