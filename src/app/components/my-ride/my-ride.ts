
import { ChangeDetectionStrategy, ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Ride } from '../../services/ride';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { BookingService } from '../../services/booking-service';
import { Snackbar } from '../../services/snackbar';
import { MatDialog } from '@angular/material/dialog';
import { RideCancellationDialog } from '../ride-cancellation-dialog/ride-cancellation-dialog';
import { LoaderServices } from '../../services/loader-services';
import { BookingCancellationDialog } from '../booking-cancellation-dialog/booking-cancellation-dialog';

interface RideData {
  _id: string;
  user_id: string;

  start_location: { name: string };
  end_location: { name: string };
  departure_time: string;
  available_seats: number;
  price_per_seat: number;
  route_via : string;
  status: string;
  created_at: string;
  
cancellation_reason:string
}

@Component({
  selector: 'app-my-rides',
  standalone: true,
  imports: [CommonModule, MatSnackBarModule, FormsModule],
  templateUrl: './my-ride.html',
  styleUrl: './my-ride.css',
  // changeDetection: ChangeDetectionStrategy.OnPush,

})
export class MyRide implements OnInit {
  allRides: RideData[] = [];
  isLoading = true;
  error = '';
  deletingId: string | null = null;
  updatingId: string | null = null;

  

  private loader = inject(LoaderServices);

  

  constructor(private rideService: Ride, private router: Router, private snackBar: Snackbar, private cdr: ChangeDetectorRef, private bookingService: BookingService, private dialog: MatDialog) { }

  ngOnInit(): void {
    this.loadRides();
  }
  // Variables add karo
  showPassengers: { [rideId: string]: boolean } = {};
  passengers: { [rideId: string]: any[] } = {};
  loadingPassengers: { [rideId: string]: boolean } = {};
  verifyCode: { [bookingId: string]: number } = {};
  verifyResult: { [bookingId: string]: boolean | undefined } = {};
  updatingBookingId: string | null = null;
  loadRides(): void {

    console.log('loadRides called');
    this.isLoading = true;
    this.loader.show();
    this.cdr.detectChanges(); // Force initial render

    this.rideService.getUserRides().subscribe({
      next: (res: any) => {
        console.log('API Response', res);
        this.allRides = res.data.sort((a: RideData, b: RideData) => {
          if (a.status === 'active' && b.status !== 'active') return -1;
          if (a.status !== 'active' && b.status === 'active') return 1;
          return new Date(b.departure_time).getTime() - new Date(a.departure_time).getTime();
        });
        this.isLoading = false;
        this.loader.hide();
        this.cdr.detectChanges(); // Force update after data loads
      },
      error: (err) => {
        console.log('API Error', err);
        this.isLoading = false;
        this.loader.hide();
        this.cdr.detectChanges();
        if (err.status === 401) {
          this.snackBar.error('Please log in to continue');
          this.router.navigate(['/login']);
          return;
        }
        this.snackBar.error('Could not load rides. Please try again');
      }
    });
  }


  // confirm variable add karo
  showConfirm = false;
  pendingDeleteId: string | null = null;

  // deleteRide replace karo
  deleteRide(rideId: string): void {
    this.pendingDeleteId = rideId;
    this.showConfirm = true;
  }

  confirmDelete(): void {
    if (!this.pendingDeleteId) return;

    const rideId = this.pendingDeleteId;
    this.showConfirm = false;
    this.deletingId = rideId;

    this.rideService.deleteRide(rideId).subscribe({
      next: () => {
        this.allRides = this.allRides.filter(r => r._id !== rideId);
        this.deletingId = null;
        this.pendingDeleteId = null;
        this.snackBar.success('The ride has been deleted successfully');
        this.loadRides();
      },
      error: (err) => {
        this.deletingId = null;
        this.pendingDeleteId = null;
        if (err.status === 401) {
          this.snackBar.error('Please log in to continue');
          return;
        }
        this.snackBar.error('Failed to delete the ride');
      }
    });
  }

  cancelDelete(): void {
    this.showConfirm = false;
    this.pendingDeleteId = null;
  }
  // ─── Status Update ────────────────────────────────
  // updateStatus(ride: RideData, newStatus: string): void {
  //   if (ride.status === newStatus) return;

  //   this.updatingId = ride._id;
  //   this.rideService.updateRideStatus(ride._id, newStatus).subscribe({
  //     next: () => {
  //       ride.status = newStatus;
  //       // Re-sort — active pehle
  //       this.allRides = [...this.allRides].sort((a, b) => {
  //         if (a.status === 'active' && b.status !== 'active') return -1;
  //         if (a.status !== 'active' && b.status === 'active') return 1;
  //         return new Date(b.departure_time).getTime() - new Date(a.departure_time).getTime();

