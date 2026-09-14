import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Chart } from 'chart.js/auto';
import { Observable } from 'rxjs';
import {
  Adminservice,
  RideClickDeleteResponse,
  RideClickRow,
  RideClickViewer,
  RideClicksResponse,
} from '../../services/adminservice';
import { Snackbar } from '../../services/snackbar';
import { SideBar } from '../side-bar/side-bar';

/** Chart ka single-series blue — ek hi measure hai (clicks), isliye ek hi hue. */
const SERIES_BLUE = '#2a78d6';
const SERIES_BLUE_HOVER = '#256abf';
const GRID = '#eef0f6';
const INK_MUTED = '#6b7280';

/** Bar chart me itni hi rides — poori list niche table me hai. */
const CHART_TOP_N = 10;

/**
 * Admin: Ride Clicks.
 *
 * Do sawaalon ka jawab ek page par —
 *   1. "Kaunsi ride sabse zyada khuli?"  → upar ka bar chart + row ka total
 *   2. "Us ride par kisne kitne click kiye?" → row expand karo, viewer-wise
 *      breakdown khulta hai (riya 10, guest1 50, rohan 10…)
 *
 * Guest ka naam server deta hai — guest1, guest2… — kyunki uska koi account
 * nahi hota. Logged-in user ka apna naam dikhta hai.
 */
@Component({
  selector: 'app-ride-clicks',
  imports: [CommonModule, FormsModule, SideBar],
  templateUrl: './ride-clicks.html',
  styleUrl: './ride-clicks.css',
})
export class RideClicks implements OnInit, OnDestroy {
  data: RideClicksResponse | null = null;
  rides: RideClickRow[] = [];
  loading = true;
  error = '';

  /** Kaunsi rows expand hain — ride_id → true. */
  expanded: Record<string, boolean> = {};

  search = '';

  private canvasEl: HTMLCanvasElement | null = null;
  private chart: Chart<'bar', number[], string> | null = null;

  /**
   * Setter wala ViewChild — element DOM me aate (ya hatte) hi chalta hai,
   * isliye draw ka timing pakka hai. Canvas khud kisi *ngIf ke peeche nahi
   * rakha (dekho template) — warna query kabhi resolve hi nahi hoti aur chart
   * khaali reh jaata hai.
   */
  @ViewChild('clicksCanvas')
  set clicksCanvasRef(ref: ElementRef<HTMLCanvasElement> | undefined) {
    const el = ref?.nativeElement ?? null;
    if (el === this.canvasEl) return;

    this.canvasEl = el;
    if (el) this.renderChart();
    else this.destroyChart();
  }

  /** Abhi kaunsa record delete ho raha hai — uska button spinner dikhata hai. */
  deleting: string | null = null;

  constructor(
    private adminService: Adminservice,
    private cdr: ChangeDetectorRef,
    private snackbar: Snackbar
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroyChart();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();

    this.adminService.getRideClicks().subscribe({
      next: (res) => {
        this.data = res;
        this.rides = res.rides ?? [];
        this.loading = false;

        // Canvas pehle se DOM me hai (setter usko pehli CD par pakad chuka
        // hai), bas ab data aaya hai — isliye yahan seedha redraw. Refresh par
        // bhi yahi path chalta hai.
        this.cdr.detectChanges();
        this.renderChart();
      },
      error: (err) => {
        this.loading = false;
        this.error =
          err?.error?.message || err?.error?.error || 'Failed to load ride click stats.';
        this.cdr.detectChanges();
      },
    });
  }

  /* ── Delete ───────────────────────────────────────────────
     Sirf click counters delete hote hain — rides, users ya guest labels ko
     kuch nahi hota. Guest label isliye rakha jaata hai taaki jo device pehle
     guest1 tha, wo dobara click kare to guest1 hi rahe. */

  isDeleting(key: string): boolean {
    return this.deleting === key;
  }

  /** Poore ride ke saare viewers ke clicks. */
  deleteRideStats(ride: RideClickRow, event: Event): void {
    // Row ka expand toggle na ho jaaye.
    event.stopPropagation();

    const ok = window.confirm(
      `Delete all click stats for "${this.rideLabel(ride)}"?\n\n` +
        `${ride.total_clicks} click(s) from ${ride.viewers.length} viewer(s) will be removed. ` +
        `The ride itself is not deleted.`
    );
    if (!ok) return;

    this.runDelete(
      `ride:${ride.ride_id}`,
      this.adminService.deleteRideClicks(ride.ride_id),
      'Ride click stats deleted.'
    );
  }

  /** Ek viewer ka record, sirf is ride par. */
  deleteViewerStats(ride: RideClickRow, viewer: RideClickViewer): void {
    const ok = window.confirm(
      `Remove ${viewer.name}'s ${viewer.clicks} click(s) on "${this.rideLabel(ride)}"?`
    );
    if (!ok) return;

    this.runDelete(
      `viewer:${ride.ride_id}:${viewer.viewer_key}`,
      this.adminService.deleteViewerClicks(viewer.viewer_key, ride.ride_id),
      `${viewer.name}'s clicks on this ride were deleted.`
    );
  }

  /** Ek viewer ke clicks — har ride se. */
  deleteViewerEverywhere(viewer: RideClickViewer & { rides: number }): void {
    const ok = window.confirm(
      `Remove ${viewer.name} from the stats completely?\n\n` +
        `${viewer.clicks} click(s) across ${viewer.rides} ride(s) will be removed.`
    );
    if (!ok) return;

    this.runDelete(
      `all-rides:${viewer.viewer_key}`,
      this.adminService.deleteViewerClicks(viewer.viewer_key),
      `${viewer.name} was removed from the click stats.`
    );
  }

