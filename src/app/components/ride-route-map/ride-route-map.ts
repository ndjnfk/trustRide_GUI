import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  PLATFORM_ID,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import {
  MapPoint,
  RouteMapService,
  RideRouteResponse,
  RouteOption,
  TOLL_RETRIES,
  TOLL_RETRY_MS,
  decodePolyline,
  hasMissingTolls,
  mergeTolls,
  formatDuration,
} from '../../services/route-map-service';

// Leaflet ki CSS bundle me nahi — sirf map wale page par CDN se (budget nahi badhta)
const LEAFLET_CSS = 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';

const COLORS = { route: '#0a58ff', casing: '#ffffff', alt: '#94a3b8', me: '#7c3aed' };

// OpenStreetMap ke standard tiles — bina key ke chalte hain
// (CARTO ab API key maangta hai, isliye wapas OSM)
const TILES = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILES_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
// Upar zyada jagah — pins ke naam wale label pin ke upar bante hain
const FIT_OPTIONS: Leaflet.FitBoundsOptions = { paddingTopLeft: [50, 80], paddingBottomRight: [50, 50] };

/**
 * Ride detail page ka map — pickup se drop tak ka rasta, distance, time,
 * alternative raaste, aur "meri location se pickup kitni door".
 *
 * Map OpenStreetMap + Leaflet hai; rasta backend (OSRM, Redis cache) se aata hai.
 * Leaflet browser-only hai, isliye SSR par kuch render nahi hota.
 *
 * Picker mode (publish page ka "What is your route?"): rideId nahi, raaste
 * `options` se aate hain, list parent dikhata hai — yahan sirf map, aur map par
 * raasta chunne se `selectedChange` nikalta hai.
 */
@Component({
  selector: 'app-ride-route-map',
  imports: [CommonModule],
  templateUrl: './ride-route-map.html',
  styleUrl: './ride-route-map.css',
})
export class RideRouteMap implements AfterViewInit, OnChanges, OnDestroy {
  @Input() rideId = '';
  /** Picker mode ka data — null = abhi load ho raha hai */
  @Input() options: RideRouteResponse | null = null;
  @Input() picker = false;
  @Input() selected = 0;
  @Output() selectedChange = new EventEmitter<number>();

  @ViewChild('mapEl') mapEl?: ElementRef<HTMLDivElement>;

  loading = true;
  error = '';
  from: MapPoint | null = null;
  to: MapPoint | null = null;
  routes: RouteOption[] = [];
  /** Pehla rasta rider ka chuna hua hai (sabse tez ho zaroori nahi) */
  riderChose = false;

  // "Meri location" — pickup tak ka rasta
  locating = false;
  locateError = '';
  fromHere: RouteOption | null = null;
  /** Browser ki batayi galti (meter) — 0 = pata nahi / map par khud chuna */
  accuracyM = 0;
  /** true = user ne map par tap karke location chuni */
  pickedOnMap = false;
  mapPickEnabled = false;

  readonly formatDuration = formatDuration;

  private L?: typeof Leaflet;
  private map?: Leaflet.Map;
  private routeLayers: Leaflet.Polyline[] = [];
  private meLayer?: Leaflet.LayerGroup;
  private pins: Leaflet.Marker[] = [];
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private viewReady = false;

  constructor(private routeMaps: RouteMapService, private cdr: ChangeDetectorRef) {}

