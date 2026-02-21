import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { LeadCaptureService } from '../../services/lead-capture.service';

@Component({
  selector: 'app-lead-capture-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './lead-capture-modal.component.html',
  styleUrls: ['./lead-capture-modal.component.scss']
})
export class LeadCaptureModalComponent {
  @Input() isOpen = false;
  @Input() sourcePage: string | null = null;
  @Input() sourceAction: string | null = null;

  @Output() closed = new EventEmitter<void>();
  @Output() submitted = new EventEmitter<void>();

  loading = false;
  errorMessage = '';

  leadForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private leadCaptureService: LeadCaptureService
  ) {
    this.leadForm = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(150)]],
      email: ['', [Validators.email, Validators.maxLength(200)]],
      phone: ['', [Validators.maxLength(30)]],
      consent: [false, Validators.requiredTrue]
    });
  }

  onClose(): void {
    if (this.loading) return;
    this.closed.emit();
  }

  onSubmit(): void {
    this.errorMessage = '';

    const email = (this.leadForm.value.email || '').trim();
    const phone = (this.leadForm.value.phone || '').trim();
    if (!email && !phone) {
      this.errorMessage = 'Please provide email or phone number.';
      return;
    }

    if (this.leadForm.invalid) {
      this.leadForm.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.leadCaptureService.captureLead({
      name: String(this.leadForm.value.name || '').trim(),
      email: email || null,
      phone: phone || null,
      sourcePage: this.sourcePage,
      sourceAction: this.sourceAction,
      userAgent: navigator.userAgent
    }).subscribe({
      next: () => {
        this.loading = false;
        localStorage.setItem('swimxpert_lead_captured', '1');
        this.submitted.emit();
        this.leadForm.reset({ consent: false });
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Something went wrong. Please try again.';
      }
    });
  }
}
