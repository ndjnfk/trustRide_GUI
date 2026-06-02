import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import { AuthHelper } from '../../helpers/auth-helper';

@Component({
  selector: 'app-logout',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './logout.html',
  styleUrls: ['./logout.css']
})
export class LogoutComponent {
  isLoading = false;
  errorMessage = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  onLogout(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.authService.logout().subscribe({
      next: () => {
        // ✅ Helper se session clear karo
        AuthHelper.logout();
        this.isLoading = false;
        this.router.navigate(['/login']).then(() => {
          window.location.reload();
        });
      },

      error: () => {
        // ✅ Error pe bhi session clear karo
        AuthHelper.logout();
        this.isLoading = false;
        this.router.navigate(['/login']).then(() => {
          window.location.reload();
        });
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/dashboard']);
  }
}