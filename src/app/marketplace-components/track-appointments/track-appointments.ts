import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';
import { AuthHelper } from '../../helpers/auth-helper';

@Component({
  selector: 'app-track-appointments',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './track-appointments.html',
  styleUrl: './track-appointments.css',
})
export class TrackAppointments {
  loading = true;
  error = '';
  appointments: any[] = [];

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
    this.marketplace.getMyAppointments().subscribe({
      next: (res: any) => { this.appointments = res?.data ?? []; this.loading = false; },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load your appointments.';
      },
    });
  }

  statusClass(s: string): string {
    return 'ta-pill ta-' + s;
  }

  formatDate(dt: string): string {
    if (!dt) return '';
    return new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  goBack(): void {
    window.history.back();
  }
}
