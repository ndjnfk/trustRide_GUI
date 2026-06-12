import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { AuthService } from '../../services/auth'
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ChangeDetectorRef } from '@angular/core';
import { AuthHelper } from '../../helpers/auth-helper';
import { Snackbar } from '../../services/snackbar';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule, RouterLink, HttpClientModule, MatSnackBarModule],
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
  animations: [
    trigger('fadeSlideIn', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(24px)' }),
        animate('600ms cubic-bezier(0.16, 1, 0.3, 1)', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ]),
    trigger('shakeError', [
      state('idle', style({ transform: 'translateX(0)' })),
      state('shake', style({ transform: 'translateX(0)' })),
      transition('idle => shake', [
        animate('400ms ease', style({ transform: 'translateX(-8px)' })),
        animate('100ms ease', style({ transform: 'translateX(8px)' })),
        animate('100ms ease', style({ transform: 'translateX(-6px)' })),
        animate('100ms ease', style({ transform: 'translateX(6px)' })),
        animate('100ms ease', style({ transform: 'translateX(0)' }))
      ])
    ])
  ]
})
export class LoginComponent implements OnInit {
  loginForm!: FormGroup;
  isLoading = false;
  showPassword = false;
  errorMessage = '';
  shakeState = 'idle';
  focusedField: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private snackBar: Snackbar,
    private cdr: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    if (AuthHelper.isLoggedIn()) {
      this.router.navigateByUrl(this.getReturnUrl());
    }

    this.loginForm = this.fb.group({
      userEmail: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  onFocus(field: string): void { this.focusedField = field; }
  onBlur(): void { this.focusedField = null; }
  togglePassword(): void { this.showPassword = !this.showPassword; }

  get emailControl() { return this.loginForm.get('userEmail'); }
  get passwordControl() { return this.loginForm.get('password'); }

  onSubmit(): void {

    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.triggerShake();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    this.authService.login(this.loginForm.value).subscribe({

      next: (res: any) => {

        this.isLoading = false;

        this.cdr.detectChanges();




        // ✅ success message
        this.snackBar.success('Login successful');

        // Return the user to where they came from (e.g. a ride detail page), else dashboard
        window.location.href = this.getReturnUrl();

      },

      error: (err: any) => {
       
        this.isLoading = false;
        let message = 'Login failed';
        if (err?.status === 401) {
          message = 'Invalid email or password';
        } else if (err?.status === 500) {
          message = 'Server error. Please try again later.';
        }


        // ❌ error message
        this.snackBar.error(message);

        this.errorMessage = err?.error?.message || 'Login failed';
        this.triggerShake();
      }
    });
  }

  // Reads the ?returnUrl=... query param; only allow same-app relative paths to avoid open redirects
  private getReturnUrl(): string {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('//')) {
      return returnUrl;
    }
    return '/dashboard';
  }

  private triggerShake(): void {
    this.shakeState = 'idle';
    setTimeout(() => { this.shakeState = 'shake'; }, 10);
    setTimeout(() => { this.shakeState = 'idle'; }, 600);
  }
}