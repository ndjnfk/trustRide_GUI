import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { MarketplaceService } from '../../services/marketplace-service';

// Ordered shipping stages used for the progress tracker
const TRACK_STEPS = ['placed', 'processing', 'shipped', 'delivered'];

// Medical Store prescription stages (different lifecycle from product orders)
const RX_STEPS = ['pending', 'confirmed', 'out_for_delivery', 'delivered'];
const RX_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
};

@Component({
  selector: 'app-my-orders',
  imports: [CommonModule],
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.css',
})
export class MyOrders {
  orders: any[] = [];
  prescriptionOrders: any[] = [];
  loading = false;
  error = '';

  steps = TRACK_STEPS;
  rxSteps = RX_STEPS;
  rxLabels = RX_LABELS;
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

    forkJoin({
      orders: this.marketplace.getMyOrders().pipe(catchError(() => of(null))),
      prescriptions: this.marketplace.getMyPrescriptions().pipe(catchError(() => of(null))),
    }).subscribe({
      next: (res: any) => {
        // If both failed, surface an error; otherwise show what we have.
        if (!res.orders && !res.prescriptions) {
          this.error = 'Failed to load your orders.';
        } else {
          this.orders = res.orders?.orders || [];
          this.prescriptionOrders = res.prescriptions?.orders || [];
        }
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

  // Index of a prescription order's current stage in RX_STEPS
  currentRxStep(status: string): number {
    return RX_STEPS.indexOf(status);
  }

  isCancelled(status: string): boolean {
    return status === 'cancelled';
  }

  isDelivered(status: string): boolean {
    return status === 'delivered';
  }

  isImage(url: string): boolean {
    return /\.(jpg|jpeg|png|webp|gif)$/i.test(url || '');
  }

  goShopping() {
    this.router.navigate(['/marketplace']);
  }

  goTrackServices() {
    this.router.navigate(['/track-services']);
  }
}
