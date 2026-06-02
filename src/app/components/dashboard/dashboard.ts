import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Component, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Route, Router, RouterModule } from '@angular/router';
import { RidePopup } from '../ride-popup/ride-popup';
import { Ride } from '../../services/ride';
import { LoaderServices } from '../../services/loader-services';
import { AuthHelper } from '../../helpers/auth-helper';
@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule, CommonModule,
    FormsModule,
    HttpClientModule,],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {

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
  selectedDate: 'today' | 'tomorrow' = 'today';

  /* ── Dropdown state ── */
  fromFiltered: string[] = [];
  toFiltered: string[] = [];
  showFromDropdown = false;
  showToDropdown = false;

  passengers = 1;
  selectedDateValue = '';        // will hold 'YYYY-MM-DD' string
  dateOptions: { label: string; value: string }[] = [];

  @ViewChild('fromRef') fromRef!: ElementRef;
  @ViewChild('toRef') toRef!: ElementRef;

  private loader = inject(LoaderServices);

  constructor(
    private http: HttpClient,
    private snackBar: MatSnackBar,
    
    private router: Router,
    private rideService: Ride
  ) { }


  ngOnInit(): void {

    this.loadStyle(
      'google-fonts-preconnect',
      'https://fonts.googleapis.com',
      'preconnect'
    )

    this.loadStyle(
      'google-fonts-gstatic',
      'https://fonts.gstatic.com',
      'preconnect',
      true
    )

    this.loadStyle(
      'jakarta-font',
      'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Sora:wght@400;600;700;800&display=swap',
      'stylesheet'
    )

    this.loadStyle(
      'tabler-icons',
      'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css',
      'stylesheet'
    )

    this.buildDateOptions();
    this.checkPendingReviews();
  }
  loadStyle(
    id: string,
    href: string,
    rel: string,
    crossOrigin: boolean = false
  ): void {

    if (typeof document === 'undefined') return;

    if (document.getElementById(id)) {
      return
    }

    const link = document.createElement('link')

    link.id = id
    link.rel = rel
    link.href = href

    if (crossOrigin) {
      link.crossOrigin = 'anonymous'
    }

    document.head.appendChild(link)
  }
  goToCreateRide(): void {
    this.router.navigate(['create-ride']);
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


  // Auto-fill from
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

  /* ── Swap ── */
  swap(): void {
    [this.fromValue, this.toValue] = [this.toValue, this.fromValue];
  }

  /* ── Close dropdowns on outside click ── */
  @HostListener('document:click', ['$event'])
  onDocClick(e: MouseEvent): void {
    if (
      this.fromRef &&
      !this.fromRef.nativeElement.contains(e.target)
    ) {
      this.showFromDropdown = false;
    }
    if (
      this.toRef &&
      !this.toRef.nativeElement.contains(e.target)
    ) {
      this.showToDropdown = false;
    }
  }
  /**
    * Extract the base city from a selected area string.
    * "Gurgaon Sector 14" → "gurgaon"
    * "Saharanpur Bus Stand" → "saharanpur"
    * Works by checking which known city name the area starts with.
    */
  private getBaseCity(areaValue: string): string {
    const v = areaValue.toLowerCase().trim();
    if (v.startsWith('gurgaon')) return 'gurgaon';
    if (v.startsWith('saharanpur')) return 'saharanpur';
    // fallback: use first word
    return v.split(' ')[0];
  }



private getTargetDate(): string {
  console.log('selectedDateValue:', this.selectedDateValue); // verify
  return this.selectedDateValue; // bas itna hi chahiye
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

      const fromCity   = this.getBaseCity(this.fromValue);
      const toCity     = this.getBaseCity(this.toValue);
      const targetDate = this.getTargetDate();

      // ── TEMP DEBUG — console mein dekho ──
res.rides.forEach((r: any) => {
  const rideDate = new Date(r.departure_time).toLocaleDateString('en-CA');
  console.log({
    rideFrom: r.from.toLowerCase(),
    rideTo: r.to.toLowerCase(),
    fromCity,
    toCity,
    rideDate,
    targetDate,
    availableSeats: r.available_seats,
    passengers: this.passengers,
    cityMatch: r.from.toLowerCase().includes(fromCity) && r.to.toLowerCase().includes(toCity),
    dateMatch: rideDate === targetDate,
    seatsMatch: r.available_seats >= this.passengers,
  });
});

      const filtered = res.rides.filter((r: any) => {
        const rideFrom = r.from.toLowerCase();
        const rideTo   = r.to.toLowerCase();
        const cityMatch = rideFrom.includes(fromCity) && rideTo.includes(toCity);

        const rideDate  = new Date(r.departure_time).toLocaleDateString('en-CA');
        const dateMatch = rideDate === targetDate;

        // available_seats >= requested passengers
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

      this.router.navigate(['/search-rides'], {
        state: { rides: filtered, from: this.fromValue, to: this.toValue },
      });
    },
    error: (err: any) => {
      this.loader.hide();
      console.error(err);
      this.snackBar.open(
        'Something went wrong. Please try again.',
        'Close',
        { duration: 4000, panelClass: ['snack-error'] }
      );
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

    // ── Explicitly local date parts — UTC shift se safe ──
    const yyyy = d.getFullYear();
    const mm   = String(d.getMonth() + 1).padStart(2, '0');
    const dd   = String(d.getDate()).padStart(2, '0');
    const value = `${yyyy}-${mm}-${dd}`;

    let label: string;
    if (i === 0)      label = `Today, ${dd} ${d.toLocaleString('en-IN', { month: 'short' })}`;
    else if (i === 1) label = `Tomorrow, ${dd} ${d.toLocaleString('en-IN', { month: 'short' })}`;
    else              label = `${d.toLocaleString('en-IN', { weekday: 'short' })}, ${dd} ${d.toLocaleString('en-IN', { month: 'short' })}`;

    opts.push({ label, value });
  }

  this.dateOptions = opts;
  this.selectedDateValue = opts[0].value;

  // ── Console se verify karo ──
  console.log('Date options:', this.dateOptions);
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
  console.log('selectedDateValue updated:', this.selectedDateValue); // verify karo
}
// checkPendingReviews() {
//   // getCurrentUser ki zaroorat nahi — sirf token check karo
//   const token = AuthHelper.getToken();
//   console.log('token:', token);
  
//   if (!token) return; // login nahi hai toh skip

//   this.rideService.getPendingReviews().subscribe({
//     next: (res) => {
//       console.log('pending reviews:', res);
//        console.log('first ride_id:', res.pending_reviews[0]?.ride_id); // yeh kya print hota hai?
//       if (res.pending_reviews?.length > 0) {
//         const first = res.pending_reviews[0];
//         console.log('navigating to review:', first.ride_id);
//         this.router.navigate(['/review', first.ride_id]);
//       }
//     },
//     error: (err) => console.error('Pending reviews failed:', err)
//   });
// }


checkPendingReviews() {
  const token = AuthHelper.getToken();
  if (!token) return;

  this.rideService.getPendingReviews().subscribe({
    next: (res) => {
      console.log('pending reviews:', res);
      const pending = res.pending_reviews ?? [];

      if (pending.length === 0) {
        console.log('no pending reviews — dashboard allow');
        return; // dashboard khulne do
      }

      const first = pending[0];
      console.log('pending found — role:', first.role, '| ride_id:', first.ride_id);

      // Dono cases ke liye same route — review page handle karega
      this.router.navigate(['/review', first.ride_id]);
    },
    error: (err) => {
      console.error('Pending reviews failed:', err);
      // Error pe dashboard block mat karo
    }
  });
}
}
