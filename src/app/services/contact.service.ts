import { Injectable } from '@angular/core';
import { LeadCaptureService } from './lead-capture.service';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  constructor(private leadCaptureService: LeadCaptureService) {}

  submitContactForm(formData: ContactFormData): Observable<{ success: boolean; error?: string }> {
    const message = (formData.message || '').trim().slice(0, 200);
    return this.leadCaptureService.captureLead({
      name: formData.name.trim(),
      email: formData.email?.trim() || null,
      sourcePage: 'Contact',
      sourceAction: message || null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null
    }).pipe(
      map(() => ({ success: true })),
      catchError((err) => of({ success: false, error: err?.message || 'Failed to send message.' }))
    );
  }
}
