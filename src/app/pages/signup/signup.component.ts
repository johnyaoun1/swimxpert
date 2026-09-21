import { Component, Inject, OnInit, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LevelFinderService } from '../../services/level-finder.service';
import { SeoService } from '../../services/seo.service';
import { strongPasswordValidator } from '../../utils/password-policy';
import { PHONE_COUNTRIES } from '../../utils/phone-countries';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
  templateUrl: './signup.component.html',
  styleUrls: ['./signup.component.scss']
})
export class SignupComponent implements OnInit {
  signupForm: FormGroup;
  loading = false;
  errorMessage = '';
  readonly passwordHint = 'Password must be at least 8 characters, with 1 uppercase letter and 1 number.';
  readonly countries = PHONE_COUNTRIES;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private levelFinder: LevelFinderService,
    private router: Router,
    private route: ActivatedRoute,
    private seo: SeoService,
    @Inject(PLATFORM_ID) private platformId: object
  ) {
    this.signupForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phoneRegion: ['LB', Validators.required],
      phone: ['', [Validators.required, Validators.maxLength(30)]],
      password: ['', [Validators.required, strongPasswordValidator()]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.seo.updatePage({
      title: 'Join SwimXpert | Start Swimming Lessons',
      description: 'Create your SwimXpert account and start your swimming journey.',
      path: '/signup'
    });

    if (isPlatformBrowser(this.platformId)) {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
      if (returnUrl && returnUrl !== '/dashboard' && returnUrl !== '/login') {
        sessionStorage.setItem('auth_return_url', returnUrl);
      }
    }
  }

  passwordMatchValidator(form: FormGroup) {
    const password = form.get('password');
    const confirmPassword = form.get('confirmPassword');
    if (password && confirmPassword && password.value !== confirmPassword.value) {
      confirmPassword.setErrors({ passwordMismatch: true });
      return { passwordMismatch: true };
    }
    return null;
  }

  onSubmit(): void {
    if (this.signupForm.valid) {
      this.loading = true;
      this.errorMessage = '';
      const { name, email, phone, phoneRegion, password } = this.signupForm.value;
      this.authService.signup(email, password, name, phone.trim(), phoneRegion).subscribe({
        next: (response) => {
          if (response?.id != null) {
            this.redirectAfterAuth();
          } else {
            this.errorMessage = 'Error creating account. Please try again.';
          }
          this.loading = false;
        },
        error: (err) => {
          this.errorMessage = err?.message || 'Signup failed. Please try again.';
          this.loading = false;
        }
      });
    }
  }

  private redirectAfterAuth(): void {
    const storedReturn = sessionStorage.getItem('auth_return_url');
    const queryReturn  = this.route.snapshot.queryParamMap.get('returnUrl');
    const target = storedReturn || queryReturn;

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
}
