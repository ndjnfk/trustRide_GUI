// ============================================================
// STEP 2 — register.component.ts
// Path: src/app/features/auth/register/register.component.ts
//
// Kya karta hai:
//   → Reactive Form with all validations
//   → Password strength checker (matches AdonisJS regex exactly)
//   → AuthService call karta hai
//   → Success → /auth/login redirect
//   → Error → banner show karta hai
// ============================================================

import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import { RouterLink, Router } from '@angular/router'
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  AbstractControl,
  ValidationErrors,
  FormArray,
} from '@angular/forms'
import { AuthService } from '../../services/auth'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { Snackbar } from '../../services/snackbar'
// import { AuthService } from '../../../core/services/auth.service'

// ── Custom validator 1: password strength ─────────────────────────────────────
// Must match AdonisJS regex:
//   /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/
function passwordStrengthValidator(control: AbstractControl): ValidationErrors | null {
  const value: string = control.value || ''
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).+$/
  return regex.test(value) ? null : { weakPassword: true }
}

// ── Custom validator: FormArray must have at least one entry ──────────────────
function minLengthArray(min: number) {
  return (control: AbstractControl): ValidationErrors | null => {
    const arr = control as FormArray
    return arr.length >= min ? null : { minLengthArray: { required: min, actual: arr.length } }
  }
}

// ── Custom validator 2: confirm password must match ───────────────────────────
function passwordMatchValidator(group: AbstractControl): ValidationErrors | null {
  const password = group.get('password')?.value
  const confirm = group.get('confirmPassword')?.value
  if (password && confirm && password !== confirm) {
    group.get('confirmPassword')?.setErrors({ passwordMismatch: true })
    return { passwordMismatch: true }
  }
  return null
}

// ─────────────────────────────────────────────────────────────────────────────

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, MatSnackBarModule],
  templateUrl: './register.html',
  styleUrls: ['./register.css'],
})
export class Register implements OnInit {

  // ── UI state ────────────────────────────────────────────────────────────────
  isLoading = false
  errorMessage = ''
  successMessage = ''
  showPassword = false
  showConfirm = false
  formSubmitted = false   // used to show all errors on submit click
  // register.component.ts — days ke paas
locations = ['Gurgaon', 'Saharanpur']

