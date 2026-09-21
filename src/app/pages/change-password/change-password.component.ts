import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { strongPasswordErrorMessage, strongPasswordValidator } from '../../utils/password-policy';

@Component({
  selector: 'app-change-password',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="min-h-screen flex items-center justify-center py-12 px-4" style="background:#0a0f1e;">
      <div class="max-w-md w-full">
        <h2 class="text-center text-2xl font-bold text-white mb-2">Set a new password</h2>
        <p class="text-center text-sm mb-6" style="color:#94a3b8;">
          @if (auth.currentUser()?.mustChangePassword) {
            Set a new password before continuing.
          } @else {
            Choose a new password for your account.
          }
        </p>
        @if (success) {
          <div class="rounded-lg px-4 py-3" style="background:rgba(34,197,94,0.12); border:1px solid rgba(34,197,94,0.3); color:#4ade80;">
            Password updated.
          </div>
        } @else {
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="space-y-4">
            @if (errorMessage) {
              <div class="rounded-lg px-4 py-3" style="background:rgba(239,68,68,0.12); border:1px solid rgba(239,68,68,0.3); color:#f87171;">{{ errorMessage }}</div>
            }
            <div>
              <label for="currentPassword" class="block text-sm font-medium mb-1" style="color:#94a3b8;">Current password</label>
              <input id="currentPassword" type="password" formControlName="currentPassword" autocomplete="current-password" class="mt-1 block w-full rounded-lg px-4 py-3" />
            </div>
            <div>
              <label for="newPassword" class="block text-sm font-medium mb-1" style="color:#94a3b8;">New password</label>
              <input id="newPassword" type="password" formControlName="newPassword" autocomplete="new-password" class="mt-1 block w-full rounded-lg px-4 py-3" />
              @if (form.get('newPassword')?.invalid && form.get('newPassword')?.touched) {
                <p class="text-red-400 text-sm mt-1">{{ passwordError }}</p>
              }
            </div>
            <div>
              <label for="confirmPassword" class="block text-sm font-medium mb-1" style="color:#94a3b8;">Confirm password</label>
              <input id="confirmPassword" type="password" formControlName="confirmPassword" autocomplete="new-password" class="mt-1 block w-full rounded-lg px-4 py-3" />
              @if (form.get('confirmPassword')?.touched && form.hasError('mismatch')) {
                <p class="text-red-400 text-sm mt-1">Passwords do not match</p>
              }
            </div>
            <button type="submit" [disabled]="form.invalid || loading" class="btn-primary w-full disabled:opacity-50">
              {{ loading ? 'Saving...' : 'Save password' }}
            </button>
          </form>
        }
      </div>
    </div>
  `
})
export class ChangePasswordComponent {
  form: FormGroup;
  loading = false;
  success = false;
  errorMessage = '';

  get passwordError(): string {
    return strongPasswordErrorMessage(this.form.get('newPassword')?.errors);
  }

  constructor(
    private fb: FormBuilder,
    private api: ApiService,
    public auth: AuthService,
    private router: Router
  ) {
    this.form = this.fb.group(
      {
        currentPassword: ['', Validators.required],
        newPassword: ['', [Validators.required, strongPasswordValidator()]],
        confirmPassword: ['', Validators.required]
      },
      { validators: (g) => (g.get('newPassword')?.value === g.get('confirmPassword')?.value ? null : { mismatch: true }) }
    );
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.errorMessage = '';
    const currentPassword = this.form.get('currentPassword')?.value;
    const newPassword = this.form.get('newPassword')?.value;
    this.api.changePassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.auth.fetchMe().subscribe({
          next: () => this.goNext(),
          error: () => this.goNext()
        });
      },
      error: (err) => {
        this.errorMessage = err?.message || 'Could not update the password.';
        this.loading = false;
      }
    });
  }

  private goNext(): void {
    this.loading = false;
    this.success = true;
    const role = this.auth.currentUser()?.role;
    if (role === 'coach') this.router.navigate(['/coach/dashboard']);
    else if (role === 'admin') this.router.navigate(['/admin']);
    else this.router.navigate(['/dashboard']);
  }
}
