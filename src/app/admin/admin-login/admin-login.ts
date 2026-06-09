import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Adminservice } from '../../services/adminservice';

import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthHelper } from '../../helpers/auth-helper';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminSessionHelper } from '../../helpers/admin-session-helper';
import { CommonModule } from '@angular/common';
import { MaterialModule } from '../../shared/material/material-module';

@Component({
  selector: 'app-admin-login',
  imports: [CommonModule,MaterialModule],
  templateUrl: './admin-login.html',
  styleUrl: './admin-login.css',
})
export class AdminLogin {
  loginForm: FormGroup;
  isLoading = false;
  hidePassword = true;
  
 
  constructor(
    private fb: FormBuilder,
    private adminService: Adminservice,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: MatSnackBar
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(4)]],
    });
  }
 
  ngOnInit(): void {
    // Session expire hone par interceptor yahan bhejta hai — message dikhao
    if (this.route.snapshot.queryParamMap.get('sessionExpired') === '1') {
      this.showSnackBar('Your session expired. Please login again.', 'error');
      return;
    }

    // Agar pehle se logged in hai toh dashboard pe bhejo
    if (AdminSessionHelper.isAdminLoggedIn()) {
      this.router.navigate(['/admin/dashboard']);
    }
  }
 
  get emailControl() {
    return this.loginForm.get('email');
  }
 
  get passwordControl() {
    return this.loginForm.get('password');
  }
 
  getEmailError(): string {
    if (this.emailControl?.hasError('required')) return 'Email is required.';
    if (this.emailControl?.hasError('email')) return 'Please Enter Valid email.';
    return '';
  }
 
  getPasswordError(): string {
    if (this.passwordControl?.hasError('required')) return 'Password is required.';
    if (this.passwordControl?.hasError('minlength')) return 'Password';
    return '';
  }
 
  onSubmit(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.showSnackBar('Please fill all fields.', 'error');
      return;
    }
 
    this.isLoading = true;
 
    this.adminService.login(this.loginForm.value).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.showSnackBar(`Welcome back, ${res.data.user.name}! 🎉`, 'success');
        setTimeout(() => {
          this.router.navigate(['/admin/dashboard']);
        }, 800);
      },
      error: (err: Error) => {
        this.isLoading = false;
        this.showSnackBar(err.message, 'error');
      },
    });
  }
 
  private showSnackBar(message: string, type: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: type === 'success' ? ['snack-success'] : ['snack-error'],
    });
  }
}
