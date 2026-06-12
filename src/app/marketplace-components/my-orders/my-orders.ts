import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';

// Ordered shipping stages used for the progress tracker
const TRACK_STEPS = ['placed', 'processing', 'shipped', 'delivered'];

@Component({
  selector: 'app-my-orders',
  imports: [CommonModule],
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.css',
})
export class MyOrders {
  orders: any[] = [];
  loading = false;
  error = '';

  steps = TRACK_STEPS;
  imageBase: string;

  constructor(
    private marketplace: MarketplaceService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.imageBase = marketplace.imageBase;
  }

  ngOnInit() {
    if (!this.marketplace.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/marketplace/orders' } });
      return;
    }
    this.fetchOrders();
  }

  fetchOrders() {
    this.loading = true;
    this.error = '';

    this.marketplace.getMyOrders().subscribe({
      next: (res: any) => {
        this.orders = res.orders || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load your orders.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // Index of the order's current stage in TRACK_STEPS (-1 if cancelled/unknown)
  currentStep(status: string): number {
    return TRACK_STEPS.indexOf(status);
  }

  isCancelled(status: string): boolean {
    return status === 'cancelled';
  }

  isDelivered(status: string): boolean {
    return status === 'delivered';
  }

  goShopping() {
    this.router.navigate(['/marketplace']);
  }
}
