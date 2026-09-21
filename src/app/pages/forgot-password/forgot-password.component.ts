import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="min-h-screen flex items-center justify-center py-12 px-4" style="background:#0a0f1e;">
      <div class="max-w-md w-full text-center">
        <h2 class="text-2xl font-bold text-white mb-4">Forgot password</h2>
        <p class="text-base leading-relaxed mb-6" style="color:#94a3b8;">
          To reset your password, message us on WhatsApp
        </p>
        <a
          href="https://wa.me/96176144927"
          target="_blank"
          rel="noopener noreferrer"
          class="btn-primary inline-flex w-full items-center justify-center"
        >
          Message us on WhatsApp
        </a>
        <a routerLink="/login" class="mt-6 block text-center text-primary-400 font-medium">Back to login</a>
      </div>
    </div>
  `
})
export class ForgotPasswordComponent {}
