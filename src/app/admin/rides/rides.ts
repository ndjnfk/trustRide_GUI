import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Adminservice } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { LoaderServices } from '../../services/loader-services';

@Component({
  selector: 'app-rides',
  imports: [CommonModule, DatePipe, UpperCasePipe, FormsModule, SideBar],
  templateUrl: './rides.html',
  styleUrl: './rides.css',
})
export class Rides {
  rides: any[] = []
  totalRides = 0
  loading = false
  error = ''
  selectedRide: any = null

  // ── Filters ──
  filterName = ''                                  // 2. rider name search
  filterDate = ''                                  // 3. particular date (YYYY-MM-DD)
  filterRoute = ''                                 // 4. route "From → To"
  filterScope: 'all' | 'past' | 'upcoming' = 'all' // 1. previous/upcoming of current date
  filterStatus = ''                                // 5. status: active / completed / cancelled

  private loader = inject(LoaderServices);

  constructor(private adminService: Adminservice, private cdr: ChangeDetectorRef,private snackbar:Snackbar) {}
 
  ngOnInit() {
    this.fetchRides()
  }
 
  fetchRides() {
    this.loading = true
    this.loader.show();
    this.error = ''

    this.adminService.getAllRides().subscribe({
      next: (res: any) => {
        this.rides = res.rides || []
        this.totalRides = res.total_rides || 0
        this.loading = false
        this.loader.hide();
          this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.error = 'Failed to load rides. Please try again.'
        this.loading = false
        this.loader.hide();
          this.cdr.detectChanges();
      }
    })
  }
 
  openBookings(ride: any) {
    this.selectedRide = ride
  }

  closePopup() {
    this.selectedRide = null
  }

