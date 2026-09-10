import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { Component } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { Ride } from '../../services/ride';
import { AuthHelper } from '../../helpers/auth-helper';
import { HomeBanner } from '../home-banner/home-banner';

@Component({
  selector: 'app-dashboard',
  imports: [CommonModule, RouterModule, HttpClientModule, HomeBanner],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {

  constructor(
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

  // Home par ab search form nahi hai — dono ride sources yahin se khulte hain.
  goToTrustRideRides(): void {
    this.router.navigate(['/trustride-rides']);
  }

  goToBlablaRides(): void {
    this.router.navigate(['/blabla-rides']);
  }

  // Popular-route tile click → create-ride par jaao with route preselected
  // (from, to, via aur price create-ride mein routeId se set ho jayenge)
  goToRoute(routeId: string): void {
    this.router.navigate(['create-ride'], { queryParams: { route: routeId } });
  }

  // Jin routes ka koi preset (via/price) nahi hai — sirf from/to prefill karo
  goToRoutePair(from: string, to: string): void {
    this.router.navigate(['create-ride'], { queryParams: { from, to } });
  }

  checkPendingReviews() {
    const token = AuthHelper.getToken();
    if (!token) return;

    this.rideService.getPendingReviews().subscribe({
      next: (res) => {
        const pending = res.pending_reviews ?? [];

        if (pending.length === 0) {
          return; // dashboard khulne do
        }

        const first = pending[0];

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
