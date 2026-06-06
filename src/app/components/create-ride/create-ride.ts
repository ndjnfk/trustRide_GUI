import { HttpClient, HttpHeaders } from '@angular/common/http';
import { ChangeDetectionStrategy, ChangeDetectorRef, Component } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { HostListener } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Ride } from '../../services/ride';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { Router } from '@angular/router';
import { Snackbar } from '../../services/snackbar';
import { AuthHelper } from '../../helpers/auth-helper';

@Component({
  selector: 'app-create-ride',
  imports: [MatSnackBarModule, ReactiveFormsModule, CommonModule, FormsModule],
  templateUrl: './create-ride.html',
  styleUrl: './create-ride.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateRide {
  constructor(private rideService: Ride, private snackBar: Snackbar, private router: Router, private cdr: ChangeDetectorRef) { }

    ngOnInit(): void {
      this.rideService.checkPendingReviews()
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

  // ─── Ek hi array — sabhi location names ───────────────────────────
  // "From" input mein: Gurgaon ya Saharanpur wale names filter honge
  // "To"   input mein: destination wale names filter honge
  // ─────────────────────────────────────────────────────────────────

  readonly gurgaonAreas: string[] = [
    'Gurgaon',
    'Gurgaon Ambience Mall',
    'Gurgaon Cyber Park',
    'Gurgaon Rajiv Chowk',
    'Gurgaon Iffco Chowk',
    'Gurgaon Huda City Center Secor 29',
    'Gurgaon Sector 32 ,Jharsa Institutional Area',
    'Gurgaon Sector 48,Candor Tech Space',
    'Gurgaon Sector 21, Krishna Chowk',
    'Gurgaon Hero Honda Chowk',
    'Gurgaon Subhash Chowk'

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
    'Saharanpur Sharda Nagar',
    'Saharanpur Hakikat Nagar'
    
  ];
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
  // From input: Gurgaon + Saharanpur dono se filter hoga
  // To input:   bhi dono se filter hoga (user kahi se bhi ja sakta hai)
  private allLocations: string[] = [
    ...this.gurgaonAreas,
    ...this.saharanpurAreas,
  ];

  get minDate(): string {
    return new Date().toISOString().split('T')[0];
  }

  onFromInput(): void {
    const val = this.fromLocation.toLowerCase().trim();
    if (val.length < 2) {
      this.fromSuggestions = [];
      this.showFromDropdown = false;
      return;
    }
    this.fromSuggestions = this.allLocations
      .filter(loc => loc.toLowerCase().includes(val))
      .slice(0, 6);
    this.showFromDropdown = this.fromSuggestions.length > 0;
  }

  onToInput(): void {
    const val = this.toLocation.toLowerCase().trim();
    if (val.length < 2) {
      this.toSuggestions = [];
      this.showToDropdown = false;
      return;
    }
    // "To" mein sirf un locations ko dikhao jo "From" se alag hain
    this.toSuggestions = this.allLocations
      .filter(loc =>
        loc.toLowerCase().includes(val) &&
        loc.toLowerCase() !== this.fromLocation.toLowerCase()
      )
      .slice(0, 6);
    this.showToDropdown = this.toSuggestions.length > 0;
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
  this.cdr.markForCheck();
  }

  swapLocations(): void {
    const temp = this.fromLocation;
    this.fromLocation = this.toLocation;
    this.toLocation = temp;
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
  this.pricePerSeat = route.basePrice;
  this.cdr.markForCheck();
}

  // incrementPrice(): void {
  //   this.pricePerSeat += 50;
  // }

//   decrementPrice(): void {
//     if (this.pricePerSeat > 100) this.pricePerSeat -= 50;
//   }
//   incrementPrice(): void {
//   if (this.pricePerSeat < 600) this.pricePerSeat += 10;
// }

  get totalEarnings(): number {
    return this.pricePerSeat * this.seats;
  }

  // Selected route ki distance — koi route select na ho to default 308
  get selectedRoutes(): any {
    return this.routeOptions.find(r => r.id === this.selectedRouteId);
    // return route?.distance ?? 220;
  }

  getBaseCity(location: string): string {

    const value = location.trim().toLowerCase();

    if (value.includes('gurgaon')) {
      return 'gurgaon';
    }

    if (value.includes('saharanpur')) {
      return 'saharanpur';
    }

    return value;
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
  get isFormValid(): boolean {
    return !!(
      this.fromLocation &&
      this.toLocation &&
      this.rideDate &&
      this.rideTime &&
      this.selectedRouteId && 
      !this.isSameRoute
    );
  }
  publishRide(): void {
    if (!this.isFormValid) return;
console.log( this.rideTime)
    const localDateTimeString = `${this.rideDate}T${this.rideTime}:00`;
    // const departureDateUTC = new Date(localDateTimeString).toISOString();
     const departureIso = `${this.rideDate}T${this.rideTime}:00.000Z`
    const selectedRoute = this.routeOptions.find(r => r.id === this.selectedRouteId);

    const payload = {
      start_location: { name: this.fromLocation },
      end_location: { name: this.toLocation },
      departure_time: departureIso,
      available_seats: this.seats,
      price_per_seat: this.pricePerSeat,
      route_via: selectedRoute?.via ?? '',
       additional_notes: this.notes
    };

    this.rideService.createRide(payload).subscribe({
      next: (_res) => {
        this.snackBar.success('Ride Created Successfully!')
        this.formSubmitted = true;
        this.cdr.markForCheck();
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


  resetForm(): void {
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