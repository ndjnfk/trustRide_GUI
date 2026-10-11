import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { Ride as RideService, RideData } from '../../services/ride';
import { LoaderServices } from '../../services/loader-services';
import { baseCityOf } from '../../helpers/route-rules';

/**
 * Public list of TrustRideSRE rides. Har card wahi ride-detail link hai jo
 * rider ko ride publish karne ke baad milta hai (/ride-detail/{ride_id}).
 *
 * Login ki zaroorat nahi — sirf dekhne ke liye hai. Booking abhi bhi ride
 * detail page se hoti hai, jahan auth check lagta hai.
 *
 * /rides/:route (home ke route cards) par route URL se lock hota hai —
 * dropdown chhup jaata hai, sirf date filter bachta hai. Purani rides (kal
 * ya usse pehle, aur aaj ki nikal chuki) kabhi nahi dikhti, aur list
 * date-wise groups me aati hai: Today, Tomorrow, phir aage.
 */
@Component({
  selector: 'app-trustride-rides',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './trustride-rides.html',
  styleUrl: './trustride-rides.css',
})
export class TrustrideRidesPage implements OnDestroy {
  /** Sirf ye do routes — match-preferences page par bhi yahi options hain. */
  readonly routeOptions: { id: string; label: string; from: string; to: string }[] = [
    { id: 'gurgaon-saharanpur', label: 'Gurgaon → Saharanpur', from: 'gurgaon', to: 'saharanpur' },
    { id: 'saharanpur-gurgaon', label: 'Saharanpur → Gurgaon', from: 'saharanpur', to: 'gurgaon' },
  ];

  /** URL se aaya route — set ho to page usi route par lock rehta hai. */
  lockedRoute: { id: string; label: string; from: string; to: string } | null = null;

  /** Aaj ki date (IST, YYYY-MM-DD) — date filter ka min aur past-day cutoff. */
  today = this.istDate(new Date());

  allRides: RideData[] = [];
  rides: RideData[] = [];
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
  private activatedRoute = inject(ActivatedRoute);
  private paramSub?: Subscription;

  constructor(
    private rideService: RideService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // paramMap subscribe — "Reverse" button se /rides/a-b → /rides/b-a par
    // component wahi rehta hai, sirf param badalta hai.
    let fetched = false;
    this.paramSub = this.activatedRoute.paramMap.subscribe((params) => {
      const routeId = params.get('route');
      this.lockedRoute = this.routeOptions.find((r) => r.id === routeId) ?? null;
      this.selectedRoute = this.lockedRoute?.id ?? '';
      this.routeMenuOpen = false;

      if (!fetched) {
        fetched = true;
        this.fetchRides();
      } else {
        this.applyFilters();
      }
    });
  }

  ngOnDestroy(): void {
    this.paramSub?.unsubscribe();
  }

  fetchRides(): void {
    this.loading = true;
    this.error = '';
    this.loader.show();

    this.rideService.getRides().subscribe({
      next: (res) => {
        this.allRides = res.rides || [];
        this.applyFilters();
        this.loading = false;
        this.loader.hide();
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Could not load rides. Please try again.';
        this.loading = false;
        this.loader.hide();
        this.cdr.detectChanges();
      },
    });
  }

  applyFilters(): void {
    const route = this.routeOptions.find((r) => r.id === this.selectedRoute);

    // Tab khula reh gaya ho to aadhi raat ke baad "aaj" badal jaata hai.
    this.today = this.istDate(new Date());
    // departure_time fake-UTC hai (IST wall-clock UTC ke roop me), isliye
    // "abhi" ko bhi usi tarah shift karke compare karo.
    const nowFakeUtc = Date.now() + 330 * 60 * 1000;

    this.rides = this.allRides.filter((ride) => {
      const day = this.rideDate(ride.departure_time);
      if (!day || day < this.today) return false;
      if (new Date(ride.departure_time).getTime() < nowFakeUtc) return false;
      if (route) {
        if (baseCityOf(ride.from) !== route.from) return false;
        if (baseCityOf(ride.to) !== route.to) return false;
      }
      if (this.filterDate && this.rideDate(ride.departure_time) !== this.filterDate) return false;
      return true;
    });

    // Date groups ka order isi par tika hai — backend ke sort par bharosa mat karo.
    this.rides.sort(
      (a, b) => new Date(a.departure_time).getTime() - new Date(b.departure_time).getTime()
    );

    // Filter badalne ke baad page 5 par rehna bekaar hai — list hi nayi hai.
    this.page = 1;

    this.cdr.detectChanges();
  }

  /* ── Pagination ──────────────────────────────────────────
     Poori list ek hi API call me aati hai, isliye slicing yahin hoti hai. */
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.rides.length / this.pageSize));
  }

  get pagedRides(): RideData[] {
    const start = (this.page - 1) * this.pageSize;
    return this.rides.slice(start, start + this.pageSize);
  }

  /**
   * Current page ki rides date-wise — Today, Tomorrow, phir aage. Pagination
   * ride count par hai, isliye ek date do pages me bant sakti hai; dono pages
   * par uska heading aata hai.
   */
  get rideGroups(): { date: string; label: string; sub: string; rides: RideData[] }[] {
    const groups: { date: string; label: string; sub: string; rides: RideData[] }[] = [];
    for (const ride of this.pagedRides) {
      const date = this.rideDate(ride.departure_time);
      let group = groups[groups.length - 1];
      if (!group || group.date !== date) {
        group = { date, ...this.dayLabel(date), rides: [] };
        groups.push(group);
      }
      group.rides.push(ride);
    }
    return groups;
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
    this.selectedRoute = this.lockedRoute?.id ?? '';
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
    // Locked route filter nahi hai — wo page ka hissa hai, clear nahi hota.
    return !!((!this.lockedRoute && this.selectedRoute) || this.filterDate);
  }

  /** Locked page par ulti direction — Saharanpur → Gurgaon ⇄ Gurgaon → Saharanpur. */
  reverseRoute(): void {
    if (!this.lockedRoute) return;
    const reverse = this.routeOptions.find(
      (r) => r.from === this.lockedRoute!.to && r.to === this.lockedRoute!.from
    );
    if (reverse) this.router.navigate(['/rides', reverse.id]);
  }

  goToSearch(): void {
    this.router.navigate(['/search-rides']);
  }

  goToBlablaRides(): void {
    this.router.navigate(['/blabla-rides']);
  }

  /** Card par sirf time — date group heading me already hai. */
  formatTime(iso: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    });
  }

  /** Ride ki calendar date (YYYY-MM-DD) — <input type="date"> se compare karne ke liye. */
  private rideDate(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'UTC' });
  }

  /** Asli "abhi" ki IST date — users India me hain, browser ka timezone kuch bhi ho. */
  private istDate(d: Date): string {
    return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  }

  /** Group heading: "Today" / "Tomorrow" / weekday, saath me "11 Oct 2026". */
  private dayLabel(date: string): { label: string; sub: string } {
    // YYYY-MM-DD ko UTC midnight maan kar padho — din kabhi khiskega nahi.
    const d = new Date(`${date}T00:00:00Z`);
    const sub = d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });

    const todayMs = new Date(`${this.today}T00:00:00Z`).getTime();
    const diffDays = Math.round((d.getTime() - todayMs) / 86400000);
    if (diffDays === 0) return { label: 'Today', sub };
    if (diffDays === 1) return { label: 'Tomorrow', sub };
    return { label: d.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'UTC' }), sub };
  }
}
