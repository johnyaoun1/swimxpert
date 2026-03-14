import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { Session, SessionService } from '../../services/session.service';

const BREADCRUMB_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://swimxpert.com' },
    { '@type': 'ListItem', position: 2, name: 'Sessions', item: 'https://swimxpert.com/sessions' }
  ]
};

@Component({
  selector: 'app-sessions-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './sessions-list.component.html',
  styleUrls: ['./sessions-list.component.scss']
})
export class SessionsListComponent implements OnInit, OnDestroy {
  sessions: Session[] = [];
  filteredSessions: Session[] = [];
  loading = false;
  errorMessage = '';

  filters = {
    date: '',
    pool: '',
    coach: ''
  };

  private breadcrumbScript: HTMLScriptElement | null = null;

  constructor(
    private sessionService: SessionService,
    private router: Router,
    private title: Title,
    private meta: Meta,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    this.title.setTitle('Swimming Sessions | Book Your Class | SwimXpert');
    this.meta.updateTag({
      name: 'description',
      content: 'Browse and book available swimming sessions at SwimXpert Lebanon. Filter by level, date, and location.'
    });
    this.injectBreadcrumbSchema();
    this.loadSessions();
  }

  ngOnDestroy(): void {
    if (this.breadcrumbScript && this.breadcrumbScript.parentNode) {
      this.breadcrumbScript.parentNode.removeChild(this.breadcrumbScript);
      this.breadcrumbScript = null;
    }
  }

  private injectBreadcrumbSchema(): void {
    this.breadcrumbScript = this.document.createElement('script');
    this.breadcrumbScript.type = 'application/ld+json';
    this.breadcrumbScript.textContent = JSON.stringify(BREADCRUMB_JSON_LD);
    this.document.head.appendChild(this.breadcrumbScript);
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
