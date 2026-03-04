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
    <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div class="max-w-md w-full">
        <h2 class="text-center text-2xl font-bold text-gray-900 mb-6">Forgot password</h2>
        @if (success) {
          <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-lg">
            If an account exists with that email, we sent a reset link.
          </div>
          <a routerLink="/login" class="mt-4 block text-center text-primary-600 font-medium">Back to login</a>
        } @else {
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            @if (errorMessage) {
              <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">{{ errorMessage }}</div>
            }
            <div>
              <label for="email" class="block text-sm font-medium text-gray-700">Email</label>
              <input id="email" type="email" formControlName="email" class="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
                placeholder="your@email.com" />
              @if (form.get('email')?.invalid && form.get('email')?.touched) {
                <p class="text-red-600 text-sm mt-1">Valid email is required</p>
              }
            </div>
            <button type="submit" [disabled]="form.invalid || loading"
              class="w-full py-2 px-4 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50">
              {{ loading ? 'Sending...' : 'Send reset link' }}
            </button>
          </form>
          <a routerLink="/login" class="mt-4 block text-center text-primary-600 font-medium">Back to login</a>
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
