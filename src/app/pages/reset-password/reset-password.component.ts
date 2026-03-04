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
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div class="max-w-md w-full">
        <h2 class="text-center text-2xl font-bold text-gray-900 mb-6">Reset password</h2>
        @if (success) {
          <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
            Password reset. You can now log in.
          </div>
          <a routerLink="/login" class="mt-4 block text-center text-primary-600 font-medium">Go to login</a>
        } @else if (!token) {
          <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">Invalid reset link.</div>
          <a routerLink="/login" class="mt-4 block text-center text-primary-600 font-medium">Back to login</a>
        } @else {
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            @if (errorMessage) {
              <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">{{ errorMessage }}</div>
            }
            <div>
              <label for="newPassword" class="block text-sm font-medium text-gray-700">New password</label>
              <input id="newPassword" type="password" formControlName="newPassword" class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              @if (form.get('newPassword')?.invalid && form.get('newPassword')?.touched) {
                <p class="text-red-600 text-sm mt-1">Min 8 characters</p>
              }
            </div>
            <div>
              <label for="confirmPassword" class="block text-sm font-medium text-gray-700">Confirm password</label>
              <input id="confirmPassword" type="password" formControlName="confirmPassword" class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2" />
              @if (form.get('confirmPassword')?.touched && form.hasError('mismatch')) {
                <p class="text-red-600 text-sm mt-1">Passwords do not match</p>
              }
            </div>
            <button type="submit" [disabled]="form.invalid || loading"
              class="w-full py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
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