  get approximate(): boolean {
    return !!(this.from?.approximate || this.to?.approximate);
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    if (!this.isBrowser) return;
    if (this.picker) {
      this.applyOptions();
      return;
    }
    if (!this.rideId) return;

    this.routeMaps.getRideRoute(this.rideId).subscribe({
      next: async (res) => {
        this.from = res.from;
        this.to = res.to;
        this.routes = res.routes || [];
        this.riderChose = !!res.chosen;
        if (res.success && hasMissingTolls(this.routes)) this.retryTolls(1);
        if (!res.success) this.error = res.message || 'Route is not available right now.';
        this.loading = false;
        this.cdr.detectChanges();

        // Points mile hon to map dikhao — rasta na mile tab bhi pickup/drop dikhte hain
        if (this.from && this.to) await this.renderMap();
      },
      error: () => {
        this.loading = false;
        this.error = 'Could not load the map.';
        this.cdr.detectChanges();
      },
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady || !this.isBrowser || !this.picker) return;
    if (changes['options']) this.applyOptions();
    else if (changes['selected']) this.drawRoutes();
  }

  /** Picker mode: naye from/to ke raaste map par — map ek hi baar banta hai. */
  private async applyOptions(): Promise<void> {
    const res = this.options;
    this.loading = !res;
    this.from = res?.from ?? null;
    this.to = res?.to ?? null;
    this.routes = res?.routes ?? [];
    this.error = res && !res.success ? res.message || 'Routes are not available right now.' : '';
    this.cdr.detectChanges();
    if (!this.from || !this.to) return;

    if (!this.map) {
      await this.renderMap();
      return;
    }
    this.pins.forEach((m) => m.remove());
    this.pins = [];
    this.pin(this.from, 'pickup');
    this.pin(this.to, 'drop');
    this.drawRoutes();
    if (!this.routes.length) this.recenter();
  }

  /** Toll ki ginti peeche ban rahi ho to thodi der baad dobara (sirf ride detail mode). */
  private retryTolls(attempt: number): void {
    if (attempt > TOLL_RETRIES) return;
    this.tollTimer = setTimeout(() => {
      this.routeMaps.getRideRoute(this.rideId).subscribe({
        next: (res) => {
          if (mergeTolls(this.routes, res.routes ?? [])) this.retryTolls(attempt + 1);
          this.cdr.detectChanges();
        },
        error: () => this.retryTolls(attempt + 1),
      });
    }, TOLL_RETRY_MS);
  }

  private tollTimer?: ReturnType<typeof setTimeout>;

  ngOnDestroy(): void {
    clearTimeout(this.tollTimer);
    this.map?.remove();
  }

  selectRoute(index: number): void {
    this.selected = index;
    this.selectedChange.emit(index);
    this.drawRoutes();
    this.cdr.detectChanges();
  }

  /** Browser / Capacitor webview ki location → pickup tak ka rasta. */
  useMyLocation(): void {
    if (!this.isBrowser) return;
    if (!('geolocation' in navigator)) {
      this.locateError = 'Location is not supported on this device.';
      return;
    }

    this.locating = true;
    this.locateError = '';
    this.cdr.detectChanges();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Laptop/desktop par GPS nahi hota — browser IP/Wi-Fi se andaza lagata hai,
        // jo 100+ km galat ho sakta hai. Accuracy dikhate hain taaki user samjhe.
        this.accuracyM = Math.round(pos.coords.accuracy || 0);
        this.pickedOnMap = false;
        this.routeFromHere(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        this.locating = false;
        this.locateError =
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Allow location access, or tap the map to set your location.'
            : 'Could not get your location. Tap the map to set it instead.';
        this.enableMapPick();
        this.cdr.detectChanges();
      },
      // Taazi aur jitni ho sake utni sahi location — purani cached nahi
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  /** Browser ki location 2 km se zyada ghalat ho sakti hai — user ko batao. */
  get locationIsRough(): boolean {
    return !this.pickedOnMap && this.accuracyM > 2000;
  }

  get accuracyText(): string {
    return this.accuracyM >= 1000 ? `${Math.round(this.accuracyM / 1000)} km` : `${this.accuracyM} m`;
  }

  private routeFromHere(lat: number, lng: number): void {
    this.locating = true;
    this.locateError = '';
    this.cdr.detectChanges();

    this.routeMaps.getRouteFromHere(this.rideId, lat, lng).subscribe({
      next: (res) => {
        this.locating = false;
        this.fromHere = res.route ?? null;
        if (!res.success) this.locateError = res.message || 'Could not find a route to the pickup.';
        this.drawMe(lat, lng, res.route);
        this.enableMapPick();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.locating = false;
        this.locateError = err?.error?.message || 'Could not find a route to the pickup.';
        this.cdr.detectChanges();
      },
    });
  }

  /**
   * Location galat aayi to user map par tap karke sahi jagah chun sake.
   * Sirf ek baar listener lagta hai.
   */
  private enableMapPick(): void {
    if (!this.map || this.mapPickEnabled) return;
    this.mapPickEnabled = true;
    this.map.on('click', (e: Leaflet.LeafletMouseEvent) => {
      this.accuracyM = 0;
      this.pickedOnMap = true;
      this.routeFromHere(e.latlng.lat, e.latlng.lng);
    });
  }

  // ── Leaflet ──────────────────────────────────────────────────────

  private async renderMap(): Promise<void> {
    if (!this.mapEl || !this.from || !this.to) return;

    loadLeafletCss();
    const mod: any = await import('leaflet');
    const L: typeof Leaflet = mod.default ?? mod;
    this.L = L;

    this.map = L.map(this.mapEl.nativeElement, {
      scrollWheelZoom: false, // page scroll karte waqt map zoom na ho
      zoomControl: false,
    });
    L.control.zoom({ position: 'bottomleft' }).addTo(this.map);

    L.tileLayer(TILES, {
      maxZoom: 19,
      attribution: TILES_ATTRIBUTION,
    }).addTo(this.map);

    // Map hile/zoom ho to label kinaare se bahar na jaaye
    this.map.on('moveend zoomend resize', () => this.placeLabels());

    this.pin(this.from, 'pickup');
    this.pin(this.to, 'drop');

    this.drawRoutes();
    if (!this.routes.length) this.recenter();
  }

  /** Poora rasta (aur meri location, agar hai) frame me wapas le aao. */
  recenter(): void {
    const L = this.L;
    if (!L || !this.map || !this.from || !this.to) return;
    const bounds = L.latLngBounds([
      [this.from.lat, this.from.lng],
      [this.to.lat, this.to.lng],
    ]);
    const current = this.routeLayers[this.routeLayers.length - 1];
    if (current) bounds.extend(current.getBounds());
    this.meLayer?.eachLayer((layer: any) => {
      if (layer.getBounds) bounds.extend(layer.getBounds());
      else if (layer.getLatLng) bounds.extend(layer.getLatLng());
    });
    this.map.fitBounds(bounds, FIT_OPTIONS);
  }

  /** Naam wala pin — pickup hara (pulse), drop blue teardrop. */
  private pin(point: MapPoint, kind: 'pickup' | 'drop'): void {
    if (!this.L || !this.map) return;
    const label = kind === 'pickup' ? 'Pickup' : 'Drop';
    const icon = this.L.divIcon({
      className: 'rm-pin-icon',
      iconSize: [0, 0],
      html: `<div class="rm-pin rm-pin--${kind}">
          <span class="rm-pin-label"><b>${label}</b>${escapeHtml(point.name)}${point.approximate ? ' ~' : ''}</span>
          <span class="rm-pin-mark"></span>
        </div>`,
    });
    const marker = this.L.marker([point.lat, point.lng], {
      icon,
      zIndexOffset: kind === 'drop' ? 1000 : 900,
      keyboard: false,
    }).addTo(this.map);
    this.pins.push(marker);
  }

  /**
   * Drop ka label pin ke upar, pickup ka neeche. Pin map ke kinaare ke paas ho to
   * label andar ki taraf khiska do (left/right), aur jagah na ho to doosri taraf.
   */
  private placeLabels(): void {
    const map = this.map;
    if (!map) return;
    const size = map.getSize();
    const GAP = 8;

    for (const marker of this.pins) {
      const label = marker.getElement()?.querySelector<HTMLElement>('.rm-pin-label');
      if (!label) continue;
      const p = map.latLngToContainerPoint(marker.getLatLng());
      const half = label.offsetWidth / 2;
      const isDrop = !!label.closest('.rm-pin--drop');
      const above = (isDrop ? 44 : 22) + label.offsetHeight;
      const below = 16 + label.offsetHeight;

      label.classList.toggle('rm-pin-label--start', p.x - half < GAP);
      label.classList.toggle('rm-pin-label--end', p.x - half >= GAP && p.x + half > size.x - GAP);
      // Drop upar (jagah na ho to neeche), pickup neeche (jagah na ho to upar)
      label.classList.toggle('rm-pin-label--below', isDrop && p.y - above < GAP);
      label.classList.toggle('rm-pin-label--above', !isDrop && p.y + below > size.y - GAP && p.y - above >= GAP);
    }
  }

  /** Alternatives grey me neeche, chuna hua rasta blue me upar. */
  private drawRoutes(): void {
    const L = this.L;
    const map = this.map;
    if (!L || !map) return;

    this.routeLayers.forEach((layer) => layer.remove());
    this.routeLayers = [];

    const order = this.routes.map((_, i) => i).filter((i) => i !== this.selected);
    if (this.routes[this.selected]) order.push(this.selected);

    for (const i of order) {
      const isSelected = i === this.selected;
      const points = decodePolyline(this.routes[i].polyline);

      // White "casing" neeche — rasta map ke upar ubhra hua dikhe (Google Maps jaisa)
      const casing = L.polyline(points, {
        color: COLORS.casing,
        weight: isSelected ? 11 : 8,
        opacity: 1,
        interactive: false,
        className: isSelected ? 'rm-casing' : '',
      }).addTo(map);
      this.routeLayers.push(casing);

      const line = L.polyline(points, {
        color: isSelected ? COLORS.route : COLORS.alt,
        weight: isSelected ? 6 : 5,
        opacity: isSelected ? 1 : 0.85,
        className: isSelected ? '' : 'rm-alt',
      }).addTo(map);
      this.routeLayers.push(line);

      if (isSelected) {
        // Chune hue raste par chalti hui roshni — pickup se drop ki disha
        const flow = L.polyline(points, {
          color: '#ffffff',
          weight: 2.5,
          opacity: 0.9,
          dashArray: '2 16',
          lineCap: 'round',
          interactive: false,
          className: 'rm-flow',
        }).addTo(map);
        this.routeLayers.push(flow);
      } else {
        line.on('click', (e: Leaflet.LeafletMouseEvent) => {
          // Raasta chunna hai, location nahi — click map tak na pahunche
          L.DomEvent.stopPropagation(e);
          this.selectRoute(i);
        });
      }
    }

    const current = this.routeLayers[this.routeLayers.length - 1];
    if (current) map.fitBounds(current.getBounds(), FIT_OPTIONS);
  }

  private drawMe(lat: number, lng: number, route?: RouteOption): void {
    const L = this.L;
    const map = this.map;
    if (!L || !map) return;

    this.meLayer?.remove();
    this.meLayer = L.layerGroup().addTo(map);

    // Browser jitni galti bata raha hai utna gola — asli location isi ke andar kahin hai
    if (this.accuracyM > 50) {
      L.circle([lat, lng], {
        radius: Math.min(this.accuracyM, 200000),
        color: COLORS.me,
        weight: 1,
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(this.meLayer);
    }

    const meIcon = L.divIcon({ className: 'rm-pin-icon', iconSize: [0, 0], html: '<span class="rm-me-dot"></span>' });
    L.marker([lat, lng], { icon: meIcon, zIndexOffset: 1100, keyboard: false })
      .bindTooltip(this.pickedOnMap ? 'Your chosen location' : 'You are here (as reported by your device)')
      .addTo(this.meLayer);

    if (route?.polyline) {
      const line = L.polyline(decodePolyline(route.polyline), {
        color: COLORS.me,
        weight: 4,
        dashArray: '1 9',
        lineCap: 'round',
        interactive: false,
      }).addTo(this.meLayer);
      map.fitBounds(line.getBounds().extend([lat, lng]), FIT_OPTIONS);
    } else {
      map.panTo([lat, lng]);
    }
  }
}

/** Live tracking page bhi yahi CSS loader use karta hai */
export function loadLeafletCss(): void {
  if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = LEAFLET_CSS;
  document.head.appendChild(link);
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
