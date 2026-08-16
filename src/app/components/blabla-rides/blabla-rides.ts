import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { BlablaRide, BlablaRideService } from '../../services/blabla-ride';
import { LoaderServices } from '../../services/loader-services';
import { baseCityOf } from '../../helpers/route-rules';

/**
 * BlaBlaCar rides curated by the admin.
 *
 * Public page — no login needed, ye rides sirf dekhne ke liye hain.
 * Har card seedha BlaBlaCar ke URL ka anchor hai.
 */
@Component({
  selector: 'app-blabla-rides',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './blabla-rides.html',
  styleUrl: './blabla-rides.css',
})
export class BlablaRidesPage {
  /** Sirf ye do routes — match-preferences page par bhi yahi options hain. */
  readonly routeOptions: { id: string; label: string; from: string; to: string }[] = [
    { id: 'gurgaon-saharanpur', label: 'Gurgaon → Saharanpur', from: 'gurgaon', to: 'saharanpur' },
    { id: 'saharanpur-gurgaon', label: 'Saharanpur → Gurgaon', from: 'saharanpur', to: 'gurgaon' },
  ];

  allRides: BlablaRide[] = [];
  rides: BlablaRide[] = [];
  loading = false;
  error = '';

  /* ── Filters ── */
  selectedRoute = '';   // '' = all routes
  filterDate = '';

  /* ── Pagination ── */
  readonly pageSize = 20;
  page = 1;

  /** Mobile par filter bar tabhi khulti hai jab filter icon click ho. */
  showFilters = false;

  /** Route dropdown ka apna panel — native select ka popup style nahi hota. */
  routeMenuOpen = false;

  @ViewChild('routeRef') routeRef!: ElementRef;

  private loader = inject(LoaderServices);

  constructor(
    private blablaService: BlablaRideService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.fetchRides();
  }

  fetchRides(): void {
    this.loading = true;
    this.error = '';
    this.loader.show();

    this.blablaService.getBlablaRides().subscribe({
      next: (res) => {
        this.allRides = res.rides || [];
        this.applyFilters();
        this.loading = false;
        this.loader.hide();
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Could not load BlaBla rides. Please try again.';
        this.loading = false;
        this.loader.hide();
        this.cdr.detectChanges();
      },
    });
  }

  applyFilters(): void {
    const route = this.routeOptions.find((r) => r.id === this.selectedRoute);

    this.rides = this.allRides.filter((ride) => {
      if (route) {
        if (baseCityOf(ride.source) !== route.from) return false;
        if (baseCityOf(ride.destination) !== route.to) return false;
      }
      if (this.filterDate && ride.ride_date !== this.filterDate) return false;
      return true;
    });

    // Filter badalne ke baad page 5 par rehna bekaar hai — list hi nayi hai.
    this.page = 1;

    this.cdr.detectChanges();
  }

  /* ── Pagination ──────────────────────────────────────────
     Poori list ek hi API call me aati hai, isliye slicing yahin hoti hai. */
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.rides.length / this.pageSize));
  }

  get pagedRides(): BlablaRide[] {
    const start = (this.page - 1) * this.pageSize;
    return this.rides.slice(start, start + this.pageSize);
  }

  /** "Showing X–Y" ke liye. */
  get pageStart(): number {
    return this.rides.length ? (this.page - 1) * this.pageSize + 1 : 0;
  }

  get pageEnd(): number {
    return Math.min(this.page * this.pageSize, this.rides.length);
  }

  /** Bahut pages hone par sirf current ke aas-paas ke 5 numbers dikhao. */
  get pageNumbers(): number[] {
    const total = this.totalPages;
    const size = Math.min(5, total);
    let start = Math.max(1, this.page - Math.floor(size / 2));
    start = Math.min(start, total - size + 1);
    return Array.from({ length: size }, (_, i) => start + i);
  }

  get firstShownPage(): number {
    return this.pageNumbers[0];
  }

  get lastShownPage(): number {
    const list = this.pageNumbers;
    return list[list.length - 1];
  }

  goToPage(page: number): void {
    const target = Math.min(Math.max(1, page), this.totalPages);
    if (target === this.page) return;

    this.page = target;
    // Nayi page ka pehla card top par ho, warna user list ke beech me khada rehta hai.
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.cdr.detectChanges();
  }

  clearFilters(): void {
    this.selectedRoute = '';
    this.filterDate = '';
    this.applyFilters();
  }

  toggleFilters(): void {
    this.showFilters = !this.showFilters;
    if (!this.showFilters) this.routeMenuOpen = false;
  }

  /* ── Route dropdown ── */
  get routeLabel(): string {
    return this.routeOptions.find((r) => r.id === this.selectedRoute)?.label ?? 'All routes';
  }

  toggleRouteMenu(): void {
    this.routeMenuOpen = !this.routeMenuOpen;
  }

  pickRoute(routeId: string): void {
    this.selectedRoute = routeId;
    this.routeMenuOpen = false;
    this.applyFilters();
  }

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.routeMenuOpen) return;
    if (this.routeRef && !this.routeRef.nativeElement.contains(event.target)) {
      this.routeMenuOpen = false;
      this.cdr.detectChanges();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.routeMenuOpen) return;
    this.routeMenuOpen = false;
    this.cdr.detectChanges();
  }

  get hasFilters(): boolean {
    return !!(this.selectedRoute || this.filterDate);
  }

  goToTrustRideRides(): void {
    this.router.navigate(['/trustride-rides']);
  }

  goToCreateBlablaRide(): void {
    this.router.navigate(['/create-blabla-ride']);
  }

  formatDateTime(ride: BlablaRide): string {
    if (!ride.departure_time) return '—';
    // departure_time fake-UTC hai — UTC me hi padho, warna IST shift ho jaata hai.
    return new Date(ride.departure_time).toLocaleString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    });
  }
}
