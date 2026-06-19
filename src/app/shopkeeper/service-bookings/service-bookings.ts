import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ShopkeeperService } from '../../services/shopkeeper-service';

@Component({
  selector: 'app-shop-service-bookings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './service-bookings.html',
  styleUrl: './service-bookings.css',
})
export class ShopServiceBookings {
  loading = true;
  error = '';
  bookings: any[] = [];
  updatingId: string | null = null;

  readonly statuses = ['requested', 'accepted', 'rejected', 'completed'];

  constructor(private shopkeeper: ShopkeeperService, private router: Router) {}

  ngOnInit(): void {
    if (!this.shopkeeper.isLoggedIn()) {
      this.router.navigate(['/shop/login']);
      return;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.shopkeeper.getServiceBookings().subscribe({
      next: (res: any) => { this.bookings = res?.data ?? []; this.loading = false; },
      error: (err) => {
        this.loading = false;
        if (err?.status === 401) { this.shopkeeper.logout(); this.router.navigate(['/shop/login']); return; }
        this.error = err?.error?.message || 'Failed to load bookings.';
      },
    });
  }

  setStatus(b: any, status: string): void {
    if (b.status === status || this.updatingId) return;
    this.updatingId = b._id;
    const prev = b.status;
    b.status = status; // optimistic
    this.shopkeeper.updateServiceBookingStatus(b._id, status).subscribe({
      next: () => { this.updatingId = null; },
      error: (err) => {
        this.updatingId = null;
        b.status = prev;
        this.error = err?.error?.message || 'Failed to update status.';
      },
    });
  }

  statusClass(s: string): string {
    return 'sb-pill sb-' + s;
  }

  formatDate(dt: string): string {
    if (!dt) return '';
    return new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  goBack(): void {
    this.router.navigate(['/shop/dashboard']);
  }
}
