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
import { Router } from '@angular/router';
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

  // Rider's user id — backend may send under any of these keys
  driver_id?: string;
  driver_user_id?: string;
  driverId?: string;
  user_id?: string;

  ride_cancellation_reason?: string;
}

interface Booking {
  booking_id: string;
  status: string;
  gender: string;
  booked_at: string;
  seats_booked?: number;
  males?: number;
  females?: number;
  ride: RideInfo | null;
  review?: {
    rating: number;
    comment: string;
  } | null;

  // ── cancel-by-passenger fields (backend getUserBookings se aane chahiye) ──
   status_by_passenger?: string;                 // 👈 ye bhi chahiye
  cancelled_by?: string;
  cancellation_reason_by_passenger?: string;
}

interface ReviewState {
  rating: number;
  hovered: number;
  comment: string;
  submitting: boolean;
  submitted: boolean;
  error: string;
  submittedRating?: number;
  submittedComment?: string;
}

// ── Cancel modal state shape ──
interface CancelModalState {
  open: boolean;
  booking: Booking | null;
  selectedReason: string;
  otherReason: string;
  submitting: boolean;
  error: string;
}

// Key for localStorage — stores Set of booking_ids that were reviewed
const REVIEWED_KEY = 'reviewed_bookings';

@Component({
  selector: 'app-my-bookings',
  imports: [CommonModule, FormsModule],
  templateUrl: './my-bookings.html',
  styleUrl: './my-bookings.css',
  // changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyBookings implements OnInit {
  allBookings: Booking[] = [];
  isLoading = false;
  error = '';

  /** Active status filter tab */
  activeTab: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'ride_cancelled' | 'history' = 'pending';

  setTab(tab: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'ride_cancelled' | 'history'): void {
    this.activeTab = tab;
    this.cdr.markForCheck();
  }

  // private readonly BASE_URL = 'http://localhost:3333';
  private readonly BASE_URL = environment.apiUrl;
  // private readonly BASE_URL = 'http://34.207.242.45:3333';

  /** Track which panels are open — keyed by booking_id */
  openReviewPanel: Record<string, boolean> = {};

  /** Per-booking review form state */
  reviewStates: Record<string, ReviewState> = {};

  /** Persisted set of booking_ids already reviewed (survives reload) */
  private reviewedBookingIds: Set<string> = new Set();

  /** Cancelled-reason dropdown toggles — keyed by booking_id */
  openCancelReason: Record<string, boolean> = {};

  // ── Cancel booking: predefined reasons ──
  cancelReasons: string[] = [
    'Health issues',
    'Change in departure time',
    'Pickup point is far away',
    'Found another ride',
    'Booked by mistake',
  ];

  // ── Cancel booking: modal state ──
  cancelModal: CancelModalState = {
    open: false,
    booking: null,
    selectedReason: '',
    otherReason: '',
    submitting: false,
    error: '',
  };

  private loader = inject(LoaderServices);

  constructor(
    private http: HttpClient,
    private snackBar: Snackbar,
    private cdr: ChangeDetectorRef,
    private bookingService: BookingService,
    private router: Router
  ) { }

  /** Open the rider's profile from a booking card */
  goToRiderProfile(ride: RideInfo | null): void {
    console.log('[my-bookings] rider click — ride:', ride);
    if (!ride) return;
    const riderId =
      ride.driver_id ?? ride.driver_user_id ?? ride.driverId ?? ride.user_id;

    console.log('[my-bookings] resolved riderId:', riderId);
    if (!riderId) {
      console.warn('[my-bookings] No rider id on ride — cannot open profile', ride);
      return;
    }
    this.router.navigate(['/my-profile'], { state: { user_id: riderId } });
  }

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

  // get pendingBookings(): Booking[] {
  //   return this.allBookings.filter((b) => b.status === 'pending');
  // }

  // get confirmedBookings(): Booking[] {
  //   return this.allBookings.filter((b) => b.status === 'confirmed');
  // }

  // get rejectedBookings(): Booking[] {
  //   return this.allBookings.filter(
  //     (b) => b.status === 'cancelled' || b.status === 'rejected'
  //   );
  // }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC'
    });
  }

  formatTime(dateStr?: string): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC'
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

  // ── Cancelled-reason dropdown (driver/ride cancellation + passenger reason) ─

  toggleCancelReason(bookingId: string): void {
    this.openCancelReason[bookingId] = !this.openCancelReason[bookingId];
    this.cdr.markForCheck();
  }

  // ── Cancel booking by passenger ─────────────────────────────────────────────

  /** Open popup for a booking */
  openCancelModal(booking: Booking): void {
    this.cancelModal = {
      open: true,
      booking,
      selectedReason: '',
      otherReason: '',
      submitting: false,
      error: '',
    };
    this.cdr.markForCheck(); // OnPush — iske bina modal nahi khulega
  }

  /** Close popup */
  closeCancelModal(): void {
    if (this.cancelModal.submitting) return;
    this.cancelModal.open = false;
    this.cancelModal.booking = null;
    this.cdr.markForCheck();
  }

  /** Confirm cancel → API call */
  confirmCancelBooking(): void {
    const m = this.cancelModal;
    if (!m.booking) return;

    const finalReason =
      m.selectedReason === 'Other' ? m.otherReason.trim() : m.selectedReason;

    if (!m.selectedReason) {
      m.error = 'Please select a reason';
      this.cdr.markForCheck();
      return;
    }
    if (m.selectedReason === 'Other' && !finalReason) {
      m.error = 'Please write your reason';
      this.cdr.markForCheck();
      return;
    }

    m.error = '';
    m.submitting = true;
    this.cdr.markForCheck();

    const payload = {
      booking_id: m.booking.booking_id,
      status_by_passenger: 'cancelled',
      cancellation_reason_by_passenger: finalReason,
    };

    const rideId = m.booking.ride?.ride_id; 
     console.log('captured rideId:', rideId);    // 👈 pehle capture (m.booking null hone se pehle)

    this.bookingService.cancelBookingByPassenger(payload).subscribe({
      next: (res) => {
        m.submitting = false;
        m.open = false;
        m.booking = null;

        console.log('clearing rideStats for:', rideId);  // 👈 verify in console
        this.clearRideStatsForRide(rideId);
       

        this.snackBar.success(res?.message || 'Booking cancelled successfully');
        this.loadBookings();
        this.cdr.markForCheck();
      },
      error: (err) => {
        m.submitting = false;
        m.error = err?.error?.message || 'Something went wrong. Please try again.';
        this.cdr.markForCheck();
      },
    });
  }

  private clearRideStatsForRide(rideId?: string): void {
    console.log('🧹 clear called with rideId:', rideId);

    if (!rideId) { console.log('🧹 rideId missing — exit'); return; }

    const raw = localStorage.getItem('rideStats');     // ⚠️ getItem hona chahiye, removeItem NahI
    console.log('🧹 rideStats before:', raw);

    if (!raw) { console.log('🧹 rideStats key hi nahi hai — exit'); return; }

    const stats = JSON.parse(raw);
    console.log('🧹 keys in stats:', Object.keys(stats), '| looking for:', rideId);

    if (stats[rideId]) {
      delete stats[rideId];
      localStorage.setItem('rideStats', JSON.stringify(stats));
      console.log('🧹 DELETED. rideStats after:', localStorage.getItem('rideStats'));
    } else {
      console.log('🧹 ye rideId stats me NAHI mila — key mismatch!');
    }
  }
