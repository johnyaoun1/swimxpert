import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

interface AdminUser {
  id: number;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: string;
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

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadUsers();
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
}
