import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Adminservice } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { LoaderServices } from '../../services/loader-services';

// Mirrors backend app/Constents/SecurityQuestions.ts — keep ids in sync.
const SECURITY_QUESTIONS = [
  { id: 1, question: "What is your mother's maiden name?" },
  { id: 2, question: 'What was the name of your first pet?' },
  { id: 3, question: 'What is your favorite food?' },
  { id: 4, question: 'What city were you born in?' },
  { id: 5, question: 'What was the name of your first school?' },
  { id: 6, question: "What is your oldest sibling's middle name?" },
];

@Component({
  selector: 'app-reset-security',
  imports: [CommonModule, FormsModule, SideBar],
  templateUrl: './reset-security.html',
  styleUrl: './reset-security.css',
})
export class ResetSecurity {
  securityQuestions = SECURITY_QUESTIONS;

  // ── Form model ──
  userEmail = '';
  newPassword = '';
  confirmPassword = '';
  securityQuesId: number | null = null;
  newSecurityAns = '';

  showPassword = false;
  submitting = false;
  error = '';

  private loader = inject(LoaderServices);

  constructor(
    private adminService: Adminservice,
    private cdr: ChangeDetectorRef,
    private snackbar: Snackbar
  ) {}

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  resetForm(): void {
    this.userEmail = '';
    this.newPassword = '';
    this.confirmPassword = '';
    this.securityQuesId = null;
    this.newSecurityAns = '';
    this.error = '';
    this.cdr.detectChanges();
  }

  submit(): void {
    this.error = '';

    const email = this.userEmail.trim();
    if (!email || !this.isValidEmail(email)) {
      this.error = 'Please enter a valid user email.';
      return;
    }
    if (!this.newPassword || this.newPassword.length < 8) {
      this.error = 'Password must be at least 8 characters.';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.error = 'Passwords do not match.';
      return;
    }
    if (!this.securityQuesId) {
      this.error = 'Please select a security question.';
      return;
    }
    if (!this.newSecurityAns.trim()) {
      this.error = 'Please enter the security answer.';
      return;
    }

    this.submitting = true;
    this.loader.show();
    this.cdr.detectChanges();

    this.adminService
      .resetUserSecurity({
        userEmail: email,
        newPassword: this.newPassword,
        newSecurityAns: this.newSecurityAns.trim(),
        securityQuesId: this.securityQuesId,
      })
      .subscribe({
        next: (res) => {
          this.submitting = false;
          this.loader.hide();
          this.snackbar.success(
            res?.message || 'Password and security answer reset successfully.'
          );
          this.resetForm();
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.submitting = false;
          this.loader.hide();
          this.error =
            err?.error?.message ||
            err?.error?.error ||
            'Failed to reset. Please try again.';
          this.snackbar.error(this.error);
          this.cdr.detectChanges();
        },
      });
  }
}
