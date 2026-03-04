import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div class="max-w-md w-full text-center">
        @if (loading) {
          <p class="text-gray-600">Verifying your email...</p>
        } @else if (success) {
          <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
            {{ message }}
          </div>
          <a routerLink="/login" class="mt-4 inline-block text-primary-600 font-medium">Go to login</a>
        } @else if (error) {
          <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
            {{ error }}
          </div>
          <a routerLink="/login" class="mt-4 inline-block text-primary-600 font-medium">Back to login</a>
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
