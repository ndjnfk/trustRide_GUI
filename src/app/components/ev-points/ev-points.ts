import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { EvPoint, EvPointsService, EvPricing, EvRouteResponse } from '../../services/ev-points';

/*
 * EV charging points page.
 *   /ev-points?ride=<id>  → is ride ke route par points, pickup → drop ke order me (timeline),
 *                           sirf wo jo driver ke pahunchne ke waqt khule honge
 *   /ev-points            → saare approved points jo abhi khule hain, city-wise
 * Price platform-wide hai (admin setting) — response ke `pricing` se.
 */
@Component({
  selector: 'app-ev-points',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ev-points.html',
  styleUrl: './ev-points.css',
})
export class EvPoints implements OnInit {
  private evService = inject(EvPointsService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  rideId = '';
  loading = true;
  error = '';
  pricing: EvPricing | null = null;

  // route mode
  rideInfo: EvRouteResponse['ride'] | null = null;
  routeMode: 'route' | 'city' | null = null;
  routeMessage = '';
  nearRouteKm = 3;
  closedCount = 0;        // timings ki wajah se hide hue points
  checkedAtLabel = '';    // directory mode: kis time par check kiya

  // directory mode
  cities: string[] = [];
  selectedCity = '';

  points: EvPoint[] = [];
  unpinnedPoints: EvPoint[] = []; // route mode: exact location nahi, sirf city

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.rideId = params.get('ride') ?? '';
      this.selectedCity = params.get('city') ?? '';
      this.load();
    });
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    if (this.rideId) {
      this.evService.alongRide(this.rideId).subscribe({
        next: (res) => {
          this.rideInfo = res.ride;
          this.routeMode = res.mode;
          this.routeMessage = res.message ?? '';
          this.nearRouteKm = res.near_route_km ?? 3;
          this.closedCount = res.closed_at_travel_time ?? 0;
          this.pricing = res.pricing ?? null;
          this.points = res.points ?? [];
          this.unpinnedPoints = res.unpinned_points ?? [];
          this.loading = false;
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.error = err?.error?.message || 'Could not load charging points for this ride.';
          this.loading = false;
          this.cdr.markForCheck();
        },
      });
      return;
    }

    this.evService.list(this.selectedCity).subscribe({
      next: (res) => {
        this.unpinnedPoints = [];
        this.cities = res.cities ?? [];
        this.closedCount = res.closed_now ?? 0;
        this.checkedAtLabel = res.checked_at_label ?? '';
        this.pricing = res.pricing ?? null;
        this.points = res.points ?? [];
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Could not load charging points.';
        this.loading = false;
        this.cdr.markForCheck();
      },
    });
  }

  onCityChange(city: string): void {
    this.selectedCity = city;
    this.load();
  }

  /**
   * City-wise groups. Route mode me backend points pickup→drop ke order me
   * (along_km) bhejta hai, isliye groups bhi usi order me bante hain —
   * pehle pickup wali city, phir raaste ki, phir drop.
   */
  get groupedByCity(): { city: string; points: EvPoint[]; along_km: number | null }[] {
    const map = new Map<string, { city: string; points: EvPoint[]; along_km: number | null }>();
    for (const p of this.points) {
      const key = (p.city || 'Other').trim().toLowerCase();
      if (!map.has(key)) map.set(key, { city: p.city || 'Other', points: [], along_km: p.along_km ?? null });
      const g = map.get(key)!;
      g.points.push(p);
      if (p.along_km != null && (g.along_km == null || p.along_km < g.along_km)) g.along_km = p.along_km;
    }
    return [...map.values()];
  }

  offRouteLabel(p: EvPoint): string {
    const m = p.off_route_m ?? 0;
    if (m < 300) return 'on the road';
    if (m < 1000) return `${m} m off route`;
    return `${(m / 1000).toFixed(1)} km off route`;
  }

  telHref(p: EvPoint): string {
    return `tel:+91${p.phone}`;
  }

  formatDate(d?: string): string {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' });
  }
}
