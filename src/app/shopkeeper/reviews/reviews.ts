import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ShopkeeperService } from '../../services/shopkeeper-service';

@Component({
  selector: 'app-shop-reviews',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './reviews.html',
  styleUrl: './reviews.css',
})
export class ShopReviews {
  loading = true;
  error = '';
  reviews: any[] = [];
  doctors: { id: string; name: string }[] = [];
  average = 0;

  /** doctor filter — '' = all (only relevant for OPD shops) */
  doctorFilter = '';

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
    this.shopkeeper.getReviews().subscribe({
      next: (res: any) => {
        this.reviews = res?.data ?? [];
        this.doctors = res?.doctors ?? [];
        this.average = res?.average ?? 0;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 401) { this.shopkeeper.logout(); this.router.navigate(['/shop/login']); return; }
        this.error = err?.error?.message || 'Failed to load reviews.';
      },
    });
  }

  get filtered(): any[] {
    if (!this.doctorFilter) return this.reviews;
    return this.reviews.filter((r) => String(r.doctor_id) === this.doctorFilter);
  }

  stars(n: number): boolean[] {
    return [1, 2, 3, 4, 5].map((i) => i <= Math.round(n));
  }

  typeLabel(t: string): string {
    return ({ product: 'Product', service: 'Service', prescription: 'Pharmacy', appointment: 'Appointment' } as any)[t] || t;
  }

  formatDate(dt: string): string {
    if (!dt) return '';
    return new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  goBack(): void {
    this.router.navigate(['/shop/dashboard']);
  }
}
