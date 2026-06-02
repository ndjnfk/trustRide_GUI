import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { ChangeDetectorRef, Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Router, RouterModule } from '@angular/router';
import { Ride as RideService } from '../../services/ride';
import { LoaderServices } from '../../services/loader-services';
import { BookingService, BookSeatResponse } from '../../services/booking-service';
import { Snackbar } from '../../services/snackbar';
import { BookingDialog, BookingDialogResult } from '../booking-dialog/booking-dialog';
import { AuthHelper } from '../../helpers/auth-helper';

export interface Ride {
  ride_id: string;
  driver_id: string;
  driver_name: string;
  from: string;
  to: string;
  departure_time: string;
  available_seats: number;
  price_per_seat: number;
  status: string;
}

@Component({
  selector: 'app-search-rides',
  imports: [CommonModule, FormsModule, RouterModule, HttpClientModule],
  templateUrl: './search-rides.html',
  styleUrl: './search-rides.css',
})
export class SearchRides {
  /* ── Results state ── */
  rides: Ride[] = [];
  from = '';
  to = '';

  /* ── City lists (same as dashboard) ── */
  readonly gurgaonAreas: string[] = [
     'Gurgaon',
    'Gurgaon Ambience Mall',
    'Gurgaon Cyber Park',
    'Gurgaon Rajiv Chowk',
    'Gurgaon Iffco Chowk',
    'Gurgaon Huda City Center Secor 29',
    'Gurgaon Sector 32 ,Jharsa Institutional Area',
    'Gurgaon Sector 48,Candor Tech Space',
    'Gurgaon Sector 21, Krishna Chowk'
  ];

  readonly saharanpurAreas: string[] = [
    'Saharanpur',
    'Saharanpur Clock Tower',
    'Saharanpur Dehradun Chowk',
    'Saharanpur Anupam Sweets',
    'Saharanpur Court Road',
    'Saharanpur Vishwakarma Chowk',
    'Saharanpur Hasanpur Chungi',
    'Saharanpur J V Jain College',
  ];

  get allAreas(): string[] {
    return [...this.gurgaonAreas, ...this.saharanpurAreas];
  }

  /* ── Form state ── */
  fromValue = '';
  toValue = '';

  /* ── Dropdown state ── */
  fromFiltered: string[] = [];
  toFiltered: string[] = [];
  showFromDropdown = false;
  showToDropdown = false;

  passengers = 1;
  selectedDateValue = '';
  dateOptions: { label: string; value: string }[] = [];

  loadingRides: Set<string> = new Set();

  @ViewChild('fromRef') fromRef!: ElementRef;
  @ViewChild('toRef') toRef!: ElementRef;

  private loader = inject(LoaderServices);

