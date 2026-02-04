import { Injectable } from '@angular/core';

export interface ContactFormData {
  name: string;
  email: string;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  submitContactForm(formData: ContactFormData): Promise<boolean> {
    // Mock submission - in production, this would call an API
    return new Promise((resolve) => {
      console.log('Contact form submitted:', formData);
      setTimeout(() => resolve(true), 1000);
    });
  }
}
