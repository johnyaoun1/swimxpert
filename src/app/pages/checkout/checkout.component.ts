import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { environment } from '../../../environments/environment';

interface CheckoutReceipt {
  success: boolean;
  receiptId: string;
  date: string;
  startLocal: string;
  endLocal: string;
  amount: number;
  cardLastFour: string;
  cardHolder: string;
  swimmerName: string;
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, RouterModule, ReactiveFormsModule],
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.scss']
})
export class CheckoutComponent implements OnInit {
  // Slot details from query params
  startUtc   = '';
  swimmerId  = 0;
  date       = '';
  startLocal = '';
  endLocal   = '';
  swimmerName = '';
  readonly price = 25;

  form!: FormGroup;
  submitting = signal(false);
  errorMsg   = signal('');
  receipt    = signal<CheckoutReceipt | null>(null);

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private fb: FormBuilder,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const p = this.route.snapshot.queryParams;
    this.startUtc   = p['startUtc']   ?? '';
    this.swimmerId  = Number(p['swimmerId'] ?? 0);
    this.date       = p['date']       ?? '';
    this.startLocal = p['startLocal'] ?? '';
    this.endLocal   = p['endLocal']   ?? '';
    this.swimmerName = p['swimmerName'] ?? '';

    if (!this.startUtc || !this.swimmerId) {
      this.router.navigate(['/sessions/available']);
      return;
    }

    this.form = this.fb.group({
      cardHolder:  ['', [Validators.required, Validators.minLength(3)]],
      cardNumber:  ['', [Validators.required, Validators.pattern(/^\d{4} \d{4} \d{4} \d{4}$/)]],
      expiry:      ['', [Validators.required, Validators.pattern(/^(0[1-9]|1[0-2])\/\d{2}$/)]],
      cvv:         ['', [Validators.required, Validators.pattern(/^\d{3,4}$/)]]
    });
  }

  formatCardNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/\D/g, '').slice(0, 16);
    val = val.replace(/(.{4})/g, '$1 ').trim();
    input.value = val;
    this.form.get('cardNumber')!.setValue(val, { emitEvent: false });
  }

  formatExpiry(event: Event): void {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/\D/g, '').slice(0, 4);
    if (val.length >= 3) val = val.slice(0, 2) + '/' + val.slice(2);
    input.value = val;
    this.form.get('expiry')!.setValue(val, { emitEvent: false });
  }

  get f(): { [key: string]: AbstractControl } {
    return this.form.controls;
  }

  pay(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.value;
    const lastFour = raw.cardNumber.replace(/\s/g, '').slice(-4);

    this.submitting.set(true);
    this.errorMsg.set('');

    this.http.post<CheckoutReceipt>(`${environment.apiUrl}/payments/checkout`, {
      startUtc:     this.startUtc,
      swimmerId:    this.swimmerId,
      amount:       this.price,
      cardHolder:   raw.cardHolder,
      cardLastFour: lastFour
    }).subscribe({
      next: (res) => {
        this.receipt.set(res);
        this.submitting.set(false);
      },
      error: (err) => {
        this.errorMsg.set(err?.error?.message || err?.message || 'Payment failed. Please try again.');
        this.submitting.set(false);
      }
    });
  }

  formatDate(d: string): string {
    if (!d) return '';
    const date = new Date(d + 'T00:00:00');
    return date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
}
