import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { HostListener } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Ride } from '../../services/ride';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { ActivatedRoute, Router } from '@angular/router';
import { Snackbar } from '../../services/snackbar';
import { AuthHelper } from '../../helpers/auth-helper';
import { baseCityOf, isCityPairBlocked } from '../../helpers/route-rules';
import { DEFAULT_LOCATION_CITIES, flattenAreas } from '../../helpers/locations';
import { LocationService } from '../../services/location-service';
import {
  PriceQuote, RideRouteResponse, RouteMapService, RouteOption, TOLL_RETRIES, TOLL_RETRY_MS,
  formatDuration, hasMissingTolls, mergeTolls,
} from '../../services/route-map-service';
import { RideRouteMap } from '../ride-route-map/ride-route-map';

@Component({
  selector: 'app-create-ride',
  imports: [MatSnackBarModule, ReactiveFormsModule, CommonModule, FormsModule, RideRouteMap],
  templateUrl: './create-ride.html',
  styleUrl: './create-ride.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateRide {
  constructor(private rideService: Ride, private snackBar: Snackbar, private router: Router, private cdr: ChangeDetectorRef, private route: ActivatedRoute, private locationService?: LocationService, private routeMaps?: RouteMapService) { }

    ngOnInit(): void {
      this.rideService.checkPendingReviews()

      // Admin panel wali live list — hidden areas isme nahi aate
      this.locationService?.getCities().subscribe(cities => {
        this.allLocations = flattenAreas(cities)
        this.cdr.markForCheck()
      })

      // Dashboard popular-route tile se aaya routeId — from/to/via/price preselect karo
      const routeId = this.route.snapshot.queryParamMap.get('route')
      if (routeId) this.applyRoutePreset(routeId)

      // Assistant deep-link: prefill from/to/date/time (e.g. /create-ride?from=..&to=..&date=..&time=..)
      const qp = this.route.snapshot.queryParamMap
      const from = qp.get('from'); const to = qp.get('to')
      const date = qp.get('date'); const time = qp.get('time')
      if (from) this.fromLocation = from
      if (to) this.toLocation = to
      if (date) this.rideDate = date           // expected format: YYYY-MM-DD
      if (time) this.rideTime = time           // expected format: HH:MM
      if (from || to) this.syncPriceToRange()  // prefilled cities ki price range lagao
      if (from || to || date || time) this.cdr.markForCheck()
    }

    // routeId ke hisaab se form prefill: from, to, selected route (via) aur price
    private applyRoutePreset(routeId: string): void {
      const opt = this.routeOptions.find(r => r.id === routeId)
      if (!opt) return
      this.fromLocation = this.cityDisplayName(opt.from)
      this.toLocation = this.cityDisplayName(opt.to)
      this.selectedRouteId = opt.id
      this.pricePerSeat = opt.basePrice
      this.cdr.markForCheck()
    }

    private cityDisplayName(base: string): string {
      // City ka naam hi list ka pehla area hai ("Gurgaon", "New Delhi")
      const exact = this.allLocations.find(loc => loc.toLowerCase() === base)
      return exact ?? base.charAt(0).toUpperCase() + base.slice(1)
    }
  // Form fields
  fromLocation = '';
  toLocation = '';
  rideDate = '';
  rideTime = '';
  seats = 1;
  pricePerSeat = 450;
  vehicleType = '';
  notes = '';

  fromSuggestions: string[] = [];
  toSuggestions: string[] = [];
  showFromDropdown = false;
  showToDropdown = false;
  formSubmitted = false;
  selectedRouteId = '';
  createdRideId = '';
  readonly origin = typeof window !== 'undefined' ? window.location.origin : '';

  // ─── Sabhi location names — admin panel se manage hote hain ──────
  // API (GET /locations) se aate hain; tab tak / fail hone par default list.
  // "From" aur "To" dono inhi me se filter hote hain — free text allowed nahi.
  // ─────────────────────────────────────────────────────────────────
  private allLocations: string[] = flattenAreas(DEFAULT_LOCATION_CITIES);

  // Jin cities ke liye koi predefined route (via/basePrice) nahi hai, unke
  // rides publish karte waqt route select karna optional rehta hai. Ab ye list
  // apne aap banti hai: admin panel se judi har nayi city (jiska routeOptions
  // me koi preset nahi) isme aati hai — Gurgaon/Saharanpur par presets hain.

  // Blocked city pairs helpers/route-rules.ts mein hain — register aur
  // edit-profile bhi wahi list use karte hain.

  // Price limit: Gurgaon ↔ Saharanpur. Doosra band (₹350–₹390) un routes ke
  // liye hai jinka koi preset route nahi — yaani admin ki jodi hui nayi cities.
  private readonly PRICE_RANGE_DEFAULT = { min: 420, max: 550 };
  private readonly PRICE_RANGE_OPTIONAL_ROUTE = { min: 350, max: 390 };

readonly routeOptions = [
  {
    id: 'r1',
    from: 'gurgaon', to: 'saharanpur',
    via: 'UER2 · Sonipat · Baghpat · Shamli',
    basePrice: 440,
    distance: 220,
    label: 'Via Baghpat'
  },
  {
    id: 'r2',
    from: 'gurgaon', to: 'saharanpur',
    via: 'UER2 · Sonipat · Panipat · Shamli',
    basePrice: 460,
    distance: 220,
    label: 'Via Panipat'
  },
  {
    id: 'r3',
    from: 'gurgaon', to: 'saharanpur',
    via: 'UER2 · Kundali · Delhi-Dehradun Expressway',
    basePrice: 500,
    distance: 220,
    label: 'Via Kundali Expressway'
  },
  {
    id: 'r4',
    from: 'gurgaon', to: 'saharanpur',
    via: 'Dhaula Kuan · Delhi-Dehradun Expressway · UER2',
    basePrice: 480,
    distance: 210,
    label: 'Via Dhaula Kuan'
  },
  // Reverse routes
  {
    id: 'r1r',
    from: 'saharanpur', to: 'gurgaon',
    via: 'Shamli · Baghpat · Sonipat · UER2',
    basePrice: 440,
    distance: 220,
    label: 'Via Baghpat'
  },
  {
    id: 'r2r',
    from: 'saharanpur', to: 'gurgaon',
    via: 'Shamli · Panipat · Sonipat · UER2',
    basePrice: 460,
    distance: 220,
    label: 'Via Panipat'
  },
  {
    id: 'r3r',
    from: 'saharanpur', to: 'gurgaon',
    via: 'Delhi-Dehradun Expressway · Kundali · UER2',
    basePrice: 500,
    distance: 220,
    label: 'Via Kundali Expressway'
  },
  {
    id: 'r4r',
    from: 'saharanpur', to: 'gurgaon',
    via: 'UER2 · Delhi-Dehradun Expressway · Dhaula Kuan',
    basePrice: 480,
    distance: 210,
    label: 'Via Dhaula Kuan'
  },
];

  get minDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  // Dropdown card ke right me khulta hai aur scroll hota hai — isliye ab
  // 6 ki limit nahi. Kuch type na kiya ho (focus par) to poori list dikhti hai.
  onFromInput(): void {
    // User dropdown se select kiye bina bhi type kar sakta hai —
    // route + price yahan bhi sync karo, warna stale value publish ho jaati hai
    this.syncRouteSelection();
    this.syncPriceToRange();

    const val = this.fromLocation.toLowerCase().trim();
    // Jo cities selected "To" ke saath blocked hain, wo suggest hi mat karo
    const toCity = this.toLocation ? this.getBaseCity(this.toLocation) : '';
    this.fromSuggestions = this.allLocations.filter(loc =>
      loc.toLowerCase().includes(val) &&
      !this.isPairBlocked(this.getBaseCity(loc), toCity)
    );
    this.showFromDropdown = this.fromSuggestions.length > 0;
    this.showToDropdown = false;
  }

  onToInput(): void {
    this.syncRouteSelection();
    this.syncPriceToRange();

    const val = this.toLocation.toLowerCase().trim();
    // "To" mein sirf un locations ko dikhao jo "From" se alag hain
    // aur jinki city "From" ki city ke saath blocked nahi hai
    const fromCity = this.fromLocation ? this.getBaseCity(this.fromLocation) : '';
    this.toSuggestions = this.allLocations.filter(loc =>
      loc.toLowerCase().includes(val) &&
      loc.toLowerCase() !== this.fromLocation.toLowerCase() &&
      !this.isPairBlocked(this.getBaseCity(loc), fromCity)
    );
    this.showToDropdown = this.toSuggestions.length > 0;
    this.showFromDropdown = false;
  }

  /** Dropdown row ki doosri line — "Saharanpur" ke liye "Master city", baaki ke liye city. */
  suggestionSubtitle(name: string): string {
    const city = this.cityTag(name);
    return city.toLowerCase() === name.trim().toLowerCase() ? 'Master city · all areas' : `${city} area`;
  }

  selectFrom(name: string): void {
    this.fromLocation = name;
    this.fromSuggestions = [];
    this.showFromDropdown = false;

    
  // Auto-fill to
  const base = this.getBaseCity(name);
  if (base === 'gurgaon' && !this.toLocation) {
    this.toLocation = 'Saharanpur';
  } else if (base === 'saharanpur' && !this.toLocation) {
    this.toLocation = 'Gurgaon';
  }
    // Route ab is jodi ke liye valid na ho to purana selection hata do
    this.syncRouteSelection();
    this.syncPriceToRange();
    this.cdr.markForCheck();
  }

  selectTo(name: string): void {
    this.toLocation = name;
    this.toSuggestions = [];
    this.showToDropdown = false;

    // Auto-fill from
  const base = this.getBaseCity(name);
  if (base === 'gurgaon' && !this.fromLocation) {
    this.fromLocation = 'Saharanpur';
  } else if (base === 'saharanpur' && !this.fromLocation) {
    this.fromLocation = 'Gurgaon';
  }
  this.syncRouteSelection();
  this.syncPriceToRange();
  this.cdr.markForCheck();
  }

  swapLocations(): void {
    const temp = this.fromLocation;
    this.fromLocation = this.toLocation;
    this.toLocation = temp;
    // Direction badal gayi — purana route ab ulti direction ka hai
    this.syncRouteSelection();
    this.syncPriceToRange();
  }

  // ─── Wizard: Route → Via → When → Seats → Price ─────────────────
  // Har step ek hi card me aata hai. "Via" me map se asli raaste (OSRM) aate
  // hain; wo na milein to preset routes. Admin ki nayi city par preset nahi
  // hota — wahan live raaste na milein to Via step hat jaata hai.
  step = 0;

  private readonly ALL_STEPS = [
    { key: 'route', label: 'Route' },
    { key: 'via', label: 'Via' },
    { key: 'when', label: 'When' },
    { key: 'seats', label: 'Seats' },
    { key: 'price', label: 'Price' },
  ] as const;

  get steps() {
    return this.ALL_STEPS.filter(s =>
      s.key !== 'via' || !this.isRouteOptional || this.routeOptionsLoading || this.liveRoutes.length > 0
    );
  }

  get currentStep(): string {
    // From/To badalne se step count badal sakta hai — index ko range me rakho
    const steps = this.steps;
    return steps[Math.min(this.step, steps.length - 1)].key;
  }

  get isLastStep(): boolean {
    return this.step >= this.steps.length - 1;
  }

  /** Current step ka data poora hai? Continue button isi par chalta hai. */
  get canContinue(): boolean {
    switch (this.currentStep) {
      case 'route':
        return !!(
          this.isKnownLocation(this.fromLocation) &&
          this.isKnownLocation(this.toLocation) &&
          !this.isSameRoute &&
          !this.isBlockedRoute
        );
      case 'via':
        // Live raaste aa rahe hon to ruko; aa gaye to unme se ek chuna hi hota hai
        if (this.selectedLiveRoute) return true;
        return !this.routeOptionsLoading && (!!this.selectedRouteId || this.isRouteOptional);
      case 'when':
        return !!(this.rideDate && this.rideTime && this.rideDate >= this.minDate);
      case 'seats':
        return this.seats >= 1 && this.seats <= 4;
      default:
        return this.isFormValid && !this.quoteLoading;
    }
  }

  nextStep(): void {
    if (!this.canContinue) return;
    if (this.isLastStep) {
      this.publishRide();
      return;
    }
    if (this.currentStep === 'route') {
      this.requestQuote();
      this.requestRouteOptions();
    }
    this.step++;
    // Via step par pehla route pehle se chuna ho — sabse sasta/common wala
    if (this.currentStep === 'via' && !this.selectedRouteId && this.filteredRoutes.length) {
      this.selectRoute(this.filteredRoutes[0]);
    }
    this.syncPriceToRange();
    this.cdr.markForCheck();
  }

  prevStep(): void {
    if (this.step > 0) this.step--;
    this.cdr.markForCheck();
  }

  /** Stepper par pichhle step par click karke wapas ja sakte hain, aage nahi. */
  goToStep(index: number): void {
    if (index < this.step) this.step = index;
    this.cdr.markForCheck();
  }

  /** Popular routes card — preset routes se: distance aur sabse kam price. */
  get popularRoutes() {
    const pairs = new Map<string, { from: string; to: string; distance: number; price: number }>();
    for (const r of this.routeOptions) {
      const key = `${r.from}>${r.to}`;
      const cur = pairs.get(key);
      if (!cur) pairs.set(key, { from: r.from, to: r.to, distance: r.distance, price: r.basePrice });
      else {
        cur.distance = Math.min(cur.distance, r.distance);
        cur.price = Math.min(cur.price, r.basePrice);
      }
    }
    return [...pairs.values()].map(p => ({
      ...p,
      fromName: this.cityDisplayName(p.from),
      toName: this.cityDisplayName(p.to),
    }));
  }

  pickPopularRoute(p: { fromName: string; toName: string }): void {
    this.fromLocation = p.fromName;
    this.toLocation = p.toName;
    this.showFromDropdown = this.showToDropdown = false;
    this.step = 0;
    this.syncRouteSelection();
    this.syncPriceToRange();
    this.cdr.markForCheck();
  }

  incrementSeats(): void {
    if (this.seats < 4) this.seats++;
  }

  decrementSeats(): void {
    if (this.seats > 1) this.seats--;
  }
  get filteredRoutes() {
  const from = this.getBaseCity(this.fromLocation);
  const to = this.getBaseCity(this.toLocation);
  if (!from || !to || from === to) return [];
  return this.routeOptions.filter(r => r.from === from && r.to === to);
}

selectRoute(route: typeof this.routeOptions[0]): void {
  this.selectedRouteId = route.id;
  // Quote mila hai to price distance se bana hai — via sirf raasta batata hai
  if (!this.activeQuote) this.pricePerSeat = route.basePrice;
  this.cdr.markForCheck();
}

  // incrementPrice(): void {
  //   this.pricePerSeat += 50;
  // }

  /** Preset route waali jodi par ₹420–₹550; bina preset waali (abhi koi nahi) par ₹350–₹390. */
  get minPrice(): number {
    const q = this.activeQuote;
    if (q) return q.min;
    return this.isRouteOptional
      ? this.PRICE_RANGE_OPTIONAL_ROUTE.min
      : this.PRICE_RANGE_DEFAULT.min;
  }

  get maxPrice(): number {
    const q = this.activeQuote;
    if (q) return q.max;
    return this.isRouteOptional
      ? this.PRICE_RANGE_OPTIONAL_ROUTE.max
      : this.PRICE_RANGE_DEFAULT.max;
  }

  // ─── Price quote (admin ka formula: distance ÷ mileage × fuel ÷ seats + toll ÷ 4 + fee) ───
  // Route step se aage badhte hi backend se aata hai (distance Redis/OSRM se).
  // Raasta chunne / uske toll aane par dobara — toll ka hissa price me judta hai.
  // Na aaye (routing down) to upar wali purani fixed range fallback hai.
  quote: PriceQuote | null = null;
  private quoteFor = '';
  quoteLoading = false;
  quoteError = '';

  private get routeKey(): string {
    return `${this.fromLocation.trim().toLowerCase()}|${this.toLocation.trim().toLowerCase()}`;
  }

  /** Chune raaste ke toll plaza — pata na ho to 0 (price me toll nahi judta) */
  get selectedTolls(): number {
    return this.selectedLiveRoute?.tolls ?? 0;
  }

  private get quoteKey(): string {
    return `${this.routeKey}|${this.selectedLiveRoute ? this.selectedLive : -1}|${this.selectedTolls}`;
  }

  /** Quote sirf abhi ke from/to, chune raaste (km) aur uske toll ka ho tabhi maano — badla to purana bekaar. */
  get activeQuote(): PriceQuote | null {
    return this.quote && this.quoteFor === this.quoteKey ? this.quote : null;
  }

  requestQuote(): void {
    if (!this.routeMaps) return;
    const key = this.quoteKey;
    const pick = { route: this.selectedLiveRoute ? this.selectedLive : undefined, tolls: this.selectedTolls };
    if (this.quoteFor === key && (this.quote || this.quoteLoading)) return;

    this.quoteFor = key;
    this.quote = null;
    this.quoteError = '';
    this.quoteLoading = true;
    this.cdr.markForCheck();

    this.routeMaps.getPriceQuote(this.fromLocation.trim(), this.toLocation.trim(), pick).subscribe({
      next: (res) => {
        if (this.quoteFor !== key) return; // beech me route badal gaya
        this.quoteLoading = false;
        if (res.success && res.quote) {
          this.quote = res.quote;
          this.pricePerSeat = res.quote.suggested;
        } else {
          this.quoteError = res.message || 'Could not calculate the price for this route.';
        }
        this.syncPriceToRange();
        this.cdr.markForCheck();
      },
      error: () => {
        if (this.quoteFor !== key) return;
        this.quoteLoading = false;
        this.quoteError = 'Could not calculate the price for this route.';
        this.syncPriceToRange();
        this.cdr.markForCheck();
      },
    });
  }

  // ─── Live raaste — "What is your route?" (OSRM, backend Redis cache) ───
  // Sabse tez pehle aata hai aur wahi pehle se chuna hota hai. Price chune
  // raaste ki km + uske toll se banta hai (raasta badla to quote dobara).
  routeOptionsRes: RideRouteResponse | null = null;
  private routeOptionsFor = '';
  routeOptionsLoading = false;
  selectedLive = -1;
  readonly formatDuration = formatDuration;

  /** Sirf abhi ke from/to ke raaste — route badla to purane bekaar. */
  get liveOptions(): RideRouteResponse | null {
    return this.routeOptionsFor === this.routeKey ? this.routeOptionsRes : null;
  }

  get liveRoutes(): RouteOption[] {
    return this.liveOptions?.routes ?? [];
  }

  get selectedLiveRoute(): RouteOption | null {
    return this.liveRoutes[this.selectedLive] ?? null;
  }

  /** "Fastest" badge — OSRM aam taur par pehla hi deta hai, phir bhi min dekh lo. */
  get fastestLiveIndex(): number {
    const r = this.liveRoutes;
    return r.reduce((best, cur, i) => (cur.duration_min < r[best].duration_min ? i : best), 0);
  }

  requestRouteOptions(): void {
    if (!this.routeMaps) return;
    const key = this.routeKey;
    if (this.routeOptionsFor === key && (this.routeOptionsRes?.success || this.routeOptionsLoading)) return;

    this.routeOptionsFor = key;
    this.routeOptionsRes = null;
    this.selectedLive = -1;
    this.routeOptionsLoading = true;
    this.cdr.markForCheck();

    const done = (res: RideRouteResponse | null) => {
      if (this.routeOptionsFor !== key) return; // beech me route badal gaya
      this.routeOptionsLoading = false;
      this.routeOptionsRes = res;
      this.selectedLive = res?.routes?.length ? 0 : -1;
      if (res?.success && hasMissingTolls(res.routes)) this.retryTolls(key, 1);
      this.requestQuote(); // pehle raaste ke toll ke saath
      this.cdr.markForCheck();
    };
    this.routeMaps.getRouteOptions(this.fromLocation.trim(), this.toLocation.trim()).subscribe({
      next: (res) => done(res),
      error: () => done(null),
    });
  }

  /** 0 → "No tolls", 1 → "1 toll", 4 → "4 tolls" (plaza ki ginti) */
  tollLabel(tolls: number): string {
    return tolls ? `${tolls} toll${tolls > 1 ? 's' : ''}` : 'No tolls';
  }

  /** Toll ki ginti pehli baar na aayi ho to thodi der baad dobara poochho. */
  private retryTolls(key: string, attempt: number): void {
    if (attempt > TOLL_RETRIES || !this.routeMaps) return;
    clearTimeout(this.tollTimer);
    this.tollTimer = setTimeout(() => {
      if (this.routeOptionsFor !== key) return; // route badal gaya
      this.routeMaps!.getRouteOptions(this.fromLocation.trim(), this.toLocation.trim()).subscribe({
        next: (res) => {
          const current = this.liveOptions?.routes;
          if (this.routeOptionsFor !== key || !current) return;
          if (mergeTolls(current, res?.routes ?? [])) this.retryTolls(key, attempt + 1);
          this.requestQuote(); // toll aa gaye — price me jodo
          this.cdr.markForCheck();
        },
        error: () => this.retryTolls(key, attempt + 1),
      });
    }, TOLL_RETRY_MS);
  }

  private tollTimer?: ReturnType<typeof setTimeout>;

  ngOnDestroy(): void {
    clearTimeout(this.tollTimer);
  }

  selectLiveRoute(index: number): void {
    this.selectedLive = index;
    this.requestQuote(); // naye raaste ki km + toll se price
    this.cdr.markForCheck();
  }

  /** Earnings card — route step ke baad, jab price ban chuka ho (quote ya fallback range). */
  get earningsReady(): boolean {
    return this.step > 0 && !this.quoteLoading && !this.routeOptionsLoading;
  }

  /** TrustRide fee (per seat) — sirf dikhti hai; price me na judti, na kamai se katti. */
  get platformFee(): number {
    return this.activeQuote?.breakdown.platform_fee ?? 0;
  }

  get riderReceives(): number {
    return this.pricePerSeat * this.seats;
  }

  /** From/To badalne par agar pehle chuna route ab is jodi ka nahi hai to
   *  selection hata do — warna publish par galat route_via chala jaata hai. */
  private syncRouteSelection(): void {
    if (
      this.selectedRouteId &&
      !this.filteredRoutes.some(r => r.id === this.selectedRouteId)
    ) {
      this.selectedRouteId = '';
    }
  }

  /** City badalne par range badal jaati hai — price bahar ho to base par reset. */
  private syncPriceToRange(): void {
    if (this.pricePerSeat < this.minPrice || this.pricePerSeat > this.maxPrice) {
      this.pricePerSeat = this.activeQuote?.suggested ?? this.minPrice;
    }
  }

  decrementPrice(): void {
    if (this.pricePerSeat > this.minPrice) this.pricePerSeat -= 10;
  }
  incrementPrice(): void {
  if (this.pricePerSeat < this.maxPrice) this.pricePerSeat += 10;
}

  get totalEarnings(): number {
    return this.pricePerSeat * this.seats;
  }

  // Selected route ki distance — koi route select na ho to default 308
  get selectedRoutes(): any {
    return this.routeOptions.find(r => r.id === this.selectedRouteId);
    // return route?.distance ?? 220;
  }

  getBaseCity(location: string): string {
    return baseCityOf(location);
  }

  /** Kya do cities ke beech ride allowed hai? (route-rules ke hisaab se) */
  private isPairBlocked(fromCity: string, toCity: string): boolean {
    return isCityPairBlocked(fromCity, toCity);
  }

  /** Selected from/to jodi BLOCKED_CITY_PAIRS mein hai (abhi list khaali hai). */
  get isBlockedRoute(): boolean {
    if (!this.fromLocation || !this.toLocation) return false;
    return this.isPairBlocked(this.fromLocation, this.toLocation);
  }

  /** Bina preset route waali cities par route selection optional hai. */
  get isRouteOptional(): boolean {
    const from = this.getBaseCity(this.fromLocation);
    const to = this.getBaseCity(this.toLocation);
    if (!from || !to) return false;
    const presetCities = new Set(this.routeOptions.flatMap(r => [r.from, r.to]));
    return !presetCities.has(from) || !presetCities.has(to);
  }

  /** Dropdown chip ka city label — "Gurgaon Cyber Park" → "Gurgaon". */
  cityTag(area: string): string {
    return this.cityDisplayName(this.getBaseCity(area));
  }
  get isSameRoute(): boolean {

    if (!this.fromLocation || !this.toLocation) {
      return false;
    }

    return (
      this.getBaseCity(this.fromLocation) ===
      this.getBaseCity(this.toLocation)
    );
  }
  /** Exact (case-insensitive) match against the provided areas only.
   *  Custom / free-text locations are NOT allowed. */
  isKnownLocation(value: string): boolean {
    const v = (value || '').trim().toLowerCase();
    if (!v) return false;
    return this.allLocations.some(loc => loc.toLowerCase() === v);
  }

  /** True when the user has typed something that isn't in the allowed list. */
  get fromInvalid(): boolean {
    return !!this.fromLocation.trim() && !this.isKnownLocation(this.fromLocation);
  }

  get toInvalid(): boolean {
    return !!this.toLocation.trim() && !this.isKnownLocation(this.toLocation);
  }

  get isFormValid(): boolean {
    return !!(
      this.fromLocation &&
      this.toLocation &&
      this.isKnownLocation(this.fromLocation) &&   // sirf provided areas hi allowed
      this.isKnownLocation(this.toLocation) &&
      this.rideDate &&
      this.rideTime &&
      (this.selectedLiveRoute || this.selectedRouteId || this.isRouteOptional) &&   // bina preset route waali cities par optional
      !this.isSameRoute &&
      !this.isBlockedRoute &&
      this.pricePerSeat >= this.minPrice &&
      this.pricePerSeat <= this.maxPrice
    );
  }
  publishRide(): void {
    if (!this.isFormValid) return;
console.log( this.rideTime)
    const localDateTimeString = `${this.rideDate}T${this.rideTime}:00`;
    // const departureDateUTC = new Date(localDateTimeString).toISOString();
     const departureIso = `${this.rideDate}T${this.rideTime}:00.000Z`
    const selectedRoute = this.routeOptions.find(r => r.id === this.selectedRouteId);
    // Map se chuna rasta ho to wahi — ride detail map par bhi yahi dikhega
    const live = this.selectedLiveRoute;

    const payload = {
      start_location: { name: this.fromLocation },
      end_location: { name: this.toLocation },
      departure_time: departureIso,
      available_seats: this.seats,
      price_per_seat: this.pricePerSeat,
      route_via: live ? live.summary || `${live.distance_km} km by road` : selectedRoute?.via ?? '',
      ...(live && {
        route: {
          distance_km: live.distance_km,
          duration_min: live.duration_min,
          polyline: live.polyline,
          summary: live.summary ?? '',
          ...(live.tolls != null && { tolls: live.tolls }),
        },
      }),
       additional_notes: this.notes
    };

    this.rideService.createRide(payload).subscribe({
      next: (res) => {
        this.snackBar.success('Ride Created Successfully!')
        // Always show the success card immediately.
        this.formSubmitted = true;
        const id = this.extractRideId(res);
        if (id) {
          this.createdRideId = id;
        } else {
          // create response doesn't include the id — resolve it in the
          // background from the user's rides so the share link can render.
          this.resolveCreatedRideId(departureIso);
        }
        this.cdr.detectChanges();
        // Form is long — scroll up so the user actually sees the success card.
        if (typeof window !== 'undefined') {
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }
      },

    error: (err) => {
  const message =
    err?.error?.message ||
    'Failed to create ride. Please try again later'

  if (err?.status === 401) {
    this.snackBar.error('Please login to continue...')
    return
  }

  this.snackBar.error(message)
}
    });
  }


  // Pull the new ride id out of whatever shape the backend returns.
  private extractRideId(obj: any): string {
    return (
      obj?.ride_id ??
      obj?.rideId ??
      obj?.ride?._id ??
      obj?.ride?.ride_id ??
      obj?.data?.ride_id ??
      obj?.data?.rideId ??
      obj?.id ??
      obj?._id ??
      ''
    );
  }

  // Fallback when createRide doesn't return the id: find the just-created
  // ride among the user's rides (match on departure time + route).
  private resolveCreatedRideId(departureIso: string): void {
    this.rideService.getUserRides().subscribe({
      next: (res) => {
        const rides: any[] = Array.isArray(res) ? res : (res?.rides ?? res?.data ?? []);
        const match =
          rides.find((r) =>
            r?.departure_time === departureIso &&
            this.getBaseCity(r?.from ?? r?.start_location?.name ?? '') === this.getBaseCity(this.fromLocation) &&
            this.getBaseCity(r?.to ?? r?.end_location?.name ?? '') === this.getBaseCity(this.toLocation)
          ) ?? rides[rides.length - 1] ?? null;
        this.createdRideId = this.extractRideId(match);
        this.cdr.detectChanges();
      },
      error: () => {
        // Card is already shown; just no share link if this lookup fails.
      },
    });
  }

  copyRideLink(): void {
    if (!this.createdRideId) {
      this.snackBar.error('Ride link is not available.');
      return;
    }
    const link = `${this.origin}/ride-detail/${this.createdRideId}`;
    navigator.clipboard.writeText(link).then(
      () => this.snackBar.success('Ride link copied to clipboard!'),
      () => this.snackBar.error('Could not copy link. Please try again.')
    );
  }

  resetForm(): void {
    this.createdRideId = '';
    this.fromLocation = '';
    this.toLocation = '';
    this.rideDate = '';
    this.rideTime = '';
    this.seats = 1;
    this.pricePerSeat = 450;
    this.vehicleType = '';
    this.notes = '';
    this.formSubmitted = false;
    this.selectedRouteId = ''
    this.selectedLive = -1;
    this.routeOptionsFor = '';
    this.routeOptionsRes = null;
    this.step = 0;
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.autocomplete-wrapper')) {
      this.showFromDropdown = false;
      this.showToDropdown = false;
    }
  }


}