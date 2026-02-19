import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RevenueService } from '../../services/revenue.service';

@Component({
  selector: 'app-record-payment',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './record-payment.component.html',
  styleUrls: ['./record-payment.component.scss']
})
export class RecordPaymentComponent {
  form = {
    userId: '',
    amount: 0,
    date: new Date().toISOString().split('T')[0],
    method: 'Cash',
    reference: ''
  };

  loading = false;
  successMessage = '';
  errorMessage = '';

  constructor(private revenueService: RevenueService) {}

  submit(): void {
    this.loading = true;
    this.successMessage = '';
    this.errorMessage = '';

    this.revenueService.processPayment(
      this.form.amount,
      this.form.method,
      this.form.userId,
      this.form.date,
      this.form.reference
    ).subscribe({
      next: () => {
        this.loading = false;
        this.successMessage = 'Payment recorded successfully.';
      },
      error: (error) => {
        this.loading = false;
        this.errorMessage = error?.message || 'Failed to record payment';
      }
    });
  }
}
