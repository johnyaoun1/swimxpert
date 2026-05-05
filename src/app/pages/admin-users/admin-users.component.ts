import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../services/api.service';

interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface CreatedCredentials {
  username: string;
  password: string;
  email: string;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-users.component.html',
  styleUrls: ['./admin-users.component.scss']
})
export class AdminUsersComponent implements OnInit {
  users: AdminUser[] = [];
  loading = false;
  errorMessage = '';

  // ── Create Client modal ──────────────────────────────────────
  showCreateModal = false;
  createForm = { fullName: '', email: '', phone: '', password: '', childName: '', childAge: '', childLevel: '' };
  showCreatePassword = false;
  createLoading = false;
  createError = '';
  createdCredentials: CreatedCredentials | null = null;
  copiedField: 'username' | 'password' | null = null;
  private pendingLeadId: number | null = null;

  constructor(private apiService: ApiService, private route: ActivatedRoute) {}

  ngOnInit(): void {
    this.loadUsers();

    // Pre-fill modal when navigated from admin dashboard leads section
    const p = this.route.snapshot.queryParamMap;
    const prefillName  = p.get('prefillName');
    const prefillEmail = p.get('prefillEmail');
    const leadId       = p.get('leadId');
    if (prefillName) {
      this.pendingLeadId = leadId ? Number(leadId) : null;
      this.createForm = {
        fullName:   prefillName,
        email:      prefillEmail               ?? '',
        phone:      p.get('prefillPhone')      ?? '',
        password:   '',
        childName:  p.get('prefillChildName')  ?? '',
        childAge:   p.get('prefillChildAge')   ?? '',
        childLevel: p.get('prefillChildLevel') ?? ''
      };
      this.createError = '';
      this.createdCredentials = null;
      this.showCreateModal = true;
    }
  }

  loadUsers(): void {
    this.loading = true;
    this.apiService.getAdminUsers().subscribe({
      next: (users) => {
        this.users = users as AdminUser[];
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.message || 'Failed to load users';
        this.loading = false;
      }
    });
  }

  updateRole(user: AdminUser, role: string): void {
    this.apiService.updateAdminUser(user.id, { role }).subscribe({
      next: () => user.role = role,
      error: (error) => this.errorMessage = error?.message || 'Failed to update role'
    });
  }

  toggleActive(user: AdminUser): void {
    const nextState = !user.isActive;
    this.apiService.updateAdminUser(user.id, { isActive: nextState }).subscribe({
      next: () => user.isActive = nextState,
      error: (error) => this.errorMessage = error?.message || 'Failed to update status'
    });
  }

  softDelete(user: AdminUser): void {
    this.apiService.deleteAdminUser(user.id).subscribe({
      next: () => user.isActive = false,
      error: (error) => this.errorMessage = error?.message || 'Failed to delete user'
    });
  }

  // ── Create Client ────────────────────────────────────────────

  openCreateModal(): void {
    this.createForm = { fullName: '', email: '', phone: '', password: '', childName: '', childAge: '', childLevel: '' };
    this.showCreatePassword = false;
    this.createError = '';
    this.createdCredentials = null;
    this.showCreateModal = true;
  }

  generatePassword(): void {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghjkmnpqrstuvwxyz';
    const digits = '23456789';
    const syms = '!@#$%^&*';
    const all = upper + lower + digits + syms;
    const arr = [
      upper[Math.floor(Math.random() * upper.length)],
      lower[Math.floor(Math.random() * lower.length)],
      digits[Math.floor(Math.random() * digits.length)],
      syms[Math.floor(Math.random() * syms.length)],
      ...Array.from({ length: 8 }, () => all[Math.floor(Math.random() * all.length)])
    ];
    // Fisher-Yates shuffle
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    this.createForm.password = arr.join('');
    this.showCreatePassword = true;
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
    this.createdCredentials = null;
    this.createError = '';
    if (this.createdCredentials) this.loadUsers();
  }

  submitCreateClient(): void {
    if (!this.createForm.fullName.trim() || !this.createForm.email.trim()) {
      this.createError = 'Full name and email are required.';
      return;
    }
    this.createLoading = true;
    this.createError = '';
    this.apiService.createClientAccount({
      fullName:   this.createForm.fullName.trim(),
      email:      this.createForm.email.trim(),
      phone:      this.createForm.phone.trim()      || undefined,
      password:   this.createForm.password.trim()   || undefined,
      childName:  this.createForm.childName.trim()  || undefined,
      childAge:   this.createForm.childAge          ? Number(this.createForm.childAge) : undefined,
      childLevel: this.createForm.childLevel.trim() || undefined
    }).subscribe({
      next: (result) => {
        this.createdCredentials = result;
        this.createLoading = false;
        this.loadUsers();
        // Mark the originating lead as handled if we came from admin dashboard
        if (this.pendingLeadId) {
          this.apiService.updateLeadStatus(this.pendingLeadId, true).subscribe();
          this.pendingLeadId = null;
        }
      },
      error: (err) => {
        this.createError = err?.message || 'Failed to create account.';
        this.createLoading = false;
      }
    });
  }

  copyToClipboard(text: string, field: 'username' | 'password'): void {
    navigator.clipboard.writeText(text).then(() => {
      this.copiedField = field;
      setTimeout(() => this.copiedField = null, 2000);
    });
  }
}