  /** Sab kuch clear — page zero se shuru. */
  clearAll(): void {
    const total = this.data?.summary.total_clicks ?? 0;
    const ok = window.confirm(
      `Clear ALL ride click stats?\n\n` +
        `${total} click(s) will be permanently deleted and the chart resets to zero. ` +
        `Guest labels (guest1, guest2…) are kept, so returning guests keep their name.`
    );
    if (!ok) return;

    this.runDelete('all', this.adminService.deleteAllRideClicks(), 'All click stats cleared.');
  }

  /** Delete + reload ka common flow. */
  private runDelete(
    key: string,
    request$: Observable<RideClickDeleteResponse>,
    fallbackMessage: string
  ): void {
    this.deleting = key;
    this.cdr.detectChanges();

    request$.subscribe({
      next: (res) => {
        this.deleting = null;
        this.snackbar.success(res?.message || fallbackMessage);
        // Fresh totals chahiye — chart aur dono tables sab isi call se bante hain.
        this.load();
      },
      error: (err) => {
        this.deleting = null;
        this.snackbar.error(
          err?.error?.message || err?.error?.error || 'Could not delete the click stats.'
        );
        this.cdr.detectChanges();
      },
    });
  }

  /* ── List ─────────────────────────────────────────────── */

  /** Search box ride, driver ya viewer ke naam — teeno par chalta hai. */
  get filteredRides(): RideClickRow[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.rides;
    return this.rides.filter(
      (r) =>
        r.from?.toLowerCase().includes(q) ||
        r.to?.toLowerCase().includes(q) ||
        r.driver_name?.toLowerCase().includes(q) ||
        r.viewers?.some((v) => v.name?.toLowerCase().includes(q))
    );
  }

  toggle(rideId: string): void {
    this.expanded[rideId] = !this.expanded[rideId];
  }

  isExpanded(rideId: string): boolean {
    return !!this.expanded[rideId];
  }

  expandAll(): void {
    this.filteredRides.forEach((r) => (this.expanded[r.ride_id] = true));
  }

  collapseAll(): void {
    this.expanded = {};
  }

  /** Viewer ki bar ki width — us ride ke total ka kitna hissa. */
  sharePercent(clicks: number, total: number): number {
    if (!total) return 0;
    return Math.max(2, Math.round((clicks / total) * 100));
  }

  rideLabel(ride: RideClickRow): string {
    const from = ride.from || '—';
    const to = ride.to || '—';
    return `${from} → ${to}`;
  }

  formatDateTime(iso: string | null): string {
    if (!iso) return '—';
    // departure_time fake-UTC hai — baaki panel ki tarah UTC me hi padho.
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    });
  }

  /** last_click_at asli UTC timestamp hai — ise local time me dikhao. */
  formatClickedAt(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  trackByRide(_index: number, ride: RideClickRow): string {
    return ride.ride_id;
  }

  /* ── Chart ────────────────────────────────────────────── */

  get topRides(): RideClickRow[] {
    return this.rides.slice(0, CHART_TOP_N);
  }

  /**
   * Ek bar ~38px. Data na ho to 0 — canvas DOM me to rehta hai (ViewChild ke
   * liye zaroori), par usko jagah nahi gherni chahiye; `.chart-box` ka
   * overflow:hidden usse clip kar deta hai.
   */
  get chartHeight(): number {
    if (!this.topRides.length) return 0;
    return Math.max(140, this.topRides.length * 38 + 56);
  }

  private destroyChart(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private renderChart(): void {
    const canvas = this.canvasEl;
    if (!canvas) return;

    const rides = this.topRides;
    this.destroyChart();
    if (!rides.length) return;

    // Labels ko yahin pakad lo — tick callback chart banne ke dauran chalta
    // hai, us waqt tak `this.chart` assign hua hi nahi hota.
    const labels = rides.map((r) => this.rideLabel(r));

    // Hamesha ~5 whole-number ticks. Bina iske 5 clicks par "0.5, 1.5" jaise
    // ticks aate hain aur 500 clicks par 500 ticks.
    const maxClicks = Math.max(...rides.map((r) => r.total_clicks), 1);
    const stepSize = Math.max(1, Math.ceil(maxClicks / 5));

    try {
      this.chart = new Chart(canvas, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              // Ek hi series hai, isliye legend ki zaroorat nahi — title hi
              // bata deta hai ki bar kya naap raha hai.
              label: 'Clicks',
              data: rides.map((r) => r.total_clicks),
              backgroundColor: SERIES_BLUE,
              hoverBackgroundColor: SERIES_BLUE_HOVER,
              borderRadius: 4,
              borderSkipped: 'start',
              barThickness: 18,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          layout: { padding: { right: 12 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const ride = rides[ctx.dataIndex];
                  const clicks = ctx.parsed.x ?? 0;
                  const people = ride?.viewers?.length ?? 0;
                  return `${clicks} click${clicks === 1 ? '' : 's'} · ${people} viewer${
                    people === 1 ? '' : 's'
                  }`;
                },
              },
            },
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: { color: INK_MUTED, precision: 0, stepSize },
              grid: { color: GRID },
              border: { display: false },
            },
            y: {
              grid: { display: false },
              border: { display: false },
              ticks: {
                color: INK_MUTED,
                // Lambe route names bar area kha jaate hain.
                callback: (_value, index) => {
                  const label = labels[index] ?? '';
                  return label.length > 34 ? `${label.slice(0, 33)}…` : label;
                },
              },
            },
          },
        },
      });
    } catch (err) {
      // Chart fail ho to page ka baaki data (tables) bilkul kaam karta rehta hai.
      console.error('[RideClicks] chart render failed', err);
    }
  }
}
