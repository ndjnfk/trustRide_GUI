
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { environment } from '../../../../environment';
import { AuthHelper } from '../../helpers/auth-helper';
import { Router } from '@angular/router';
import { Ride } from '../../services/ride';


@Component({
  selector: 'app-users-matched-preferences',
  imports: [CommonModule],
  templateUrl: './users-matched-preferences.html',
  styleUrl: './users-matched-preferences.css',
})
export class UsersMatchedPreferences implements OnInit {

  members: any[] = [];
  companyName: string = '';
  totalNumbers: number = 0;
  imageBaseUrl = environment.apiUrl;

  // ✅ Naye fields
  riders: any[] = [];
  passengers: any[] = [];
  userRole: string = '';
  loading = false;

  // ── Day-based filter ──
  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  selectedDay = 'Monday';   // ✅ default Monday ('' = all days)

  // ── Route-based filter (client-side, day filter ke upar lagta hai) ──
  selectedRoute = '';   // '' = all routes
  routeOptions = [
    { id: 'gurgaon-saharanpur', label: 'Gurgaon → Saharanpur', from: 'gurgaon', to: 'saharanpur' },
    { id: 'saharanpur-gurgaon', label: 'Saharanpur → Gurgaon', from: 'saharanpur', to: 'gurgaon' },
  ];

  // All-days data — sirf button counts ke liye cache karte hain
  private allRiders: any[] = [];
  private allPassengers: any[] = [];

  constructor(
    private http: HttpClient,
    private router: Router,
    private matchingService: Ride
  ) {}

  ngOnInit() {
    this.getCompanyMembers();
    this.loadCounts();                          // all days — sirf button counts ke liye
    this.getMatchingTravellers(this.selectedDay); // ✅ default Monday ka data dikhao
  }

  // All-days data fetch — display ko touch nahi karta, sirf counts cache karta hai
  private loadCounts() {
    this.matchingService.getMatchingTravellers('').subscribe({
      next: (res: any) => {
        this.userRole = res.role;
        this.allRiders = this.normalizeTrips(res.riders);
        this.allPassengers = this.normalizeTrips(res.passengers);
      },
      error: (err) => console.log(err)
    });
  }

  getCompanyMembers() {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${AuthHelper.getToken()}`
    });
    this.http.get(`${environment.apiUrl}/users/companyMembers`, { headers }).subscribe({
      next: (res: any) => {
        this.members = res.members;
        this.companyName = res.company_name;
        this.totalNumbers = res.total;
      },
      error: (err) => console.log(err)
    });
  }

  // ✅ Matching travellers — day blank = all days, warna sirf us din ke
  getMatchingTravellers(day: string = '') {
    this.loading = true;
    this.matchingService.getMatchingTravellers(day).subscribe({
      next: (res: any) => {
        this.userRole = res.role;                 // "passenger" / "rider" / "both"
        this.riders = this.normalizeTrips(res.riders);
        this.passengers = this.normalizeTrips(res.passengers);

        // All-days response ko counts ke liye cache karo
        if (!day) {
          this.allRiders = this.riders;
          this.allPassengers = this.passengers;
        }
        this.recomputeFiltered();
        this.loading = false;
      },
      error: (err) => {
        console.log(err);
        this.riders = [];
        this.passengers = [];
        this.recomputeFiltered();
        this.loading = false;
      }
    });
  }

  // Backend `dayTrips` deta hai — template `matchedTrips` use karta hai, normalize kar do
  private normalizeTrips(list: any[] = []): any[] {
    return (list || []).map((u) => ({
      ...u,
      matchedTrips: u.dayTrips || u.matchedTrips || []
    }));
  }

  // ── Day button click → us din ka data API se fetch karo ──
  // Dobara same day click = toggle off = all days
  selectDay(day: string): void {
    this.selectedDay = this.selectedDay === day ? '' : day;
    this.getMatchingTravellers(this.selectedDay);
  }

  // ✅ Memoized filtered lists — sirf tab recompute jab data ya filter badle.
  // (Getter me har CD cycle pe naya array banane se *ngFor DOM rebuild karta
  //  tha → cards blink karte the. Stable reference se woh fix ho jata hai.)
  filteredRiders: any[] = [];
  filteredPassengers: any[] = [];

  // ── Day dropdown change → us din ka data API se fetch karo ──
  onDayChange(day: string): void {
    this.selectedDay = day;
    this.getMatchingTravellers(day);
  }

  // ── Route dropdown change → client-side filter (koi API call nahi) ──
  selectRoute(routeId: string): void {
    this.selectedRoute = routeId;
    this.recomputeFiltered();
  }

  // riders/passengers ya selectedRoute badalne par filtered lists dobara banao
  private recomputeFiltered(): void {
    this.filteredRiders = this.applyRouteFilter(this.riders);
    this.filteredPassengers = this.applyRouteFilter(this.passengers);
  }

  // *ngFor ke liye stable identity — DOM node reuse, no re-animation/blink
  trackByUserId = (_: number, u: any): any => u?._id ?? u;

  // Har user ke matchedTrips ko selected route par filter karo;
  // jiske paas us route ka koi trip nahi, use list se hata do.
  private applyRouteFilter(list: any[] = []): any[] {
    if (!this.selectedRoute) return list;
    return (list || [])
      .map((u) => ({
        ...u,
        matchedTrips: (u.matchedTrips || []).filter((t: any) => this.tripMatchesRoute(t)),
      }))
      .filter((u) => u.matchedTrips.length > 0);
  }

  // Trip ka route selected route se match karta hai? (direction-aware)
  private tripMatchesRoute(trip: any): boolean {
    if (!this.selectedRoute) return true;
    const opt = this.routeOptions.find((r) => r.id === this.selectedRoute);
    if (!opt) return true;
    const route = (trip?.route || '').toLowerCase();
    const fromIdx = route.indexOf(opt.from);
    const toIdx = route.indexOf(opt.to);
    return fromIdx !== -1 && toIdx !== -1 && fromIdx < toIdx;
  }

  // Har day button par count (all-days cache se, opposite role ke hisaab se)
  countForDay(day: string): number {
    const onDay = (u: any) =>
      (u.matchedTrips || []).some(
        (t: any) => (t.day || '').toLowerCase() === day.toLowerCase()
      );

    let count = 0;
    if (this.userRole === 'passenger' || this.userRole === 'both') {
      count += this.allRiders.filter(onDay).length;
    }
    if (this.userRole === 'rider' || this.userRole === 'both') {
      count += this.allPassengers.filter(onDay).length;
    }
    return count;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  goToProfile(userId: string) {
    this.router.navigate(['/my-profile'], { state: { user_id: userId } });
  }
}