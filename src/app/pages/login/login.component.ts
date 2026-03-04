import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup;
  loading = false;
  errorMessage = '';
  showResendVerification = false;
  emailForResend = '';
  resendSuccess = false;
  show2FaInput = false;
  emailFor2Fa = '';
  twoFaCode = '';

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private apiService: ApiService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required]
    });

    const message = this.route.snapshot.queryParamMap.get('message');
    if (message) {
      this.errorMessage = message;
    }
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.loading = true;
      this.errorMessage = '';
      
      const { email, password } = this.loginForm.value;
      this.authService.login(email, password).subscribe({
        next: (response) => {
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
          this.router.navigateByUrl(returnUrl);
          this.loading = false;
        },
        error: (err: any) => {
          if (err?.status === 202 && err?.error?.code === '2fa_required') {
            this.show2FaInput = true;
            this.emailFor2Fa = err?.error?.email ?? email;
            this.errorMessage = '';
            this.loading = false;
            return;
          }
          const code = err?.error?.code || err?.code;
          if (err?.status === 403 && code === 'email_not_verified') {
            this.errorMessage = 'Please verify your email before logging in.';
            this.showResendVerification = true;
            this.emailForResend = email;
          } else {
            this.errorMessage = err?.error?.message || err?.message || 'Login failed. Please try again.';
          }
          this.loading = false;
        }
      });
    }
  }

  submit2Fa(): void {
    if (!this.twoFaCode || !this.emailFor2Fa) return;
    this.loading = true;
    this.errorMessage = '';
    this.apiService.verify2Fa(this.emailFor2Fa, this.twoFaCode).subscribe({
      next: (res) => {
        this.authService.persistAuthResponseFromMe(res);
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') || '/dashboard';
        this.router.navigateByUrl(returnUrl);
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Invalid code. Try again.';
        this.loading = false;
      }
    });
  }

  resendVerification(): void {
    if (!this.emailForResend) return;
    this.loading = true;
    this.apiService.resendVerification(this.emailForResend).subscribe({
      next: () => {
        this.resendSuccess = true;
        this.loading = false;
      },
      error: () => {
        this.errorMessage = 'Could not send verification email. Try again.';
        this.loading = false;
      }
    });
  }
}
