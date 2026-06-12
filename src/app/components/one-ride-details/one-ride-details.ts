import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Ride } from '../../services/ride';
import { CommonModule } from '@angular/common';
import { MatDialog } from '@angular/material/dialog';
import { BookingService, BookSeatResponse } from '../../services/booking-service';
import { Snackbar } from '../../services/snackbar';
import { BookingDialog, BookingDialogResult } from '../booking-dialog/booking-dialog';
import { environment } from '../../../../environment';
import { AuthHelper } from '../../helpers/auth-helper';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-one-ride-details',
  imports: [CommonModule],
  templateUrl: './one-ride-details.html',
  styleUrl: './one-ride-details.css',
})
export class OneRideDetails {
   rideData: any = null;
  loading = true;
  error = '';
  rideId: string = '';
  booking = false;
  imageBaseUrl = environment.apiUrl
  /** Logged-in user's id — used to detect if this viewer cancelled their booking */
  currentUserId: string | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private rideService: Ride,
    private bookingService: BookingService,
    private dialog: MatDialog,
    private snack: Snackbar,
    private cdr: ChangeDetectorRef,
    private authService: AuthService
  ) {}
  ngOnInit() {
    // URL param first (shareable link), fallback to history.state (in-app nav)
    const paramId = this.route.snapshot.paramMap.get('rideId');
    const stateId = history.state?.ride_id;
    const rideId = paramId || stateId;

  if (!rideId) {
    this.error = 'Ride not found.';
    this.loading = false;
    return;
  }

  this.rideId = rideId;

  // Identify the logged-in viewer so we can detect their own cancelled booking
  if (AuthHelper.isLoggedIn()) {
    this.authService.getCurrentUser().subscribe({
      next: (res: any) => {
        this.currentUserId = res?.Id ?? res?.id ?? res?._id ?? null;
        this.cdr.detectChanges();
      },
      error: () => { /* not critical — watermark just won't show */ },
    });
  }

  this.rideService.getFullDetailsByRide(rideId).subscribe({
    next: (res) => {
      this.rideData = res.ride;
      this.loading = false;
    },
    error: () => {
      this.error = 'Failed to load ride details.';
      this.loading = false;
    }
  });
  }

  /** Bookings excluding ones cancelled by rider or passenger / rejected */
  get activeBookings(): any[] {
    const bookings: any[] = this.rideData?.bookings ?? [];
    return bookings.filter((b) => {
      const status = (b?.booking_status ?? b?.status ?? '').toString().toLowerCase();
      const passengerCancelled =
        (b?.status_by_passenger ?? '').toString().toLowerCase() === 'cancelled';
      const cancelledByAnyone = !!b?.cancelled_by; // 'passenger' | 'rider'
      return (
        status !== 'cancelled' &&
        status !== 'rejected' &&
        !passengerCancelled &&
        !cancelledByAnyone
      );
    });
  }

  /** True if the logged-in viewer has a booking on this ride that they cancelled */
  get cancelledByMe(): boolean {
    if (!this.currentUserId) return false;
    const bookings: any[] = this.rideData?.bookings ?? [];
    return bookings.some((b) => {
      const isMine = b?.passenger?._id === this.currentUserId;
      const passengerCancelled =
        b?.cancelled_by === 'passenger' ||
        (b?.status_by_passenger ?? '').toString().toLowerCase() === 'cancelled';
      return isMine && passengerCancelled;
    });
  }

  getInitials(name: string): string {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  formatDate(dt: string): string {
    return new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric',timeZone: 'UTC' });
  }

  formatTime(dt: string): string {
    return new Date(dt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit',timeZone: 'UTC'  });
  }

  getStatusColor(status: string): string {
    const map: any = { active: 'status-active', completed: 'status-completed', cancelled: 'status-cancelled', confirmed: 'status-confirmed' };
    return map[status] || 'status-default';
  }
  goBack(): void {
  window.history.back();
}

  copyShareLink(): void {
    if (!this.rideId) return;
    const link = `${window.location.origin}/ride-detail/${this.rideId}`;
    navigator.clipboard.writeText(link).then(
      () => this.snack.success('Ride link copied to clipboard!'),
      () => this.snack.error('Could not copy link. Please try again.')
    );
  }

  bookRide(): void {
    if (!this.rideData) return;

    if (!AuthHelper.isLoggedIn()) {
      this.snack.error('Please log in to book a ride.');
      // Send the user back to this exact ride page after they log in
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    const ride = {
      ride_id: this.rideId,
      from: this.rideData.start_location?.name,
      to: this.rideData.end_location?.name,
      departure_time: this.rideData.departure_time,
      available_seats: this.rideData.available_seats,
      price_per_seat: this.rideData.price_per_seat,
    };

    const dialogRef = this.dialog.open(BookingDialog, {
      data: { ride },
      panelClass: 'booking-dialog-panel',
      backdropClass: 'booking-backdrop',
    });

    dialogRef.afterClosed().subscribe((result: BookingDialogResult | null) => {
      if (!result || result.total === 0) return;

      this.booking = true;
      this.cdr.detectChanges();

      this.bookingService
        .bookSeat(this.rideId, result.males, result.females, result.isSameFamily)
        .subscribe({
          next: (res: BookSeatResponse) => {
            this.booking = false;
            this.rideData = {
              ...this.rideData,
              available_seats: res.ride_status.remaining_seats,
            };
            this.cdr.detectChanges();
            this.snack.success(
              `${result.total} seat(s) booked! (${result.males}M + ${result.females}F)`
            );
          },
          error: (err) => {
            this.booking = false;
            // Show whatever the backend sends; fall back to a generic message
            const message =
              err?.error?.message || err?.message || 'Booking failed. Please try again.';
            this.snack.error(message);
            this.cdr.detectChanges();
          },
        });
    });
  }
  goToProfile(userId: string) {
  this.router.navigate(['/my-profile'], { state: { user_id: userId } })
}
}
