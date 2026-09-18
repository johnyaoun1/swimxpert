import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ContactService } from '../../services/contact.service';
import { SeoService } from '../../services/seo.service';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './contact.component.html',
  styleUrls: ['./contact.component.scss']
})
export class ContactComponent implements OnInit {
  contactForm: FormGroup;
  submitting = false;
  submitted = false;
  submitError = '';

  constructor(
    private fb: FormBuilder,
    private contactService: ContactService,
    private seo: SeoService
  ) {
    this.contactForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      message: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.seo.updatePage({
      title: 'Contact SwimXpert | Swimming Lessons Lebanon',
      description:
        'Get in touch with SwimXpert for swimming lessons in Lebanon. Book a trial session or ask about our programs for children and adults.',
      path: '/contact'
    });
  }

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