  // ── Filtering ───────────────────────────────────────────────
  /** IST today (YYYY-MM-DD) — departure_time fake-UTC IST convention se match karne ke liye. */
  private get istToday(): string {
    return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10)
  }

  /** departure_time ka date part (YYYY-MM-DD). */
  private rideDateStr(ride: any): string {
    return (ride?.departure_time ?? '').slice(0, 10)
  }

  /** Loaded rides me se unique "From → To" routes (dropdown ke liye). */
  get routeOptions(): string[] {
    const set = new Set<string>()
    for (const r of this.rides) {
      const from = r.start_location?.name
      const to = r.end_location?.name
      if (from && to) set.add(`${from} → ${to}`)
    }
    return Array.from(set).sort()
  }

  get filteredRides(): any[] {
    const name = this.filterName.trim().toLowerCase()
    const today = this.istToday
    return this.rides.filter((r) => {
      // 1. Scope — previous (before today) ya upcoming
      if (this.filterScope !== 'all') {
        const d = this.rideDateStr(r)
        if (this.filterScope === 'past' && !(d < today)) return false
        if (this.filterScope === 'upcoming' && !(d >= today)) return false
      }
      // 2. Rider name
      if (name && !(r.driver?.fullName ?? '').toLowerCase().includes(name)) return false
      // 3. Particular date
      if (this.filterDate && this.rideDateStr(r) !== this.filterDate) return false
      // 4. Route
      if (this.filterRoute) {
        const route = `${r.start_location?.name} → ${r.end_location?.name}`
        if (route !== this.filterRoute) return false
      }
      // 5. Status
      if (this.filterStatus && r.status !== this.filterStatus) return false
      return true
    })
  }

  clearFilters() {
    this.filterName = ''
    this.filterDate = ''
    this.filterRoute = ''
    this.filterScope = 'all'
    this.filterStatus = ''
  }

  // ── Edit ride ───────────────────────────────────────────────
  editModal: {
    open: boolean;
    rideId: string;
    saving: boolean;
    error: string;
    form: {
      from: string; to: string; date: string; time: string;
      available_seats: number; price_per_seat: number;
      route_via: string; status: string;
      cancellation_reason: string; additional_notes: string;
    };
  } = this.emptyEditModal();

  private emptyEditModal() {
    return {
      open: false,
      rideId: '',
      saving: false,
      error: '',
      form: {
        from: '', to: '', date: '', time: '',
        available_seats: 1, price_per_seat: 0,
        route_via: '', status: 'active',
        cancellation_reason: '', additional_notes: '',
      },
    };
  }

  openEdit(ride: any) {
    const dep: string = ride?.departure_time ?? '';
    this.editModal = {
      open: true,
      rideId: ride.ride_id,
      saving: false,
      error: '',
      form: {
        from: ride.start_location?.name ?? '',
        to: ride.end_location?.name ?? '',
        date: dep.slice(0, 10),       // YYYY-MM-DD
        time: dep.slice(11, 16),      // HH:mm
        available_seats: ride.available_seats ?? 0,
        price_per_seat: ride.price_per_seat ?? 0,
        route_via: ride.route_via ?? '',
        status: ride.status ?? 'active',
        cancellation_reason: ride.cancellation_reason ?? '',
        additional_notes: ride.additional_notes ?? '',
      },
    };
  }

  closeEdit() {
    if (this.editModal.saving) return;
    this.editModal = this.emptyEditModal();
  }

  saveEdit() {
    const m = this.editModal;
    const f = m.form;

    if (!f.from.trim() || !f.to.trim()) { m.error = 'From and To are required.'; return; }
    if (!f.date || !f.time) { m.error = 'Date and time are required.'; return; }
    if (f.available_seats < 0) { m.error = 'Seats cannot be negative.'; return; }
    if (f.price_per_seat < 0) { m.error = 'Price cannot be negative.'; return; }
    if (f.status === 'cancelled' && !f.cancellation_reason.trim()) {
      m.error = 'Please provide a cancellation reason.'; return;
    }

    m.error = '';
    m.saving = true;

    this.adminService.updateRide({
      ride_id: m.rideId,
      from: f.from.trim(),
      to: f.to.trim(),
      departure_time: `${f.date}T${f.time}:00.000Z`,   // fake-UTC convention (createRide jaisa)
      available_seats: Number(f.available_seats),
      price_per_seat: Number(f.price_per_seat),
      route_via: f.route_via.trim(),
      status: f.status,
      cancellation_reason: f.cancellation_reason.trim(),
      additional_notes: f.additional_notes.trim(),
    }).subscribe({
      next: () => {
        this.editModal = this.emptyEditModal();
        this.snackbar.success('Ride updated successfully');
        this.fetchRides();
      },
      error: (err: any) => {
        m.saving = false;
        m.error = err?.error?.message || 'Failed to update ride. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  // ── Cancellation reason popup ──
  reasonPopup: { open: boolean; reason: string; from?: string; to?: string } = {
    open: false,
    reason: '',
  }

  openReason(ride: any) {
    if (ride.status !== 'cancelled' || !ride.cancellation_reason) return
    this.reasonPopup = {
      open: true,
      reason: ride.cancellation_reason,
      from: ride.start_location?.name,
      to: ride.end_location?.name,
    }
  }

  closeReason() {
    this.reasonPopup = { open: false, reason: '' }
  }
 
  getStars(rating: number): number[] {
    return Array(rating).fill(0)
  }
 
  getEmptyStars(rating: number): number[] {
    return Array(5 - rating).fill(0)
  }

  deletingRideId: string | null = null
 
deleteRide(ride: any) {
  const confirmDelete = window.confirm(
   `Do you want to delete the ride from ${ride.start_location?.name} to ${ride.end_location?.name}?`
  )
  if (!confirmDelete) return

  this.deletingRideId = ride.ride_id

  this.adminService.deleteRide(ride.ride_id).subscribe({
    next: (res: any) => {
      this.deletingRideId = null
      this.fetchRides()  // ← bas yeh karo, filter ki zaroorat nahi
    },
    error: (err: any) => {
      this.snackbar.error('Delete failed. Please try again.')
      this.deletingRideId = null
    }
  })
}
}
