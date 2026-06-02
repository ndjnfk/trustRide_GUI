import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { BookingService } from '../../services/booking-service';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../../environment';
import { Snackbar } from '../../services/snackbar';
import { LoaderServices } from '../../services/loader-services';

interface RideInfo {
  ride_id: string;
  from: string;
  to: string;
  departure_time: string;
  price_per_seat: number;
  driver_name: string;
  driver_phone: number;
  ride_status: string;

  ride_cancellation_reason?: string;
}

interface Booking {
  booking_id: string;
  status: string;
  gender: string;
  booked_at: string;
  ride: RideInfo | null;
   review?: {
    rating: number;
    comment: string;
  } | null;
}

interface ReviewState {
  rating: number;
  hovered: number;
  comment: string;
  submitting: boolean;
  submitted: boolean;
  error: string;
  submittedRating?: number;   // ← add
  submittedComment?: string;
  

  
}

// Key for localStorage — stores Set of booking_ids that were reviewed
const REVIEWED_KEY = 'reviewed_bookings';

@Component({
  selector: 'app-my-bookings',
  imports: [CommonModule, FormsModule],
  templateUrl: './my-bookings.html',
  styleUrl: './my-bookings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyBookings implements OnInit {
  allBookings: Booking[] = [];
  isLoading = false;
  error = '';

  // private readonly BASE_URL = 'http://localhost:3333';
  private readonly BASE_URL = environment.apiUrl;
  // private readonly BASE_URL = 'http://34.207.242.45:3333';

  /** Track which panels are open — keyed by booking_id */
  openReviewPanel: Record<string, boolean> = {};

  /** Per-booking review form state */
  reviewStates: Record<string, ReviewState> = {};

  /** Persisted set of booking_ids already reviewed (survives reload) */
  private reviewedBookingIds: Set<string> = new Set();

  private loader = inject(LoaderServices);

  constructor(
    private http: HttpClient,
    private snackBar: Snackbar,
    private cdr: ChangeDetectorRef,
    private bookingService: BookingService
  ) { }

  ngOnInit(): void {
    this.loadReviewedFromStorage();
    this.cdr.detectChanges();
    this.loadBookings();
  }

  // ── Storage helpers ────────────────────────────────────────────────────────

  private loadReviewedFromStorage(): void {
    try {
      const raw = localStorage.getItem(REVIEWED_KEY);
      if (raw) {
        const parsed: string[] = JSON.parse(raw);
        this.reviewedBookingIds = new Set(parsed);
      }
    } catch {
      this.reviewedBookingIds = new Set();
    }
  }

  private saveReviewedToStorage(): void {
    try {
      localStorage.setItem(
        REVIEWED_KEY,
        JSON.stringify([...this.reviewedBookingIds])
      );
    } catch {
      // localStorage unavailable — ignore silently
    }
  }

  /** Call this from template to check submitted state (persisted + in-session) */
  isReviewSubmitted(bookingId: string): boolean {
    return (
      this.reviewedBookingIds.has(bookingId) ||
      (this.reviewStates[bookingId]?.submitted ?? false)
    );
  }

  // ── Bookings ───────────────────────────────────────────────────────────────

  // loadBookings(): void {
  //   this.isLoading = true;

  //   this.cdr.detectChanges();
  //   this.error = '';


  //   // DEBUG: Yeh line add karo temporarily
  //   console.log('loadBookings called, token:', localStorage.getItem('auth_token'));

  //   this.http
  //     .get<{ success: boolean; total: number; bookings: Booking[] }>(
  //       `${this.BASE_URL}/getUserBookings`
  //     )
  //     .subscribe({
  //       next: (res) => {
  //        console.log('Bookings:', JSON.stringify(res.bookings, null, 2));
  //         this.allBookings = res.bookings;
  //         this.isLoading = false;
  //         console.log('isLoading after:', this.isLoading);
  //         this.cdr.detectChanges();
  //       },
  //       error: (err) => {
  //         this.error = err?.error?.message || 'Failed to load bookings.';
  //         this.isLoading = false;
  //         this.cdr.detectChanges();
  //       },
  //     });
  // }


  loadBookings(): void {
  this.isLoading = true;
  this.loader.show();
  this.cdr.detectChanges();
  this.error = '';

  this.http
    .get<{ success: boolean; total: number; bookings: Booking[] }>(
      `${this.BASE_URL}/getUserBookings`
    )
    .subscribe({
      next: (res) => {
          console.log('First booking:', JSON.stringify(res.bookings[0], null, 2));
        this.allBookings = res.bookings;

        // ← backend se review data restore karo
        res.bookings.forEach((b: Booking) => {
          if (b.review) {
            this.reviewedBookingIds.add(b.booking_id);
            this.reviewStates[b.booking_id] = {
              rating: b.review.rating,
              hovered: 0,
              comment: b.review.comment,
              submitting: false,
              submitted: true,
              error: '',
              submittedRating: b.review.rating,
              submittedComment: b.review.comment,
            };
          }
        });

        this.isLoading = false;
        this.loader.hide();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load bookings.';
        this.isLoading = false;
        this.loader.hide();
        this.cdr.detectChanges();
      },
    });
}

  get pendingBookings(): Booking[] {
    return this.allBookings.filter((b) => b.status === 'pending');
  }

  get confirmedBookings(): Booking[] {
    return this.allBookings.filter((b) => b.status === 'confirmed');
  }

  get rejectedBookings(): Booking[] {
    return this.allBookings.filter(
      (b) => b.status === 'cancelled' || b.status === 'rejected'
    );
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  formatTime(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  }

  // ── Review panel ───────────────────────────────────────────────────────────

  /** Toggle ONLY the clicked card's panel; close all others */
  toggleReviewPanel(bookingId: string): void {
    if (this.isReviewSubmitted(bookingId)) return;

    // Initialize state if first open
    if (!this.reviewStates[bookingId]) {
      this.reviewStates[bookingId] = {
        rating: 0,
        hovered: 0,
        comment: '',
        submitting: false,
        submitted: false,
        error: '',
      };
    }

    const isCurrentlyOpen = this.openReviewPanel[bookingId];

    // Close ALL panels first (only one open at a time)
    this.openReviewPanel = {};

    // Re-open only if it was closed
    if (!isCurrentlyOpen) {
      this.openReviewPanel[bookingId] = true;
    }

    this.cdr.markForCheck();
  }

  setRating(bookingId: string, star: number): void {
    const s = this.reviewStates[bookingId];
    if (s && !s.submitted) {
      s.rating = star;
      s.error = '';
    }
  }

  setHover(bookingId: string, star: number): void {
    const s = this.reviewStates[bookingId];
    if (s && !s.submitted) s.hovered = star;
  }

  clearHover(bookingId: string): void {
    const s = this.reviewStates[bookingId];
    if (s) s.hovered = 0;
  }

  displayRating(bookingId: string): number {
    const s = this.reviewStates[bookingId];
    if (!s) return 0;
    return s.hovered || s.rating;
  }

  ratingLabel(n: number): string {
    const labels: Record<number, string> = {
      1: 'Poor',
      2: 'Below Average',
      3: 'Average',
      4: 'Good',
      5: 'Excellent!',
    };
    return labels[n] ?? '';
  }

  submitReview(bookingId: string, rideId: string): void {
    const s = this.reviewStates[bookingId];
    if (!s) return;

    if (s.rating === 0) {
      s.error = 'Please select a star rating before submitting.';
      this.cdr.markForCheck();
      return;
    }

    s.error = '';
    s.submitting = true;
    this.cdr.markForCheck();

    this.bookingService.submitReview(rideId, s.rating, s.comment).subscribe({
      next: () => {
        s.submitting = false;
        s.submitted = true;

        // Persist so it survives page reload
        this.reviewedBookingIds.add(bookingId);
        this.saveReviewedToStorage();

        // Close the panel
        this.openReviewPanel[bookingId] = false;

        this.snackBar.success('Review submitted successfully. Thank you for your feedback');

        this.cdr.markForCheck();
      },
      error: (err) => {
        s.submitting = false;

        if (err?.error?.message === 'You have already reviewed this ride') {
          s.submitted = true;
          this.reviewedBookingIds.add(bookingId);
          this.saveReviewedToStorage();
          this.openReviewPanel[bookingId] = false;

          this.snackBar.info('You have already submitted a review for this ride');
        } else {
          this.snackBar.error('Failed to submit your review. Please try again');
        }

        this.cdr.markForCheck();
      },
    });
  }
  openCancelReason: Record<string, boolean> = {};

toggleCancelReason(bookingId: string): void {
  this.openCancelReason[bookingId] = !this.openCancelReason[bookingId];
  this.cdr.markForCheck();
}

}