// Not Approved — sirf DRIVER-rejected (passenger-cancel exclude)


// ── Pending — passenger-cancelled + rider-cancelled + completed exclude ──
get pendingBookings(): Booking[] {
  return this.allBookings.filter(
    (b) => b.status === 'pending'
      && b.status_by_passenger !== 'cancelled'
      && b.ride?.ride_status !== 'cancelled'
      && b.ride?.ride_status !== 'completed'
  );
}

// ── Confirmed — passenger-cancelled + rider-cancelled + completed exclude ──
// Completed rides move out to the History tab.
get confirmedBookings(): Booking[] {
  return this.allBookings.filter(
    (b) => b.status === 'confirmed'
      && b.status_by_passenger !== 'cancelled'
      && b.ride?.ride_status !== 'cancelled'
      && b.ride?.ride_status !== 'completed'
  );
}

/** Only the last N days (by ride date), measured from today. Older rides are hidden. */
private readonly HISTORY_DAYS = 4;
private withinHistoryWindow(dateStr?: string): boolean {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  if (isNaN(t)) return false;
  // Cutoff = UTC midnight of (today − N days). UTC to match the cards, which
  // render dates with timeZone: 'UTC'. So a ride shown as "16 Jun" is judged
  // as 16 Jun here too — no off-by-a-day surprises across timezones.
  const now = new Date();
  const todayUtcMidnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const cutoff = todayUtcMidnight - this.HISTORY_DAYS * 24 * 60 * 60 * 1000;
  return t >= cutoff;
}

