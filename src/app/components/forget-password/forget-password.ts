import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../../environment';
import { Snackbar } from '../../services/snackbar';

type Step = 'email' | 'verify' | 'reset' | 'success';

@Component({
  selector: 'app-forget-password',
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './forget-password.html',
  styleUrl: './forget-password.css',
})
export class ForgetPassword implements OnInit {
  currentStep: Step = 'email';

  // Forms
  emailForm!: FormGroup;
  answerForm!: FormGroup;
  resetForm!: FormGroup;

  // State
  securityQuestion: string = '';   // fetched from backend
  userEmail: string = '';          // saved from step 1
  resetToken: string = '';         // received after answer verified

  isLoading = false;
  errorMessage = '';
  showPassword = false;
  showConfirmPassword = false;

  // private readonly BASE_URL = 'http://localhost:3333/auth';
  private readonly BASE_URL = `${environment.apiUrl}/auth`;
  // private readonly BASE_URL = 'http://34.207.242.45:3333/auth';

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
      private cdr: ChangeDetectorRef,
      private snackbar:Snackbar
  ) { }

  ngOnInit(): void {
    // Step 1 — Email
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });

    // Step 2 — Security Answer
    this.answerForm = this.fb.group({
      Ans: ['', [Validators.required, Validators.minLength(1)]]
    });

    // Step 3 — New Password
    this.resetForm = this.fb.group(
      {
        newPassword: [
          '',
          [
            Validators.required,
            Validators.minLength(6),
            Validators.pattern(/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{6,}$/)
          ]
        ],
        confirmPassword: ['', Validators.required]
      },
      { validators: this.passwordMatchValidator }
    );
  }

  passwordMatchValidator(group: FormGroup) {
    const pw = group.get('newPassword')?.value;
    const cpw = group.get('confirmPassword')?.value;
    return pw === cpw ? null : { mismatch: true };
  }

  // ── STEP 1: Fetch Security Question by Email ─────────────────────────────
  onFetchQuestion(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.userEmail = this.emailForm.value.email;

    this.http.post<{ status: boolean; message: string; securityQues: string }>(
      `${this.BASE_URL}/getSecurityQues`,
      {
        userEmail:   this.userEmail
      }
    ).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.securityQues) {
           this.snackbar.success('User Found!');
          this.securityQuestion = res.securityQues;
          this.currentStep = 'verify';
        } else {
          this.errorMessage = res.message || 'No account found with this email.';
          
        }
             this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err?.error?.message || 'Something went wrong. Please try again.';
        if (err?.status === 401) 
        {
          this.snackbar.error('User not Found')
        }
        this.cdr.detectChanges(); // ✅
      }
       
    });
  }

  // ── STEP 2: Verify Security Answer ──────────────────────────────────────
  onVerifyAnswer(): void {
    if (this.answerForm.invalid) {
      this.answerForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const payload = {
      email: this.userEmail,
      Ans: this.answerForm.value.Ans
    };

    this.http.post<{ status: boolean; message: string; resetToken: string }>(
      `${this.BASE_URL}/verifySecurityAns`,
      payload
    ).subscribe({
      next: (res) => {
       
        this.isLoading = false;
        if (res.status) {
           this.snackbar.success('Verify Answer successfully!');
          this.resetToken = res.resetToken;
          this.currentStep = 'reset';
        } else {
          this.errorMessage = res.message || 'Incorrect answer. Please try again.';
        }
        this.cdr.detectChanges(); // ✅
      },
      error: (err) => {
        this.isLoading = false;
        let message = 'Login failed';
      
        if (err?.status === 400) {
          message = 'Incorrect answer. Please try again.'
        }
        else if (err?.status === 500) {
           message = 'Server error. Please try again later.'
        }
         this.snackbar.error(message)
      this.cdr.detectChanges(); // ✅
      }
    });
  }

  // ── STEP 3: Reset Password ───────────────────────────────────────────────
  onResetPassword(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
       if (this.resetForm.hasError('mismatch')) {
      this.snackbar.error('Passwords do not match.');
      return;
    }
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const payload = {
      resetToken: this.resetToken,
      newPassword: this.resetForm.value.newPassword
    };

    this.http.post<{ status: boolean; message: string }>(
      `${this.BASE_URL}/resetPassword`,
      payload
    ).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.status !== false) {
           this.snackbar.success('Reset Password successfully!');
          this.currentStep = 'success';
        } else {
          
          this.errorMessage = res.message || 'Password reset failed.';
          
        }
        this.cdr.detectChanges(); // ✅
      },
      error: (err) => {
        this.isLoading = false;
        let message = 'Something went wrong. please try again'
        

         if (err?.status === 401) {
          message = 'Password reset failed.'
        }
        else if (err?.status === 500) {
           message = 'Server error. Please try again later.'
        }
      this.cdr.detectChanges(); // ✅
      }
    });
  }

  // ── Navigation helpers ───────────────────────────────────────────────────
  goBack(): void {
    if (this.currentStep === 'verify') {
      this.errorMessage = '';
      this.answerForm.reset();
      this.currentStep = 'email';
    }
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }

  togglePassword(): void { this.showPassword = !this.showPassword; }
  toggleConfirmPassword(): void { this.showConfirmPassword = !this.showConfirmPassword; }

  // Form control shortcuts
  get ef() { return this.emailForm.controls; }
  get af() { return this.answerForm.controls; }
  get rf() { return this.resetForm.controls; }

  getPasswordStrength(): { label: string; level: number } {
    const val: string = this.rf['newPassword'].value || '';
    let score = 0;
    if (val.length >= 6) score++;
    if (/[A-Z]/.test(val)) score++;
    if (/\d/.test(val)) score++;
    if (/[@$!%*?&]/.test(val)) score++;
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];
    return { label: labels[score] || '', level: score };
  }

  get stepNumber(): number {
    const map: Record<Step, number> = { email: 1, verify: 2, reset: 3, success: 3 };
    return map[this.currentStep];
  }
}