  // ── Form ─────────────────────────────────────────────────────────────────────
  registerForm!: FormGroup

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar,
    private snackbar: Snackbar
  ) { }

  ngOnInit(): void {
    this.registerForm = this.fb.group(
      {
        // ── fullName: trimmed string, min 2 chars ──────────────────────────
        fullName: [
          '',
          [
            Validators.required,
            Validators.minLength(2),
            Validators.maxLength(100),
          ],
        ],
        gender: [''],
        // ✅ NEW — role: rider | passenger | both
        role: ['', Validators.required],

        // ✅ NEW — mandatory array of travel days (at least one required)
        preferredTravelDays: this.fb.array([], minLengthArray(1)),

        // ── userEmail: valid email format ──────────────────────────────────
        userEmail: [
          '',
          [
            Validators.required,
            Validators.email,
            Validators.maxLength(255),
          ],
        ],

        // ── companyName: trimmed string, min 4 chars ──────────────────────────
        companyName: [
          '',
          [
            Validators.required,
            Validators.minLength(4),
            Validators.maxLength(100),
          ],
        ],

        // ── companyEmail: valid email format ──────────────────────────────────
        companyEmail: [
          '',
          [
            Validators.required,
            Validators.email,
            Validators.maxLength(255),
          ],
        ],

        // ── phoneNumber: Indian 10-digit, starts with 6-9 ─────────────────
        phoneNumber: [
          '',
          [
            Validators.required,
            Validators.pattern(/^[6-9]\d{9}$/),
          ],
        ],

        // ── password: AdonisJS rules ───────────────────────────────────────
        //    minLength(8) + uppercase + lowercase + digit + special char
        password: [
          '',
          [
            Validators.required,
            Validators.minLength(8),
            passwordStrengthValidator,
          ],
        ],

        // ── confirmPassword: local only, not sent to API ───────────────────
        confirmPassword: ['', Validators.required],
      },
      { validators: passwordMatchValidator } // group-level validator
    )
  }

  // ── Shorthand getter so HTML can use f['fieldName'] ─────────────────────────
  get f() {
    return this.registerForm.controls
  }


  // ── preferredTravelDays FormArray helpers ──────────────────────────
  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  get travelDays(): FormArray {
    return this.registerForm.get('preferredTravelDays') as FormArray
  }

  addTravelDay(): void {
    this.travelDays.push(
      this.fb.group({
        goingTo: ['', Validators.required],
        going: ['', Validators.required],
        comingTo: ['', Validators.required],
        leaving: ['', Validators.required],
      })
    )
  }

  removeTravelDay(index: number): void {
    this.travelDays.removeAt(index)
  }

  // ── Password strength score (0–5) ────────────────────────────────────────────
  get strengthChecks() {
    const val: string = this.f['password'].value || ''
    return {
      minLength: val.length >= 8,
      uppercase: /[A-Z]/.test(val),
      lowercase: /[a-z]/.test(val),
      digit: /[0-9]/.test(val),
      special: /[\W_]/.test(val),
    }
  }

  get strengthScore(): number {
    return Object.values(this.strengthChecks).filter(Boolean).length
  }

  get strengthLabel(): string {
    const s = this.strengthScore
    if (s <= 1) return 'Very weak'
    if (s === 2) return 'Weak'
    if (s === 3) return 'Fair'
    if (s === 4) return 'Strong'
    return 'Very strong'
  }

  get strengthColor(): string {
    const s = this.strengthScore
    if (s <= 1) return '#ef4444'
    if (s === 2) return '#f97316'
    if (s === 3) return '#eab308'
    if (s === 4) return '#22c55e'
    return '#16a34a'
  }

  // ── Toggle password visibility ───────────────────────────────────────────────
  togglePassword(): void { this.showPassword = !this.showPassword }
  toggleConfirm(): void { this.showConfirm = !this.showConfirm }

  // ── Check if a field should show its error ────────────────────────────────────
  // Shows error when: field touched OR form submitted
  hasError(field: string, error: string): boolean {
    const ctrl = this.f[field]
    return (ctrl.touched || this.formSubmitted) && ctrl.hasError(error)
  }

  // ── SUBMIT ────────────────────────────────────────────────────────────────────
  onSubmit(): void {

    // ── Re-entry guard: block double-submit (fast double-click / double Enter) ──
    // Without this, a second submit can fire before [disabled]="isLoading" takes
    // effect, sending two identical requests that race the backend uniqueness check.
    if (this.isLoading) return

    this.formSubmitted = true
    this.errorMessage = ''

    // stop loader if invalid
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched()
      this.isLoading = false
      return
    }

    this.isLoading = true

    const payload = {
      fullName: this.f['fullName'].value.trim(),
      gender: this.f['gender'].value.trim(),
      role: this.f['role'].value,                                    // ✅ NEW
      preferredTravelDays: this.travelDays.value,
      userEmail: this.f['userEmail'].value.trim().toLowerCase(),
      companyName: this.f['companyName'].value.trim(),
      companyEmail: this.f['companyEmail'].value.trim().toLowerCase(),
      phoneNumber: this.f['phoneNumber'].value.trim(),
      password: this.f['password'].value,
    }

    this.authService.register(payload).subscribe({

      next: (res: any) => {

        // stop loading
        this.isLoading = false

        // success popup
        this.snackbar.success('Registration successful')

        // // send verification email to the registered user
        // this.authService.verifyEmail(payload.userEmail).subscribe({
        //   next: () => {
        //     this.snackbar.success(`Verification email sent to ${payload.userEmail}`)
        //   },
        //   error: () => {
        //     // registration already succeeded; just inform the user
        //     this.snackbar.error('Could not send verification email. Please try again later.')
        //   }
        // })

        // reset form
        // reset form
        this.registerForm.reset()
        this.travelDays.clear()

        // reset form state
        this.formSubmitted = false

        // redirect to security question page
        setTimeout(() => {
          localStorage.setItem('registerEmail', payload.userEmail)
          this.router.navigate(
            ['/auth/set-security-question'],
            {
              // state: {
              //   email: this.f['userEmail'].value
              // }
              state: {
                email: payload.userEmail
              }
            }
          )

        }, 1000)
      },

      error: (err: any) => {
        this.isLoading = false;

        let message = 'Registration failed';

        if (err?.status === 422) {
          // AdonisJS validation error — pehli error ka message show karo
          message = err?.error?.errors?.[0]?.message || 'Validation failed.';
        } else if (err?.error?.message) {
          // Backend custom message (400, 500 etc.)
          message = err.error.message;
        } else {
          message = 'Something went wrong. Please try again.';
        }

        this.snackbar.error(message);
      },

      complete: () => {

        // safety fallback
        this.isLoading = false
      }
    })
  }
}