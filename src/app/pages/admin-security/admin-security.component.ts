import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { QRCodeModule } from 'angularx-qrcode';

@Component({
  selector: 'app-admin-security',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, QRCodeModule],
  templateUrl: './admin-security.component.html',
  styleUrls: ['./admin-security.component.scss']
})
export class AdminSecurityComponent implements OnInit {
  twoFactorEnabled = false;
  loading = false;
  message = '';
  errorMessage = '';

  // Setup state
  setupQrUri = '';
  setupSecret = '';
  enableCode = '';

  // Disable state
  disableCode = '';

  constructor(
    private api: ApiService,
    private auth: AuthService
  ) {}

  ngOnInit(): void {
    this.loadStatus();
  }

  loadStatus(): void {
    this.api.getMe().subscribe({
      next: (me: any) => {
        this.twoFactorEnabled = !!me?.twoFactorEnabled;
        if (!this.twoFactorEnabled) {
          this.setupQrUri = '';
          this.setupSecret = '';
        }
      }
    });
  }

  startSetup(): void {
    this.loading = true;
    this.errorMessage = '';
    this.message = '';
    this.api.setup2Fa().subscribe({
      next: (res) => {
        this.setupQrUri = res?.qrCodeUri ?? '';
        this.setupSecret = res?.secret ?? '';
        this.loading = false;
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Setup failed.';
        this.loading = false;
      }
    });
  }

  enable2Fa(): void {
    if (!this.enableCode || this.enableCode.length < 6) {
      this.errorMessage = 'Enter the 6-digit code from your app.';
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.api.enable2Fa(this.enableCode).subscribe({
      next: () => {
        this.message = '2FA is now enabled.';
        this.twoFactorEnabled = true;
        this.setupQrUri = '';
        this.setupSecret = '';
        this.enableCode = '';
        this.loading = false;
        this.auth.fetchMe().subscribe();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Invalid code.';
        this.loading = false;
      }
    });
  }

  disable2Fa(): void {
    if (!this.disableCode || this.disableCode.length < 6) {
      this.errorMessage = 'Enter your current 6-digit code to disable 2FA.';
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.api.disable2Fa(this.disableCode).subscribe({
      next: () => {
        this.message = '2FA has been disabled.';
        this.twoFactorEnabled = false;
        this.disableCode = '';
        this.loading = false;
        this.auth.fetchMe().subscribe();
      },
      error: (err) => {
        this.errorMessage = err?.error?.message || 'Invalid code.';
        this.loading = false;
      }
    });
  }
}
