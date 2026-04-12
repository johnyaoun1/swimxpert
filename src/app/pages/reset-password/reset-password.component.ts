import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="min-h-screen flex items-center justify-center py-12 px-4" style="background:#0a0f1e;">
      <div class="max-w-md w-full">
        <h2 class="text-center text-2xl font-bold text-white mb-6">Reset password</h2>
        @if (success) {
          <div class="rounded-lg px-4 py-3 mb-4" style="background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.3); color:#4ade80;">
            Password reset. You can now log in.
          </div>
          <a routerLink="/login" class="mt-4 block text-center text-primary-400 font-medium">Go to login</a>
        } @else if (!token) {
          <div class="rounded-lg px-4 py-3" style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); color:#f87171;">Invalid reset link.</div>
          <a routerLink="/login" class="mt-4 block text-center text-primary-400 font-medium">Back to login</a>
        } @else {
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            @if (errorMessage) {
              <div class="rounded-lg px-4 py-3" style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); color:#f87171;">{{ errorMessage }}</div>
            }
            <div>
              <label for="newPassword" class="block text-sm font-medium mb-1" style="color:#94a3b8;">New password</label>
              <input id="newPassword" type="password" formControlName="newPassword" class="mt-1 block w-full rounded-lg px-4 py-3" />
              @if (form.get('newPassword')?.invalid && form.get('newPassword')?.touched) {
                <p class="text-red-400 text-sm mt-1">Min 8 characters</p>
              }
            </div>
            <div>
              <label for="confirmPassword" class="block text-sm font-medium mb-1" style="color:#94a3b8;">Confirm password</label>
              <input id="confirmPassword" type="password" formControlName="confirmPassword" class="mt-1 block w-full rounded-lg px-4 py-3" />
              @if (form.get('confirmPassword')?.touched && form.hasError('mismatch')) {
                <p class="text-red-400 text-sm mt-1">Passwords do not match</p>
              }
            </div>
            <button type="submit" [disabled]="form.invalid || loading"
              class="btn-primary w-full disabled:opacity-50">
              {{ loading ? 'Resetting...' : 'Reset password' }}
            </button>
          </form>
        }
      </div>
    </div>
  `
})
export class ResetPasswordComponent {
  form: FormGroup;
  token = '';
  loading = false;
  success = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private api: ApiService
  ) {
    this.token = this.route.snapshot.queryParamMap.get('token') ?? '';
    this.form = this.fb.group(
      {
        newPassword: ['', [Validators.required, Validators.minLength(8)]],
        confirmPassword: ['', Validators.required]
      },
      { validators: (g) => (g.get('newPassword')?.value === g.get('confirmPassword')?.value ? null : { mismatch: true }) }
    );
  }

  onSubmit(): void {
    if (this.form.invalid || !this.token) return;
    this.loading = true;
    this.errorMessage = '';
    this.api.resetPassword(this.token, this.form.get('newPassword')?.value).subscribe({
      next: () => { this.success = true; this.loading = false; },
      error: (e) => {
        this.errorMessage = e?.error?.message || e?.message || 'Reset failed.';
        this.loading = false;
      }
    });
  }
}
