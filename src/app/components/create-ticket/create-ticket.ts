import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { SupportService } from '../../services/support-service';
import { AuthService } from '../../services/auth';
import { AuthHelper } from '../../helpers/auth-helper';
import { Snackbar } from '../../services/snackbar';

@Component({
  selector: 'app-create-ticket',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-ticket.html',
  styleUrl: './create-ticket.css',
})
export class CreateTicket implements OnInit {
  name = '';
  email = '';
  phone = '';
  category = 'General';
  subject = '';
  message = '';

  submitting = false;
  submitted = false;

  readonly categories = [
    'General',
    'Booking Issue',
    'Payment Issue',
    'Ride / Driver Issue',
    'Account & Verification',
    'Marketplace',
    'Bug / Technical',
    'Other',
  ];

  constructor(
    private supportService: SupportService,
    private authService: AuthService,
    private router: Router,
    private snack: Snackbar,
  ) {}

  ngOnInit(): void {
    // Prefill from the logged-in user when available
    if (AuthHelper.isLoggedIn()) {
      this.authService.getCurrentUser().subscribe({
        next: (res: any) => {
          this.name = res?.Name ?? this.name;
          this.email = res?.Email ?? this.email;
          this.phone = res?.Phone_Number ?? this.phone;
        },
        error: () => { /* prefill is best-effort */ },
      });
    }
  }

  get canSubmit(): boolean {
    return (
      !this.submitting &&
      this.name.trim().length > 0 &&
      this.isValidEmail(this.email) &&
      this.subject.trim().length > 0 &&
      this.message.trim().length > 0
    );
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
  }

  submit(): void {
    if (!this.canSubmit) return;
    this.submitting = true;

    this.supportService
      .createTicket({
        name: this.name.trim(),
        email: this.email.trim(),
        phone: this.phone.trim() || undefined,
        category: this.category,
        subject: this.subject.trim(),
        message: this.message.trim(),
      })
      .subscribe({
        next: () => {
          this.submitting = false;
          this.submitted = true;
          this.snack.success('Your ticket has been submitted!');
        },
        error: (err) => {
          this.submitting = false;
          this.snack.error(err?.error?.message || 'Failed to submit ticket. Please try again.');
        },
      });
  }

  raiseAnother(): void {
    this.submitted = false;
    this.subject = '';
    this.message = '';
    this.category = 'General';
  }

  goBack(): void {
    window.history.back();
  }
}
