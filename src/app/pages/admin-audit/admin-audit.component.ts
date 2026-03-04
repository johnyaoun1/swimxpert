import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-admin-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="p-6">
      <h1 class="text-2xl font-bold mb-4">Audit Log</h1>
      <div class="mb-4 flex flex-wrap gap-4 items-center">
        <input type="text" [(ngModel)]="filterAction" placeholder="Action" class="border rounded px-2 py-1" />
        <input type="date" [(ngModel)]="filterFrom" class="border rounded px-2 py-1" />
        <input type="date" [(ngModel)]="filterTo" class="border rounded px-2 py-1" />
        <button (click)="load()" class="px-4 py-2 bg-primary-600 text-white rounded">Filter</button>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full border">
          <thead>
            <tr class="bg-gray-100">
              <th class="border px-2 py-2 text-left">Date</th>
              <th class="border px-2 py-2 text-left">Admin</th>
              <th class="border px-2 py-2 text-left">Action</th>
              <th class="border px-2 py-2 text-left">Target</th>
              <th class="border px-2 py-2 text-left">Details</th>
              <th class="border px-2 py-2 text-left">IP</th>
            </tr>
          </thead>
          <tbody>
            @for (item of items; track item.id) {
              <tr>
                <td class="border px-2 py-2">{{ item.timestamp | date:'short' }}</td>
                <td class="border px-2 py-2">{{ item.adminEmail }}</td>
                <td class="border px-2 py-2">{{ item.action }}</td>
                <td class="border px-2 py-2">{{ item.targetType }} {{ item.targetId ? '#' + item.targetId : '' }}</td>
                <td class="border px-2 py-2 text-sm max-w-xs truncate">{{ item.details }}</td>
                <td class="border px-2 py-2">{{ item.ipAddress }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <div class="mt-4 flex justify-between items-center">
        <span>Total: {{ total }} | Page {{ page }} of {{ totalPages }}</span>
        <div class="gap-2">
          <button (click)="prev()" [disabled]="page <= 1" class="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
          <button (click)="next()" [disabled]="page >= totalPages" class="px-3 py-1 border rounded disabled:opacity-50">Next</button>
        </div>
      </div>
      <a routerLink="/admin" class="inline-block mt-4 text-primary-600">Back to Admin</a>
    </div>
  `
})
export class AdminAuditComponent {
  items: any[] = [];
  total = 0;
  page = 1;
  pageSize = 20;
  filterAction = '';
  filterFrom = '';
  filterTo = '';

  constructor(private api: ApiService) {
    this.load();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  load(): void {
    const params: any = { page: this.page, pageSize: this.pageSize };
    if (this.filterAction) params.action = this.filterAction;
    if (this.filterFrom) params.from = this.filterFrom;
    if (this.filterTo) params.to = this.filterTo;
    this.api.getAuditLogs(params).subscribe({
      next: (res) => {
        this.items = res.items || [];
        this.total = res.total ?? 0;
        this.page = res.page ?? 1;
      }
    });
  }

  prev(): void {
    if (this.page > 1) { this.page--; this.load(); }
  }

  next(): void {
    if (this.page < this.totalPages) { this.page++; this.load(); }
  }
}
