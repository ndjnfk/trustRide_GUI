import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Injector,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  afterNextRender,
  inject,
} from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import type * as Leaflet from 'leaflet';
import { Sharer, SharerLocation, TrackingInfo, TrackingService } from '../../services/tracking-service';
import { RouteMapService, decodePolyline } from '../../services/route-map-service';
import { loadLeafletCss } from '../ride-route-map/ride-route-map';
import { Snackbar } from '../../services/snackbar';

const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILES_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
/**
 * Itne second se purani location = offline — marker map se hat jaata hai.
 * Sharer har 5 sec bhejta hai (ruka ho to bhi 10 sec heartbeat), to 30 sec = app band.
 */
const STALE_AFTER_S = 30;
const DRIVER_COLOR = '#7c3aed';
/** Har passenger ka apna rang (driver purple) */
const PAX_COLORS = ['#0a58ff', '#16a34a', '#ea580c', '#db2777', '#0891b2', '#ca8a04'];
/** Itne px se paas do marker = ek ke upar ek — side me khiska do */
const OVERLAP_PX = 30;

interface SharerRow extends Sharer {
  loc: SharerLocation | null;
  /** driver ne sharing shuru hi nahi ki — list me phir bhi dikhta hai */
  notSharing?: boolean;
}

/**
 * Live ride tracking page.
 *   /live-tracking/:rideId  — driver / confirmed passenger (dekhe + apni location share kare)
 *   /track/:token           — parents ka bina-login share link
 *
 * Driver aur passengers sab ek gaadi me hain — "gaadi ki location" = driver ki taaza
 * location, wo na ho (phone band/lock) to kisi passenger ki sabse taaza location.
 */
@Component({
  selector: 'app-live-tracking',
  imports: [CommonModule, RouterModule],
  templateUrl: './live-tracking.html',
  styleUrl: './live-tracking.css',
})
export class LiveTracking implements AfterViewInit, OnDestroy {
  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;
  private mapStarted = false;
  private injector = inject(Injector);

  loading = true;
  error = '';
  info: TrackingInfo | null = null;
  ended = false;
  /** har second badhta hai — age calculations isi se refresh hote hain */
  now = Date.now();

  // main khud share kar raha hoon
  sharing = false;
  starting = false;
  stopping = false;
  sendError = '';

  sharingLink = false;
  follow = true;

  private rideId = '';
  token = '';
  private sharers = new Map<string, Sharer>();
  private locations = new Map<string, SharerLocation>();
  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private markers = new Map<string, Leaflet.Marker>();
  private accuracyCircle?: Leaflet.Circle;
  private centeredOnce = false;
  /** kaun primary + kaun stale — badle to hi markers dobara banao */
  private lastSignature = '';
  private subs: Subscription[] = [];
  private ticker?: ReturnType<typeof setInterval>;
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  constructor(
    private route: ActivatedRoute,
    private tracking: TrackingService,
    private routeMaps: RouteMapService,
    private snackBar: Snackbar,
    private cdr: ChangeDetectorRef
  ) {}

  get role() {
    return this.info?.role ?? null;
  }
  get isGuest() {
    return this.role === 'guest';
  }
  /** driver aur confirmed passenger apni location share kar sakte hain */
  get canShare() {
    return this.role === 'driver' || this.role === 'passenger';
  }
  get active() {
    return this.sharers.size > 0;
  }

  /** Map ke neeche ki list — driver pehle; driver share na kar raha ho to bhi dikhe */
  get rows(): SharerRow[] {
    const rows: SharerRow[] = [...this.sharers.values()]
      .map((s) => ({ ...s, loc: this.locations.get(s.user_id) ?? null }))
      .sort((a, b) => (a.role === b.role ? a.name.localeCompare(b.name) : a.role === 'driver' ? -1 : 1));
    if (this.info && !this.ended && !this.driverSharing) {
      const name = this.info.ride.driver_name.trim().split(/\s+/)[0] || 'Driver';
      rows.unshift({ user_id: '', role: 'driver', name, loc: null, notSharing: true });
    }
    return rows;
  }

  /** driver ne "Share my live location" dabaya hua hai (phone offline ho sakta hai) */
  get driverSharing(): boolean {
    return [...this.sharers.values()].some((s) => s.role === 'driver');
  }

  /** Gaadi ki location — driver ki taaza ho to wahi, warna passenger ki sabse taaza */
  get primary(): SharerLocation | null {
    const fresh = [...this.locations.values()].filter((l) => !this.isStale(l));
    const driver = fresh.find((l) => l.role === 'driver');
    if (driver) return driver;
    if (fresh.length) return fresh.reduce((a, b) => (b.ts > a.ts ? b : a));
    // sab purane — sabse aakhri wala dikhao (signal lost)
    const all = [...this.locations.values()];
    return all.length ? all.reduce((a, b) => (b.ts > a.ts ? b : a)) : null;
  }