// ── History — finished rides (completed OR rider-cancelled) from the last 4 days only ──
// window is measured from the ride date (departure_time) — i.e. when the ride actually happened
get historyBookings(): Booking[] {
  return this.allBookings.filter(
    (b) => (b.ride?.ride_status === 'completed' || b.ride?.ride_status === 'cancelled')
      && this.withinHistoryWindow(b.ride?.departure_time)
  );
}

/** Short label describing what this booking was, given the ride is finished. */
historyLabel(b: Booking): string {
  if (b.ride?.ride_status === 'cancelled') return 'Ride cancelled by rider';
  // ride completed — describe the booking's own state
  if (b.status_by_passenger === 'cancelled') return 'You cancelled · ride completed';
  if (b.status === 'confirmed') return 'Confirmed · ride completed';
  if (b.status === 'pending') return 'Was pending · ride completed';
  if (b.status === 'rejected' || b.status === 'cancelled') return 'Not approved · ride completed';
  return 'Ride completed';
}

/** CSS tag class for the history label. */
historyLabelClass(b: Booking): string {
  if (b.ride?.ride_status === 'cancelled') return 'hist-tag hist-cancelled';
  if (b.status_by_passenger === 'cancelled') return 'hist-tag hist-cancelled';
  if (b.status === 'confirmed') return 'hist-tag hist-confirmed';
  if (b.status === 'pending') return 'hist-tag hist-pending';
  return 'hist-tag hist-rejected';
}

// ── Not Approved — driver-rejected; passenger-cancelled + rider-cancelled + completed exclude ──
get rejectedBookings(): Booking[] {
  return this.allBookings.filter(
    (b) =>
      (b.status === 'cancelled' || b.status === 'rejected') &&
      b.status_by_passenger !== 'cancelled' &&
      b.ride?.ride_status !== 'cancelled' &&
      b.ride?.ride_status !== 'completed'
  );
}

// ── Cancelled by you (passenger ne khud cancel ki) — completed exclude (history me jayegi) ──
get cancelledByMeBookings(): Booking[] {
  return this.allBookings.filter(
    (b) => b.status_by_passenger === 'cancelled'
      && b.ride?.ride_status !== 'completed'
  );
}

// ── Cancelled ride by rider (rider ne ride cancel ki, passenger ne nahi) — last 4 days only ──
get cancelledByRiderBookings(): Booking[] {
  return this.allBookings.filter(
    (b) => b.ride?.ride_status === 'cancelled' && b.status_by_passenger !== 'cancelled'
      && this.withinHistoryWindow(b.ride?.departure_time)
  );
}
}