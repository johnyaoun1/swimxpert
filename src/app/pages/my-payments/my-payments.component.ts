import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RevenueService } from '../../services/revenue.service';

@Component({
  selector: 'app-my-payments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-payments.component.html',
  styleUrls: ['./my-payments.component.scss']
})
export class MyPaymentsComponent implements OnInit {
  payments: any[] = [];
  loading = false;
  errorMessage = '';

  constructor(private revenueService: RevenueService) {}

  ngOnInit(): void {
    this.loading = true;
    this.revenueService.getMyPayments().subscribe({
      next: (payments) => {
        this.payments = payments;
        this.loading = false;
      },
      error: (error) => {
        this.errorMessage = error?.message || 'Failed to load payment history';
        this.loading = false;
      }
    });
  }
}