  /** driver ka phone band/lock — gaadi passenger ke phone se dikh rahi hai */
  get viaPassenger(): boolean {
    const p = this.primary;
    return !!p && p.role === 'passenger' && !this.isStale(p);
  }

  /** Map marker aur list ka dot ek hi rang — driver purple, passengers alag-alag */
  colorOf(s: { role: string; user_id: string }): string {
    if (s.role === 'driver') return DRIVER_COLOR;
    const pax = [...this.sharers.values()].filter((x) => x.role === 'passenger').map((x) => x.user_id).sort();
    const i = pax.indexOf(s.user_id);
    return PAX_COLORS[(i < 0 ? 0 : i) % PAX_COLORS.length];
  }

  ageS(l: { ts: number } | null): number {
    return l ? Math.max(0, Math.round((this.now - l.ts) / 1000)) : 0;
  }
  isStale(l: { ts: number } | null): boolean {
    return !!l && this.ageS(l) > STALE_AFTER_S;
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;
    this.rideId = this.route.snapshot.paramMap.get('rideId') ?? '';
    this.token = this.route.snapshot.paramMap.get('token') ?? '';

    const req = this.token ? this.tracking.getPublicTracking(this.token) : this.tracking.getTracking(this.rideId);
    req.subscribe({
      next: (res) => {
        this.info = res;
        this.rideId = res.ride.ride_id;
        for (const s of res.sharers || []) this.sharers.set(s.user_id, s);
        for (const l of res.locations || []) this.locations.set(l.user_id, l);
        this.sharing = this.canShare && this.tracking.isSharing(this.rideId);
        this.loading = false;
        this.cdr.markForCheck();
        // Map ka div `*ngIf` ke andar hai — app zoneless hai, render ke baad hi DOM me aata hai
        afterNextRender(() => this.renderMap(), { injector: this.injector });
        this.listen();
      },
      error: (e) => {
        this.loading = false;
        this.error =
          e?.status === 404 && this.token
            ? 'This tracking link has expired. The ride may have ended.'
            : e?.error?.message || 'Could not load live tracking.';
        this.cdr.markForCheck();
      },
    });

    this.ticker = setInterval(() => {
      this.now = Date.now();
      // naya point na aaye tab bhi — koi stale ho ya gaadi kisi aur ke phone par shift ho, turant redraw
      const sig = this.markerSignature();
      if (sig !== this.lastSignature) this.drawMarkers();
      this.cdr.markForCheck();
    }, 1000);
  }

  ngOnDestroy(): void {
    this.subs.forEach((s) => s.unsubscribe());
    if (this.ticker) clearInterval(this.ticker);
    this.tracking.unwatch();
    this.map?.remove();
    // Page chhode to bhi GPS chalta rahe (app khuli hai) — Stop button se hi band
  }

  // ── live updates ──
  private listen(): void {
    if (this.canShare) {
      // app khulte hi auto-resume page ke baad bhi ho sakta hai — button usi hisaab se
      this.subs.push(
        this.tracking.sharingRide$.subscribe((id) => {
          this.sharing = id === this.rideId;
          this.cdr.markForCheck();
        })
      );
      // apne bheje points ki galti (network / ride khatam) — points khud socket se aate hain
      this.subs.push(
        this.tracking.sent$.subscribe((r) => {
          this.sendError = r.ok ? '' : r.error || '';
          if (r.stopped) this.sharing = false;
          this.cdr.markForCheck();
        })
      );
    }

    // sab (sharer bhi) socket se dekhte hain — baaki logon ki location bhi chahiye
    const events = this.token
      ? this.tracking.watch({ trackToken: this.token })
      : this.tracking.watch({ rideId: this.rideId });
    this.subs.push(
      events.subscribe((ev) => {
        if (ev.type === 'location') {
          const p = ev.point;
          this.sharers.set(p.user_id, { user_id: p.user_id, role: p.role, name: p.name });
          this.locations.set(p.user_id, p);
          this.drawMarkers();
        } else if (ev.ended) {
          this.ended = true;
          this.sharers.clear();
          this.locations.clear();
          this.drawMarkers();
        } else if (ev.user_id) {
          if (ev.active && ev.role) {
            this.sharers.set(ev.user_id, { user_id: ev.user_id, role: ev.role, name: ev.name || '' });
          } else {
            this.sharers.delete(ev.user_id);
            this.locations.delete(ev.user_id);
            this.drawMarkers();
          }
        }
        this.cdr.markForCheck();
      })
    );
  }

