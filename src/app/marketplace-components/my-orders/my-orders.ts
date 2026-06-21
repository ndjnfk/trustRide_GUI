import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
  imports: [CommonModule, FormsModule],
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.css',
})
export class MyOrders {
  orders: any[] = [];
  prescriptionOrders: any[] = [];
  serviceBookings: any[] = [];
  appointments: any[] = [];
  loading = false;
  error = '';

  /** which of the 4 request types is shown */
  activeTab: 'products' | 'services' | 'pharmacy' | 'appointments' = 'products';

  /** existing reviews keyed by source_id ({rating, comment}) */
  reviews: Record<string, { rating: number; comment: string }> = {};
  /** open review draft keyed by source_id */
  reviewDraft: Record<string, { rating: number; comment: string; submitting: boolean }> = {};

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
      services: this.marketplace.getMyServiceBookings().pipe(catchError(() => of(null))),
      appointments: this.marketplace.getMyAppointments().pipe(catchError(() => of(null))),
      reviews: this.marketplace.getMyShopReviews().pipe(catchError(() => of(null))),
    }).subscribe({
      next: (res: any) => {
        // If everything failed, surface an error; otherwise show what we have.
        if (!res.orders && !res.prescriptions && !res.services && !res.appointments) {
          this.error = 'Failed to load your orders.';
        } else {
          this.orders = res.orders?.orders || [];
          this.prescriptionOrders = res.prescriptions?.orders || [];
          this.serviceBookings = res.services?.data || [];
          this.appointments = res.appointments?.data || [];
          this.reviews = res.reviews?.reviews || {};
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

  setTab(tab: 'products' | 'services' | 'pharmacy' | 'appointments') {
    this.activeTab = tab;
  }

  // ── Reviews ──
  /** the saved review for a source, if any */
  getReview(id: string) {
    return this.reviews[id] || null;
  }

  /** open the inline review form for a source */
  openReview(id: string) {
    if (!this.reviewDraft[id]) {
      this.reviewDraft[id] = { rating: 0, comment: '', submitting: false };
    }
  }

  setReviewStar(id: string, star: number) {
    if (this.reviewDraft[id]) this.reviewDraft[id].rating = star;
  }

  submitReview(sourceType: string, id: string) {
    const draft = this.reviewDraft[id];
    if (!draft || draft.rating < 1) return;
    draft.submitting = true;
    this.marketplace.submitShopReview({
      source_type: sourceType,
      source_id: id,
      rating: draft.rating,
      comment: draft.comment.trim(),
    }).subscribe({
      next: () => {
        this.reviews[id] = { rating: draft.rating, comment: draft.comment.trim() };
        delete this.reviewDraft[id];
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        draft.submitting = false;
        this.error = err?.error?.message || 'Could not submit review.';
        this.cdr.detectChanges();
      },
    });
  }

  /** star array helper for read-only display */
  starArray(n: number): boolean[] {
    return [1, 2, 3, 4, 5].map((i) => i <= Math.round(n));
  }

  /** generic status pill class for service bookings / appointments */
  statusPill(s: string): string {
    return 'mp-pill mp-' + (s || 'requested');
  }

  goShopping() {
    this.router.navigate(['/marketplace']);
  }
}
