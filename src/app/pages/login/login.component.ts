import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ApiService } from '../../services/api.service';
import { LevelFinderService } from '../../services/level-finder.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
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
    private levelFinder: LevelFinderService,
    private router: Router,
    private route: ActivatedRoute,
    private seo: SeoService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.loginForm = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });

    const message = this.route.snapshot.queryParamMap.get('message');
    if (message) {
      this.errorMessage = message;
    }
  }

  ngOnInit(): void {
    this.seo.updatePage({
      title: 'Login | SwimXpert Member Portal',
      description:
        'Sign in to your SwimXpert account to manage sessions, track progress, and view payments.',
      path: '/login'
    });

    // Store the returnUrl in sessionStorage so signup can access it too
    if (isPlatformBrowser(this.platformId)) {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      if (returnUrl && returnUrl !== '/dashboard' && returnUrl !== '/login') {
        sessionStorage.setItem('auth_return_url', returnUrl);
      }
    }
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.loading = true;
      this.errorMessage = '';
      
      const { username, password } = this.loginForm.value;
      this.authService.login(username, password).subscribe({
        next: (response) => {
          this.redirectAfterAuth();
          this.loading = false;
        },
        error: (err: any) => {
          if (err?.status === 202 && err?.error?.code === '2fa_required') {
            this.show2FaInput = true;
            this.emailFor2Fa = err?.error?.email ?? username;
            this.errorMessage = '';
            this.loading = false;
            return;
          }
          const code = err?.error?.code || err?.code;
          if (err?.status === 403 && code === 'email_not_verified') {
            this.errorMessage = 'Please verify your email before booking. You can still log in and use your dashboard.';
            this.showResendVerification = true;
            this.emailForResend = username;
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
        this.redirectAfterAuth();
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Invalid code. Try again.';
        this.loading = false;
      }
    });
  }

  private redirectAfterAuth(): void {
    if (this.authService.currentUser()?.mustChangePassword) {
      sessionStorage.removeItem('auth_return_url');
      this.router.navigate(['/change-password']);
      return;
    }

    const storedReturn = sessionStorage.getItem('auth_return_url');
    const queryReturn  = this.route.snapshot.queryParamMap.get('returnUrl');
    const target = storedReturn || queryReturn;

    const role = this.authService.currentUser()?.role;

    // Coaches: only coach dashboard (or explicit /coach/* return URLs)
    if (role === 'coach') {
      sessionStorage.removeItem('auth_return_url');
      if (target && target.startsWith('/coach/')) {
        this.router.navigateByUrl(target);
        return;
      }
      this.router.navigate(['/coach/dashboard']);
      return;
    }

    if (target && target !== '/dashboard' && target !== '/login') {
      sessionStorage.removeItem('auth_return_url');
      this.router.navigateByUrl(target);
      return;
    }

    if (this.levelFinder.peekPendingResult()) {
      sessionStorage.removeItem('auth_return_url');
      this.router.navigate(['/level-finder'], { queryParams: { restore: '1' } });
      return;
    }

    sessionStorage.removeItem('auth_return_url');
    this.router.navigate(['/dashboard']);
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