  //       });
  //       this.updatingId = null;


  //       this.snackBar.success('Ride status updated successfully')
  //       this.loadRides()
  //     },
  //     error: (err) => {
  //       this.updatingId = null;
  //       if (err.status === 401) {
  //         this.snackBar.error('Please log in to continue...');
  //         this.router.navigate(['/login']);
  //         return;
  //       }

  //       this.snackBar.error('Failed to update ride status');
  //     }
  //   });
  // }

  updateStatus(ride: RideData, newStatus: string): void {
  if (ride.status === newStatus) return;

  if (newStatus === 'cancelled') {
    const dialogRef = this.dialog.open(RideCancellationDialog, {
      data: { ride },
      panelClass: 'booking-dialog-panel',
      
    });

    dialogRef.afterClosed().subscribe((result: { reason: string } | null) => {
      if (!result) return; // user ne dialog band kiya — kuch mat karo
      this.callUpdateStatus(ride, newStatus, result.reason);
    });

  } else {
    this.callUpdateStatus(ride, newStatus, '');
  }
}

private callUpdateStatus(ride: RideData, newStatus: string, reason: string): void {
  this.updatingId = ride._id;
  this.rideService.updateRideStatus(ride._id, newStatus, reason).subscribe({
    next: () => {
      ride.status = newStatus;
      this.allRides = [...this.allRides].sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return new Date(b.departure_time).getTime() - new Date(a.departure_time).getTime();
      });
      this.updatingId = null;
      this.snackBar.success('Ride status updated successfully');
      this.loadRides();
    },
    error: (err) => {
      this.updatingId = null;
      if (err.status === 401) {
        this.snackBar.error('Please log in to continue...');
        this.router.navigate(['/login']);
        return;
      }
      this.snackBar.error('Failed to update ride status');
    }
  });
}

  // ✅ Status ke hisab se — time nahi
  get activeRides(): RideData[] {
    return this.allRides.filter(r => r.status === 'active');
  }

  get pastRides(): RideData[] {
    return this.allRides.filter(r => r.status === 'completed');
  }

  get cancelledRides(): RideData[] {
    return this.allRides.filter(r => r.status === 'cancelled');
  }

  get totalSeats(): number {
    return this.allRides.reduce((sum, r) => sum + r.available_seats, 0);
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleString('en-IN', {
     
      hour: '2-digit',
      minute: '2-digit',
      hour12: true, timeZone: 'UTC'
    });
  }
  formatDate(isoString: string): string {
    return new Date(isoString).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
    });
  }


  // Methods add karo
  // togglePassengers(rideId: string): void {
  //   this.showPassengers[rideId] = !this.showPassengers[rideId];

  //   // Pehli baar open ho tab fetch karo
  //   if (this.showPassengers[rideId] && !this.passengers[rideId]) {
  //     this.loadingPassengers[rideId] = true;
  //     this.cdr.markForCheck();

  //     this.rideService.getBookingsByRideId(rideId).subscribe({
  //       next: (res: any) => {
        
  //         this.passengers[rideId] = res.data.bookings;
  //         this.loadingPassengers[rideId] = false;
  //         this.cdr.markForCheck();
  //       },
  //       error: () => {
  //         this.passengers[rideId] = [];
  //         this.loadingPassengers[rideId] = false;
  //         this.cdr.markForCheck();
  //       }
  //     });
  //   }
  // }

  // verifyCode_fn(booking: any, rideId: string): void {
  //   const entered = Number(this.verifyCode[booking.booking_id]);
  //   const actual = Number(booking.user.code);
  //   this.verifyResult[booking.booking_id] = entered === actual;

  //   // 3 sec baad result reset karo
  //   setTimeout(() => {
  //     this.verifyResult[booking.booking_id] = undefined;
  //     this.cdr.detectChanges();
  //   }, 3000);
  // }

// Set karo
verifyCode_fn(booking: any, rideId: string): void {
    const entered = Number(this.verifyCode[booking.booking_id]);
    const actual = Number(booking.user.code);
    const result = entered === actual;
    
    this.verifyResult[booking.booking_id] = result;
    
    // ✅ localStorage mein save karo
    localStorage.setItem(`verify_${booking.booking_id}`, String(result));
    
    this.cdr.detectChanges();
}

// Load karo — togglePassengers mein
// togglePassengers(rideId: string): void {
//     this.showPassengers[rideId] = !this.showPassengers[rideId];

