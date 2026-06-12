import { CommonModule, DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ProfileService } from '../../servies/profile-service';

type View = 'rides' | 'bookings';

@Component({
  selector: 'app-cancellation-details',
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './cancellation-details.html',
  styleUrl: './cancellation-details.css',
})
export class CancellationDetails implements OnInit {

  userId = '';
  role = '';
  view: View = 'rides';

  cancelledRides: any[] = [];
  cancelledBookings: any[] = [];

  isLoading = false;
  error = '';

  // role ke hisaab se kya dikhana hai
  get showRides(): boolean {
    return this.role === 'rider' || this.role === 'both' || this.role === '';
  }
  get showBookings(): boolean {
    return this.role === 'passenger' || this.role === 'both' || this.role === '';
  }
  get showTabs(): boolean {
    return this.showRides && this.showBookings;
  }

  // subtitle role ke hisaab se
  get subtitle(): string {
    if (this.role === 'rider') return 'Reasons for every ride this user cancelled';
    if (this.role === 'passenger') return 'Reasons for every booking this user cancelled';
    return 'Reasons for every ride and booking this user cancelled';
  }

  constructor(
    private route: ActivatedRoute,
    private profileService: ProfileService
  ) {}

  ngOnInit(): void {
    // userId route param se, ya navigation state se (fallback)
    this.userId = this.route.snapshot.paramMap.get('userId')
      ?? history.state?.['user_id']
      ?? '';

    this.role = this.route.snapshot.queryParamMap.get('role') ?? '';

    // default view role ke hisaab se: rider→rides, passenger→bookings
    const v = this.route.snapshot.queryParamMap.get('view');
    if (v === 'bookings' || v === 'rides') {
      this.view = v;
    } else if (this.role === 'passenger') {
      this.view = 'bookings';
    } else {
      this.view = 'rides';
    }

    // agar role ke hisaab se woh view allowed nahi hai to allowed wale par switch karo
    if (this.view === 'rides' && !this.showRides) this.view = 'bookings';
    if (this.view === 'bookings' && !this.showBookings) this.view = 'rides';

    this.loadDetails();
  }

  setView(v: View) {
    this.view = v;
  }

  loadDetails(): void {
    if (!this.userId) {
      this.error = 'No user specified.';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.profileService.getCancellationDetails(this.userId).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.cancelledRides = res.data?.cancelled_rides ?? [];
          this.cancelledBookings = res.data?.cancelled_bookings ?? [];
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load cancellation details.';
        this.isLoading = false;
      }
    });
  }
}
