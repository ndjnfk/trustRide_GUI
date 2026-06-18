import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ShopkeeperService } from '../../services/shopkeeper-service';

@Component({
  selector: 'app-shop-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class ShopLogin {
  email = '';
  password = '';
  submitting = false;
  error = '';
  justRegistered = false;

  constructor(
    private shopkeeper: ShopkeeperService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.justRegistered = this.route.snapshot.queryParamMap.get('registered') === '1';
  }

  submit() {
    this.error = '';
    if (!this.email.trim() || !this.password) {
      this.error = 'Please enter your email and password.';
      return;
    }

    this.submitting = true;
    this.shopkeeper.login(this.email.trim(), this.password).subscribe({
      next: () => {
        this.submitting = false;
        this.router.navigate(['/shop/dashboard']);
      },
      error: (err: any) => {
        this.submitting = false;
        this.error = err?.error?.message || 'Login failed. Please check your credentials.';
        this.cdr.detectChanges();
      },
    });
  }

  goToRegister() {
    this.router.navigate(['/shop/register']);
  }
}
