import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="min-h-screen flex items-center justify-center py-12 px-4" style="background:#0a0f1e;">
      <div class="max-w-md w-full">
        <h2 class="text-center text-2xl font-bold text-white mb-6">Forgot password</h2>
        @if (success) {
          <div class="rounded-lg px-4 py-3" style="background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.3); color:#4ade80;">
            If an account exists with that email, we sent a reset link.
          </div>
          <a routerLink="/login" class="mt-4 block text-center text-primary-400 font-medium">Back to login</a>
        } @else {
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            @if (errorMessage) {
              <div class="rounded-lg px-4 py-3" style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); color:#f87171;">{{ errorMessage }}</div>
            }
            <div>
              <label for="email" class="block text-sm font-medium mb-1" style="color:#94a3b8;">Email</label>
              <input id="email" type="email" formControlName="email" class="mt-1 block w-full rounded-lg px-4 py-3"
                placeholder="your@email.com" />
              @if (form.get('email')?.invalid && form.get('email')?.touched) {
                <p class="text-red-400 text-sm mt-1">Valid email is required</p>
              }
            </div>
            <button type="submit" [disabled]="form.invalid || loading"
              class="btn-primary w-full disabled:opacity-50">
              {{ loading ? 'Sending...' : 'Send reset link' }}
            </button>
          </form>
          <a routerLink="/login" class="mt-4 block text-center text-primary-400 font-medium">Back to login</a>
        }
      </div>
    </div>
  `
})
export class ForgotPasswordComponent {
  form: FormGroup;
  loading = false;
  success = false;
  errorMessage = '';

  constructor(private fb: FormBuilder, private api: ApiService) {
    this.form = this.fb.group({ email: ['', [Validators.required, Validators.email]] });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';
    this.api.forgotPassword(this.form.get('email')?.value).subscribe({
      next: () => { this.success = true; this.loading = false; },
      error: () => { this.errorMessage = 'Something went wrong. Try again.'; this.loading = false; }
    });
  }
}
