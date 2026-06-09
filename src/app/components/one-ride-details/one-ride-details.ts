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

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private rideService: Ride,
    private bookingService: BookingService,
    private dialog: MatDialog,
    private snack: Snackbar,
    private cdr: ChangeDetectorRef
    
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
      this.router.navigate(['/login']);
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
            let message = 'Booking failed';
            if (err?.status === 409) {
              message = 'You have already booked a seat for this ride.';
            } else if (err?.status === 403) {
              if (err?.error?.message?.includes('review')) {
                message = 'Please review your completed ride before booking again.';
              } else if (err?.error?.message?.includes('ratio')) {
                message = 'Booking blocked — 2M + 2F ratio not allowed.';
              } else {
                message = err?.error?.message || 'Access denied.';
              }
            } else if (err?.status === 500) {
              message = 'Server error. Please try again later.';
            }
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