  // ── apni location share ──
  async startSharing(): Promise<void> {
    if (this.starting) return;
    this.starting = true;
    this.sendError = '';
    try {
      await this.tracking.startSharing(this.rideId);
      this.sharing = true;
      this.snackBar.success('Live location sharing started');
    } catch (e: any) {
      this.snackBar.error(e?.message || 'Could not start live tracking');
    } finally {
      this.starting = false;
      this.cdr.markForCheck();
    }
  }

  async stopSharing(): Promise<void> {
    if (this.stopping) return;
    this.stopping = true;
    await this.tracking.stopSharing(this.rideId);
    this.sharing = false;
    this.stopping = false;
    this.snackBar.success('Live location sharing stopped');
    this.cdr.markForCheck();
  }

  // ── share with family ──
  shareWithFamily(): void {
    if (this.sharingLink) return;
    this.sharingLink = true;
    this.tracking.createShareLink(this.rideId).subscribe({
      next: async (res) => {
        this.sharingLink = false;
        const url = this.tracking.shareUrl(res.token);
        const text = `Track my TrustRides ride live (${this.info?.ride.from} → ${this.info?.ride.to}):`;
        try {
          if ((navigator as any).share) {
            await (navigator as any).share({ title: 'Live ride tracking', text, url });
          } else {
            await navigator.clipboard.writeText(`${text} ${url}`);
            this.snackBar.success('Tracking link copied — share it with your family');
          }
        } catch {
          // user ne share sheet band kar di — kuch nahi
        }
        this.cdr.markForCheck();
      },
      error: (e) => {
        this.sharingLink = false;
        this.snackBar.error(e?.error?.message || 'Could not create tracking link');
        this.cdr.markForCheck();
      },
    });
  }

  recenter(): void {
    this.follow = true;
    const p = this.primary;
    if (this.map && p) this.map.setView([p.lat, p.lng], Math.max(this.map.getZoom(), 15));
  }

