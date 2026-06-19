import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';
import { AuthHelper } from '../../helpers/auth-helper';

@Component({
  selector: 'app-track-services',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './track-services.html',
  styleUrl: './track-services.css',
})
export class TrackServices {
  loading = true;
  error = '';
  bookings: any[] = [];

  readonly steps = ['requested', 'accepted', 'completed'];

  constructor(private marketplace: MarketplaceService, private router: Router) {}

  ngOnInit(): void {
    if (!AuthHelper.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.marketplace.getMyServiceBookings().subscribe({
      next: (res: any) => { this.bookings = res?.data ?? []; this.loading = false; },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load your services.';
      },
    });
  }

  /** index of the current status in the progress steps (rejected = -1) */
  stepIndex(status: string): number {
    return this.steps.indexOf(status);
  }

  formatDate(dt: string): string {
    if (!dt) return '';
    return new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  goBack(): void {
    window.history.back();
  }
}
