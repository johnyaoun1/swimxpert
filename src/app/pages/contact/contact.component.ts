import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ContactService } from '../../services/contact.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent {
  contactForm: FormGroup;
  submitting = false;
  submitted = false;

  constructor(
    private fb: FormBuilder,
    private contactService: ContactService
  ) {
    this.contactForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      message: ['', Validators.required]
    });
  }

  submitError = '';

  onSubmit(): void {
    if (this.contactForm.valid) {
      this.submitting = true;
      this.submitError = '';
      this.contactService.submitContactForm(this.contactForm.value).subscribe({
        next: (result) => {
          this.submitting = false;
          if (result.success) {
            this.submitted = true;
            this.contactForm.reset();
            setTimeout(() => { this.submitted = false; }, 5000);
          } else {
            this.submitError = result.error || 'Failed to send message.';
          }
        },
        error: () => {
          this.submitting = false;
          this.submitError = 'Failed to send message. Please try again.';
        }
      });
    }
  }
}
