import { Component, OnInit } from '@angular/core'
import { CommonModule } from '@angular/common'
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators
} from '@angular/forms'
import { Router } from '@angular/router'

import { AuthService } from '../../services/auth'
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar'
import { Snackbar } from '../../services/snackbar'

@Component({
  selector: 'app-security-ques',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatSnackBarModule],
  templateUrl: './security-ques.html',
  styleUrls: ['./security-ques.css']
})
export class SecurityQues implements OnInit {

  form!: FormGroup
  userEmail = ''
  isLoading = false

  securityQuestions = [
    { id: 1, question: "What is your mother's maiden name?" },
    { id: 2, question: "What was the name of your first pet?" },
    { id: 3, question: "What is your favorite food?" },
    { id: 4, question: "What city were you born in?" },
    { id: 5, question: "What was the name of your first school?" },
    { id: 6, question: "What is your oldest sibling's middle name?" },
  ]

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private snackBar: Snackbar

  ) { }

  ngOnInit(): void {

    // create form FIRST
    this.form = this.fb.group({
      securityQuesId: ['', Validators.required],
      securityAns: [
        '',
        [
          Validators.required,
          Validators.minLength(2)
        ]
      ]
    })

    // get email from navigation state
    const nav = this.router.getCurrentNavigation()

    this.userEmail = localStorage.getItem('registerEmail') || ''

    // redirect if email missing
    if (!this.userEmail) {
      this.router.navigate(['auth/register'])
      return
    }
  }

  onSubmit(): void {

    if (this.form.invalid) {
      this.form.markAllAsTouched()
      return
    }

    this.isLoading = true

    const payload = {
      userEmail: this.userEmail,
      securityQuesId: Number(this.form.value.securityQuesId),
      securityAns: this.form.value.securityAns.trim()
    }

    console.log(payload)

    this.authService.setSecurityQuestion(payload).subscribe({

      next: (res: any) => {

        // stop loader
        this.isLoading = false

        console.log(res)

        // success snackbar
        this.snackBar.success('Security question saved successfully')

        // remove stored email
        localStorage.removeItem('registerEmail')

        // redirect after short delay
        setTimeout(() => {

          this.router.navigate(['/login'])

        }, 1000)
      },

      error: (err: any) => {
        this.isLoading = false;

        let message = 'failed';


        this.snackBar.error(message);
      }
    })
  }
}