  constructor(
    private snackBar: MatSnackBar,
    private router: Router,
    private rideService: RideService,
    private bookingService: BookingService,
    private snack: Snackbar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {
    const state = history.state as { rides?: Ride[]; from?: string; to?: string };
    this.rides = state?.rides ?? [];
    this.from = state?.from ?? '';
    this.to = state?.to ?? '';

    // Pre-fill form with the route the user just searched
    this.fromValue = this.from;
    this.toValue = this.to;
  }

  ngOnInit(): void {
    this.buildDateOptions();
  }

  /* ── Autocomplete ── */
  onFromInput(): void {
    const q = this.fromValue.toLowerCase();
    this.fromFiltered = q
      ? this.allAreas.filter((a) => a.toLowerCase().includes(q))
      : this.allAreas;
    this.showFromDropdown = true;
  }

  onToInput(): void {
    const q = this.toValue.toLowerCase();
    this.toFiltered = q
      ? this.allAreas.filter((a) => a.toLowerCase().includes(q))
      : this.allAreas;
    this.showToDropdown = true;
  }

  selectFrom(area: string): void {
    this.fromValue = area;
    this.showFromDropdown = false;

    const base = this.getBaseCity(area);
    if (base === 'gurgaon' && !this.toValue) {
      this.toValue = 'Saharanpur';
    } else if (base === 'saharanpur' && !this.toValue) {
      this.toValue = 'Gurgaon';
    }
  }

  selectTo(area: string): void {
    this.toValue = area;
    this.showToDropdown = false;

    const base = this.getBaseCity(area);
    if (base === 'gurgaon' && !this.fromValue) {
      this.fromValue = 'Saharanpur';
    } else if (base === 'saharanpur' && !this.fromValue) {
      this.fromValue = 'Gurgaon';
    }
  }

  focusFrom(): void {
    this.fromFiltered = this.allAreas;
    this.showFromDropdown = true;
  }

  focusTo(): void {
    this.toFiltered = this.allAreas;
    this.showToDropdown = true;
  }

  swap(): void {
    [this.fromValue, this.toValue] = [this.toValue, this.fromValue];
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (this.fromRef && !this.fromRef.nativeElement.contains(e.target)) {
      this.showFromDropdown = false;
    }
    if (this.toRef && !this.toRef.nativeElement.contains(e.target)) {
      this.showToDropdown = false;
    }
  }

  private getBaseCity(areaValue: string): string {
    const v = areaValue.toLowerCase().trim();
    if (v.startsWith('gurgaon')) return 'gurgaon';
    if (v.startsWith('saharanpur')) return 'saharanpur';
    return v.split(' ')[0];
  }

  private getTargetDate(): string {
    return this.selectedDateValue;
  }

  search(): void {
    if (!this.fromValue.trim()) {
      this.showSnackBar('Please enter a departure location.', 'error');
      return;
    }
    if (!this.toValue.trim()) {
      this.showSnackBar('Please enter a destination', 'error');
      return;
    }

    this.loader.show();
    this.rideService.getRides().subscribe({
      next: (res: any) => {
        this.loader.hide();
        if (!res.success || !res.rides?.length) {
          this.showSnackBar('No rides found for this route.', 'error');
          return;
        }

        const fromCity = this.getBaseCity(this.fromValue);
        const toCity = this.getBaseCity(this.toValue);
        const targetDate = this.getTargetDate();

        const filtered = res.rides.filter((r: any) => {
          const rideFrom = r.from.toLowerCase();
          const rideTo = r.to.toLowerCase();
          const cityMatch = rideFrom.includes(fromCity) && rideTo.includes(toCity);

          const rideDate = new Date(r.departure_time).toLocaleDateString('en-CA');
          const dateMatch = rideDate === targetDate;

          const seatsMatch = (r.available_seats ?? 0) >= this.passengers;

          return cityMatch && dateMatch && seatsMatch;
        });

        if (!filtered.length) {
          this.showSnackBar(
            `No rides found with ${this.passengers} seat(s) available.`,
            'error'
          );
          return;
        }

        this.showSnackBar(`${filtered.length} ride(s) found!`, 'success');

        this.rides = filtered;
        this.from = this.fromValue;
        this.to = this.toValue;
      },
      error: (err: any) => {
        this.loader.hide();
        console.error(err);
        this.snackBar.open('Something went wrong. Please try again.', 'Close', {
          duration: 4000,
          panelClass: ['snack-error'],
        });
      },
    });
  }

  private showSnackBar(message: string, type: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: type === 'success' ? ['snack-success'] : ['snack-error'],
    });
  }

  buildDateOptions(): void {
    const opts: { label: string; value: string }[] = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const value = `${yyyy}-${mm}-${dd}`;

      let label: string;
      if (i === 0)
        label = `Today, ${dd} ${d.toLocaleString('en-IN', { month: 'short' })}`;
      else if (i === 1)
        label = `Tomorrow, ${dd} ${d.toLocaleString('en-IN', { month: 'short' })}`;
      else
        label = `${d.toLocaleString('en-IN', { weekday: 'short' })}, ${dd} ${d.toLocaleString('en-IN', { month: 'short' })}`;

      opts.push({ label, value });
    }

    this.dateOptions = opts;
    this.selectedDateValue = opts[0].value;
  }

  incrementPassengers(): void {
    if (this.passengers < 4) this.passengers++;
  }

  decrementPassengers(): void {
    if (this.passengers > 1) this.passengers--;
  }

  onDateChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.selectedDateValue = select.value;
  }

  /* ── Results ── */
  close(): void {
    this.router.navigate(['/dashboard']);
  }

  formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  openRideDetail(rideId: string) {
    this.router.navigate(['/ride-detail'], { state: { ride_id: rideId } });
  }

  bookRide(ride: Ride, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }

    if (!AuthHelper.isLoggedIn()) {
      this.showSnackBar('Please log in to book a ride.', 'error');
      this.router.navigate(['/login']);
      return;
    }

    const dialogRef = this.dialog.open(BookingDialog, {
      data: { ride },
      panelClass: 'booking-dialog-panel',
      backdropClass: 'booking-backdrop',
    });

    dialogRef.afterClosed().subscribe((result: BookingDialogResult | null) => {
      if (!result || result.total === 0) return;

      this.loadingRides.add(ride.ride_id);
      this.cdr.detectChanges();

      this.bookingService
        .bookSeat(ride.ride_id, result.males, result.females, result.isSameFamily)
        .subscribe({
          next: (res: BookSeatResponse) => {
            this.loadingRides.delete(ride.ride_id);

            this.rides = this.rides.map((r) =>
              r.ride_id === ride.ride_id
                ? { ...r, available_seats: res.ride_status.remaining_seats }
                : r
            );
            this.cdr.detectChanges();

            this.snack.success(
              `${result.total} seat(s) booked! (${result.males}M + ${result.females}F)`
            );
          },
          error: (err) => {
            this.loadingRides.delete(ride.ride_id);
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
}
