import { Component } from '@angular/core';
import { HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { User } from '../../services/user';
import { Ride } from '../../services/ride';
import { map, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';
import { AuthHelper } from '../../helpers/auth-helper';
import { PwaInstallService } from '../../services/pwa-install';

@Component({
  selector: 'app-header',
  imports: [CommonModule, RouterModule],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  isScrolled = false;
  isMobileMenuOpen = false;
  isUserDropdownOpen = false;
  activePollsCount = 3;
  constructor(
    public authService: AuthService,
    public userService: User,
    private rideService: Ride,
    public pwa: PwaInstallService,
  ) {}

  /** Show the install button only to logged-in users who can still install. */
  canInstallApp(): boolean {
    return this.isLoggedIn() && this.pwa.isInstallable();
  }

  async installApp(): Promise<void> {
    const result = await this.pwa.install();
    if (result === 'ios') {
      alert(
        'Install TrustRides:\n\n1. Tap the Share button (□↑) in Safari\n2. Choose "Add to Home Screen"\n3. Tap "Add"',
      );
    }
    this.closeMobileMenu();
  }
  userData: any;
  hasActiveRides:any;
  ngOnInit(): void {

    if(AuthHelper.getToken()){
      this.userService.getCurrentUser().subscribe({

      next: (res) => {
        this.userData = res;
        console.log(res);
      },

      error: (err) => {
        console.log(err);
      }

    });
    }


this.hasActiveRides = this.rideService.getUserRides().pipe(
  map((res: any) => {
    const rides = res.data || [];

    return rides.some((r: any) => {
      const status = (r.status || '').trim().toLowerCase();

      return status === 'active';
    });
  })
);
  }

getInitials(name: string): string {

  if (!name) return '';

  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase();

}
  navItems = [
    { label: 'My Rides', route: '/get-ride', icon: 'car' },
    { label: 'Explore Rides', route: '/available-rides', icon: 'compass' },
    { label: 'My Bookings', route: '/get-bookings', icon: 'ticket' },
    { label: 'Profile', route: '/about-you', icon: 'user' },
    { label: 'Company Members', route: '/company-members', icon: 'users' },
    { label: 'Rating', route: '/rating-show', icon: 'star' },
  ];
 
  @HostListener('window:scroll')
  onScroll(): void {
    this.isScrolled = window.scrollY > 20;
  }
 
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!(e.target as HTMLElement).closest('.user-menu')) {
      this.isUserDropdownOpen = false;
    }
  }
 
  toggleMobileMenu(): void   { this.isMobileMenuOpen = !this.isMobileMenuOpen; }
  closeMobileMenu(): void    { this.isMobileMenuOpen = false; }
  toggleDropdown(e: MouseEvent): void {
    e.stopPropagation();
    // On mobile, the avatar opens the side drawer instead of the dropdown.
    if (window.innerWidth <= 768) {
      this.toggleMobileMenu();
      return;
    }
    this.isUserDropdownOpen = !this.isUserDropdownOpen;
  }
  isLoggedIn(): boolean {
    return AuthHelper.isLoggedIn()
  }

}
