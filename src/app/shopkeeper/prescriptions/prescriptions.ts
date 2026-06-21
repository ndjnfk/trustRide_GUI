import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ShopkeeperService } from '../../services/shopkeeper-service';
import { environment } from '../../../../environment';

@Component({
  selector: 'app-shop-prescriptions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prescriptions.html',
  styleUrl: './prescriptions.css',
})
export class ShopPrescriptions {
  imageBaseUrl = environment.apiUrl;

  loading = true;
  error = '';
  orders: any[] = [];
  updatingId: string | null = null;

  statuses = ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];

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
    this.shopkeeper.getPrescriptions().subscribe({
      next: (res: any) => {
        this.orders = res?.data ?? [];
        if (Array.isArray(res?.statuses) && res.statuses.length) this.statuses = res.statuses;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 401) { this.shopkeeper.logout(); this.router.navigate(['/shop/login']); return; }
        this.error = err?.error?.message || 'Failed to load prescriptions.';
      },
    });
  }

  setStatus(o: any, status: string): void {
    if (o.status === status || this.updatingId) return;
    this.updatingId = o._id;
    const prev = o.status;
    o.status = status; // optimistic
    this.shopkeeper.updatePrescriptionStatus(o._id, status).subscribe({
      next: () => { this.updatingId = null; },
      error: (err) => {
        this.updatingId = null;
        o.status = prev;
        this.error = err?.error?.message || 'Failed to update status.';
      },
    });
  }

  statusLabel(s: string): string {
    return (s || '').replace(/_/g, ' ');
  }
  statusClass(s: string): string {
    return 'rx-pill rx-' + s;
  }

  isPdf(url?: string): boolean {
    return !!url && url.toLowerCase().endsWith('.pdf');
  }

  fullAddress(a: any): string {
    if (!a) return '';
    return [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ');
  }

  formatDate(dt: string): string {
    if (!dt) return '';
    return new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  goBack(): void {
    this.router.navigate(['/shop/dashboard']);
  }
}