  formatAge(s: number): string {
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    return m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`;
  }

  speedKmh(): number | null {
    const sp = this.primary?.speed;
    return sp === null || sp === undefined || sp < 0 ? null : Math.round(sp * 3.6);
  }

  // ── map ──
  private async renderMap(): Promise<void> {
    if (!this.mapEl || this.mapStarted) return;
    this.mapStarted = true;
    loadLeafletCss();
    const mod: any = await import('leaflet');
    const L: typeof Leaflet = mod.default ?? mod;
    this.L = L;

    this.map = L.map(this.mapEl.nativeElement, { zoomControl: false });
    L.control.zoom({ position: 'bottomleft' }).addTo(this.map);
    L.tileLayer(TILES, { maxZoom: 19, attribution: TILES_ATTRIBUTION }).addTo(this.map);
    // user ne khud map hilaya to car ke peeche-peeche mat bhaago
    this.map.on('dragstart', () => {
      this.follow = false;
      this.cdr.markForCheck();
    });
    // zoom badalne par paas-paas wale markers ki doori (px) badalti hai — dobara side-by-side karo
    this.map.on('zoomend', () => this.drawMarkers());
    // India ka beech — route/location aate hi fit ho jaayega
    this.map.setView([28.6, 77.2], 6);

    this.drawMarkers();
    this.drawPlannedRoute();
  }

  /** Ride ka planned rasta halka sa — car kis taraf ja rahi hai samajh aaye */
  private drawPlannedRoute(): void {
    this.routeMaps.getRideRoute(this.rideId).subscribe({
      next: (res) => {
        const L = this.L;
        if (!L || !this.map || !res?.success) return;
        const best = res.routes?.[0];
        const pts: [number, number][] = best ? decodePolyline(best.polyline) : [];
        if (pts.length) {
          const line = L.polyline(pts, { color: '#0a58ff', weight: 5, opacity: 0.35, interactive: false }).addTo(this.map);
          if (!this.centeredOnce) this.map.fitBounds(line.getBounds(), { padding: [30, 30] });
        }
        for (const [p, cls] of [[res.from, 'lt-end--from'], [res.to, 'lt-end--to']] as const) {
          if (!p) continue;
          L.marker([p.lat, p.lng], {
            interactive: false,
            icon: L.divIcon({ className: 'lt-end-icon', iconSize: [14, 14], html: `<span class="lt-end ${cls}"></span>` }),
          }).addTo(this.map);
        }
      },
      error: () => {},
    });
  }

  /**
   * Har live sharer ka marker — driver = gaadi (➤), passenger = naam wala dot, sabka
   * apna rang. Offline (app band / phone lock) wale ka marker map se hat jaata hai.
   * Do log ek hi jagah (ek gaadi me) — marker side-by-side, ek ke neeche dusra na chhupe.
   */
  private drawMarkers(): void {
    const L = this.L;
    const map = this.map;
    if (!L || !map) return;

    // driver pehle — usi ki jagah asli rahe, baaki side me khiskein
    const live = [...this.locations.values()]
      .filter((l) => !this.isStale(l))
      .sort((a, b) => (a.role === b.role ? a.user_id.localeCompare(b.user_id) : a.role === 'driver' ? -1 : 1));
    const liveIds = new Set(live.map((l) => l.user_id));

    for (const [id, m] of this.markers) {
      if (!liveIds.has(id)) {
        m.remove();
        this.markers.delete(id);
      }
    }

    this.lastSignature = this.markerSignature();
    const primary = this.primary;
    const placed: { x: number; y: number }[] = [];
    for (const l of live) {
      const pt = map.latLngToContainerPoint([l.lat, l.lng]);
      let shift = 0;
      let step = 0;
      while (placed.some((p) => Math.abs(p.x - (pt.x + shift)) < OVERLAP_PX && Math.abs(p.y - pt.y) < OVERLAP_PX)) {
        shift += OVERLAP_PX + 6;
        step++;
      }
      placed.push({ x: pt.x + shift, y: pt.y });

      const icon = L.divIcon({
        className: 'lt-car-icon',
        iconSize: [36, 36],
        // anchor ulta khiskane se marker daayein dikhta hai (asli point wahi rehta hai)
        iconAnchor: [18 - shift, 18],
        // khiske hue marker ka naam upar — warna paas wale ke naam par chadh jaata
        html: this.markerHtml(l, l.user_id === primary?.user_id, step % 2 === 1),
      });
      const existing = this.markers.get(l.user_id);
      if (existing) {
        existing.setLatLng([l.lat, l.lng]).setIcon(icon);
      } else {
        this.markers.set(
          l.user_id,
          L.marker([l.lat, l.lng], { icon, zIndexOffset: l.role === 'driver' ? 1000 : 500 }).addTo(map)
        );
      }
    }

    // accuracy circle sirf gaadi (primary) ke liye, usi ke rang me
    const livePrimary = primary && liveIds.has(primary.user_id) ? primary : null;
    if (livePrimary?.accuracy && livePrimary.accuracy < 2000) {
      const color = this.colorOf(livePrimary);
      if (!this.accuracyCircle) {
        this.accuracyCircle = L.circle([livePrimary.lat, livePrimary.lng], {
          radius: livePrimary.accuracy, color, weight: 1, fillOpacity: 0.08, interactive: false,
        }).addTo(map);
      } else {
        this.accuracyCircle
          .setLatLng([livePrimary.lat, livePrimary.lng])
          .setRadius(livePrimary.accuracy)
          .setStyle({ color });
      }
    } else {
      this.accuracyCircle?.remove();
      this.accuracyCircle = undefined;
    }

    if (!livePrimary) return;
    if (!this.centeredOnce) {
      this.centeredOnce = true;
      map.setView([livePrimary.lat, livePrimary.lng], 15);
    } else if (this.follow) {
      map.panTo([livePrimary.lat, livePrimary.lng]);
    }
  }

  private markerSignature(): string {
    const stale = [...this.locations.values()].filter((l) => this.isStale(l)).map((l) => l.user_id).sort();
    return `${this.primary?.user_id ?? ''}|${stale.join(',')}`;
  }

  private markerHtml(l: SharerLocation, isPrimary: boolean, labelTop = false): string {
    const color = this.colorOf(l);
    // 8-digit hex = rang + 25% opacity (pulse ke liye)
    const pulse = isPrimary ? `<span class="lt-car-pulse" style="background:${color}40"></span>` : '';
    const above = labelTop ? 'top:auto;bottom:36px;' : '' // naam marker ke upar
    const label = `<span class="lt-label" style="${above}border-bottom:2px solid ${color}">${escapeHtml(
      l.role === 'driver' ? `🚗 ${l.name}` : l.name
    )}</span>`;
    if (l.role === 'driver') {
      // ➤ east dikhata hai, heading 0 = north
      const rotate = l.heading !== null && l.heading >= 0 ? `transform: rotate(${l.heading - 90}deg);` : '';
      return `<div class="lt-car">${pulse}<span class="lt-car-dot" style="${rotate}background:${color}">➤</span>${label}</div>`;
    }
    return `<div class="lt-car lt-pax">${pulse}<span class="lt-pax-dot" style="background:${color}"></span>${label}</div>`;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
