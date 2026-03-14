import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Title, Meta } from '@angular/platform-browser';
import { ContactService } from '../../services/contact.service';

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

  constructor(
    private fb: FormBuilder,
    private contactService: ContactService,
    private title: Title,
    private meta: Meta
  ) {
    this.contactForm = this.fb.group({
      name: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      message: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.title.setTitle('Contact SwimXpert | Swimming Lessons Lebanon');
    this.meta.updateTag({
      name: 'description',
      content: 'Get in touch with SwimXpert for swimming lessons in Lebanon. Book a trial session or ask about our programs for children and adults.'
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
