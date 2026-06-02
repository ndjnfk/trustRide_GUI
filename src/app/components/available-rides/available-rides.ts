import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Ride, RideData } from '../../services/ride';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BookingService, BookSeatResponse } from '../../services/booking-service';
import { Snackbar } from '../../services/snackbar';
import { MatDialog } from '@angular/material/dialog';
import { BookingDialog ,BookingDialogResult} from '../booking-dialog/booking-dialog';

@Component({
  selector: 'app-rides-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './available-rides.html',
  styleUrls: ['./available-rides.css']
})
export class AvailableRides {
  allRides: RideData[] = [];
  filteredRides: RideData[] = [];
  loading = true;
  error = '';

  // Filters
  routeFilter: 'all' | 'saharanpur-gurgaon' | 'gurgaon-saharanpur' = 'all';
  dateFilter = '';
  timeFilter = '';
  searchQuery = '';
  loadingRides: Set<string> = new Set()

  rideStats: any = {}

  constructor(private rideService: Ride, private bookingService: BookingService,
    private snackBar: Snackbar, private cdr: ChangeDetectorRef,  private dialog: MatDialog  ) { }
     ngOnInit(): void {

    const saved = localStorage.getItem('rideStats');
    if (saved) {
      this.rideStats = JSON.parse(saved);
    }
    this.loadRides();
  }
  openStats: any = {}

  toggleStats(rideId: string): void {
    this.openStats[rideId] = !this.openStats[rideId]
  }
  loadRides(): void {
    this.loading = true;
    this.cdr.detectChanges();
    this.rideService.getAllRides().subscribe({
      next: (res) => {
        this.allRides = [...res.rides].reverse();

        this.applyFilters();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.snackBar.error('Failed to load rides. Please try again.')
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    let rides = [...this.allRides];

    // Route filter
    if (this.routeFilter === 'saharanpur-gurgaon') {
      rides = rides.filter(r =>
        r.from.toLowerCase().includes('saharanpur') &&
        r.to.toLowerCase().includes('gurgaon')
      );
    } else if (this.routeFilter === 'gurgaon-saharanpur') {
      rides = rides.filter(r =>
        r.from.toLowerCase().includes('gurgaon') &&
        r.to.toLowerCase().includes('saharanpur')
      );
    }

    // Date filter
    if (this.dateFilter) {
      rides = rides.filter(r => {
        const rideDate = new Date(r.departure_time).toISOString().split('T')[0];
        return rideDate === this.dateFilter;
      });
    }

    // Time filter (HH:MM)
    if (this.timeFilter) {
      rides = rides.filter(r => {
        const rideTime = new Date(r.departure_time)
          .toTimeString().slice(0, 5);
        return rideTime >= this.timeFilter;
      });
    }

    // Substring search across from/to/driver_name
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      rides = rides.filter(r =>
        r.from.toLowerCase().includes(q) ||
        r.to.toLowerCase().includes(q) ||
        r.driver_name.toLowerCase().includes(q)
      );
    }

    this.filteredRides = rides;
  }

  clearFilters(): void {
    this.routeFilter = 'all';
    this.dateFilter = '';
    this.timeFilter = '';
    this.searchQuery = '';
    this.applyFilters();
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }

  getStatusClass(status: string): string {
    return status === 'active' ? 'status-active' : 'status-inactive';
  }


  // bookRide(rideId: string): void {
  //   this.cdr.detectChanges(); // ✅


  //   this.bookingService.bookSeat(rideId)
  //     .subscribe({

  //       next: (res: BookSeatResponse) => {
  //         this.loadingRides.delete(rideId)
  //         console.log(res)

  //         // realtime update
  //         this.rideStats = {
  //           ...this.rideStats,
  //           [rideId]: res.ride_status
  //         };
  //         localStorage.setItem('rideStats', JSON.stringify(this.rideStats));

  //         // ✅ allRides mein available_seats bhi update karo (UI real-time)
  //         this.allRides = this.allRides.map(ride =>
  //           ride.ride_id === rideId
  //             ? { ...ride, available_seats: res.ride_status.remaining_seats }
  //             : ride
  //         );
  //         this.applyFilters(); // filteredRides bhi update ho
  //         this.cdr.detectChanges(); // ✅

  //         // ✅ Success Snackbar
  //         this.snackBar.success('Your seat has been booked successfully');
  //       },

  //       error: (err) => {

  //         let message = 'Booking Failed'
  //         if (err?.status === 409) {
  //           message = 'You have already booked a seat for this ride.'
  //         } else if (err?.status === 500) {
  //           message = 'Server error. Please try again later.';
  //         }
  //         else if (err?.status === 403) {
  //           message = 'You must review your completed ride before creating a new booking.';
  //         }

  //         this.snackBar.error(message)
  //       }
  //     })
  // }


 bookRide(ride: any): void {
  console.log('ride id:', ride.ride_id);

  const dialogRef = this.dialog.open(BookingDialog, {
    data: { ride },
    panelClass: 'booking-dialog-panel',
    backdropClass: 'booking-backdrop',
  });

  dialogRef.afterClosed().subscribe((result: BookingDialogResult | null) => {
    console.log('dialog result:', result);
    if (!result || result.total === 0) return;

    console.log('calling bookSeat with:', {
      rideId: ride.ride_id,
      males: result.males,
      females: result.females
    });

    this.loadingRides.add(ride.ride_id);
    this.cdr.detectChanges();

    this.bookingService.bookSeat(ride.ride_id, result.males, result.females,result.isSameFamily)
      .subscribe({
        next: (res: BookSeatResponse) => {
          this.loadingRides.delete(ride.ride_id);

          this.rideStats = { ...this.rideStats, [ride.ride_id]: res.ride_status };
          localStorage.setItem('rideStats', JSON.stringify(this.rideStats));

          this.allRides = this.allRides.map(r =>
            r.ride_id === ride.ride_id
              ? { ...r, available_seats: res.ride_status.remaining_seats }
              : r
          );
          this.applyFilters();
          this.cdr.detectChanges();

          this.snackBar.success(`${result.total} seat(s) booked! (${result.males}M + ${result.females}F)`);
        },
        error: (err) => {
          this.loadingRides.delete(ride.ride_id);
          let message = 'Booking failed';
          if (err?.status === 409) message = 'You have already booked a seat for this ride.';
          else if (err?.status === 403) {
    // ← backend se aane wala exact message use karo
    if (err?.error?.message?.includes('review')) {
      message = 'Please review your completed ride before booking again.';
    } else if (err?.error?.message?.includes('ratio')) {
      message = 'Booking blocked — 2M + 2F ratio not allowed.';
    } else {
      message = err?.error?.message || 'Access denied.';
    }
  } 
          else if (err?.status === 500) message = 'Server error. Please try again later.';
          this.snackBar.error(message);
          this.cdr.detectChanges();
        }
      });
  });
}
}