//     if (this.showPassengers[rideId] && !this.passengers[rideId]) {
//         this.loadingPassengers[rideId] = true;
//         this.cdr.markForCheck();

//         this.rideService.getBookingsByRideId(rideId).subscribe({
//             next: (res: any) => {
//                 this.passengers[rideId] = res.data.bookings;
//                 this.loadingPassengers[rideId] = false;

//                 // ✅ localStorage se verifyResult restore karo
//                 this.passengers[rideId].forEach((b: any) => {
//                     const saved = localStorage.getItem(`verify_${b.booking_id}`);
//                     if (saved !== null) {
//                         this.verifyResult[b.booking_id] = saved === 'true';
//                     }
//                 });

//                 this.cdr.markForCheck();
//             },
//             error: () => {
//                 this.passengers[rideId] = [];
//                 this.loadingPassengers[rideId] = false;
//                 this.cdr.markForCheck();
//             }
//         });
//     }
// }


togglePassengers(rideId: string): void {
  this.showPassengers[rideId] = !this.showPassengers[rideId];

  if (this.showPassengers[rideId] && !this.passengers[rideId]) {
    this.loadingPassengers[rideId] = true;
    this.cdr.markForCheck();

    this.rideService.getBookingsByRideId(rideId).subscribe({
      next: (res: any) => {
        // 👇 passenger-cancelled bookings list me mat dikhao
        this.passengers[rideId] = (res.data?.bookings || []).filter(
          (b: any) => b.status_by_passenger !== 'cancelled'
        );

        this.loadingPassengers[rideId] = false;

        // localStorage se verifyResult restore karo
        this.passengers[rideId].forEach((b: any) => {
          const saved = localStorage.getItem(`verify_${b.booking_id}`);
          if (saved !== null) {
            this.verifyResult[b.booking_id] = saved === 'true';
          }
        });

        this.cdr.markForCheck();
      },
      error: () => {
        this.passengers[rideId] = [];
        this.loadingPassengers[rideId] = false;
        this.cdr.markForCheck();
      }
    });
  }
}

isCancelledByPassenger(b: any): boolean {
  console.log("is cancel by passenger:", b)
  return b?.status_by_passenger === 'cancelled';
}
 
  // Booking status update
  // updateBookingStatus(booking: any, rideId: string, newStatus: string): void {
  //   if (booking.status === newStatus) return;

  //   this.updatingBookingId = booking.booking_id;

  //   this.bookingService.updateBookingStatus(booking.booking_id, newStatus).subscribe({
  //     next: () => {
  //       // Local list update karo
  //       const list = this.passengers[rideId];
  //       const found = list.find((b: any) => b.booking_id === booking.booking_id);
  //       if (found) found.status = newStatus;

  //       this.updatingBookingId = null;
  //       this.cdr.detectChanges();

  //       this.snackBar.success('Booking status updated successfully');
  //     },
  //     error: (err: any) => {
  //       this.updatingBookingId = null;
  //       this.snackBar.error('Failed to update booking status');
  //     }
  //   });
  // }


  // updateBookingStatus method replace karo
updateBookingStatus(booking: any, rideId: string, newStatus: string): void {
  if (booking.status === newStatus) return;

  if (newStatus === 'cancelled') {
    const dialogRef = this.dialog.open(BookingCancellationDialog, {
      data: { ride: booking, isBooking: true },
      panelClass: 'booking-dialog-panel',
      
     
    });

    dialogRef.afterClosed().subscribe((result: { reason: string } | null) => {
      if (!result) return;
      this.callUpdateBookingStatus(booking, rideId, newStatus, result.reason);
    });

  } else {
    this.callUpdateBookingStatus(booking, rideId, newStatus, '');
  }
}

private callUpdateBookingStatus(booking: any, rideId: string, newStatus: string, reason: string): void {
  this.updatingBookingId = booking.booking_id;

  this.bookingService.updateBookingStatus(booking.booking_id, newStatus, reason).subscribe({
    next: () => {
      const list = this.passengers[rideId];
      const found = list.find((b: any) => b.booking_id === booking.booking_id);
      if (found) {
        found.status = newStatus;
        if (reason) found.cancellation_reason = reason;
      }

      this.updatingBookingId = null;
      this.cdr.detectChanges();
      this.snackBar.success('Booking status updated successfully');
    },
    error: (err: any) => {
      this.updatingBookingId = null;
      this.snackBar.error('Failed to update booking status');
    }
  });
}


goToProfile(userId: string) {
  console.log('Navigating with userId:', userId)  // ✅ check karo
  this.router.navigate(['/my-profile'], { state: { user_id: userId } })
}
}

