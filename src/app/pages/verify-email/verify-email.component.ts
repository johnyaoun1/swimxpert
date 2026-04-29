import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen flex items-center justify-center py-12 px-4" style="background:#0a0f1e;">
      <div class="max-w-md w-full text-center">
        @if (loading) {
          <p style="color:#94a3b8;">Verifying your email...</p>
        } @else if (success) {
          <div class="rounded-lg px-4 py-3 mb-4" style="background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.3); color:#4ade80;">
            {{ message }}
          </div>
          <a routerLink="/login" class="mt-4 inline-block text-primary-400 font-medium">Go to login</a>
        } @else if (error) {
          <div class="rounded-lg px-4 py-3" style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); color:#f87171;">
            {{ error }}
          </div>
          <a routerLink="/login" class="mt-4 inline-block text-primary-400 font-medium">Back to login</a>
        }
      </div>
    </div>
  `
})
export class VerifyEmailComponent {
  loading = true;
  success = false;
  error = '';
  message = '';

  constructor(
    private route: ActivatedRoute,
    private apiService: ApiService
  ) {}

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) {
      this.loading = false;
      this.error = 'Verification token is missing.';
      return;
    }
    this.apiService.verifyEmail(token).subscribe({
      next: (res) => {
        this.loading = false;
        this.success = true;
        this.message = res?.message || 'Email verified. You can now log in.';
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || err?.message || 'Invalid or expired verification link.';
      }
    });
  }
}
