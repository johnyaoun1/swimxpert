import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { AuthService } from '../../services/auth.service';

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

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private title: Title,
    private meta: Meta
  ) {
    this.signupForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit(): void {
    this.title.setTitle('Join SwimXpert | Start Swimming Lessons in Lebanon');
    this.meta.updateTag({
      name: 'description',
      content: 'Create your SwimXpert account and start your swimming journey in Lebanon. Register today for professional coaching tailored to your level.'
    });
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
      
      const { name, email, password } = this.signupForm.value;
      this.authService.signup(email, password, name).subscribe({
        next: (response) => {
          if (response?.id != null) {
            this.router.navigate(['/dashboard']);
          } else {
            this.errorMessage = 'Error creating account. Please try again.';
          }
          this.loading = false;
        },
        error: () => {
          this.errorMessage = 'Signup failed. Please try again.';
          this.loading = false;
        }
      });
    }
  }
}
