import { Component, NgZone } from '@angular/core';
import { HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth';
import { User } from '../../services/user';
import { Ride } from '../../services/ride';
import { filter, map, switchMap } from 'rxjs/operators';
import { Subscription, of } from 'rxjs';
import { AuthHelper } from '../../helpers/auth-helper';
import { PwaInstallService } from '../../services/pwa-install';
import { ChatService } from '../../services/chat-service';
import { WalletResponse, WalletService } from '../../services/wallet-service';

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
  isWalletOpen = false;
  /** Wallet (platform fee baaki) — null = abhi load nahi hua / login nahi */
  wallet: WalletResponse | null = null;
  private navSub?: Subscription;
  activePollsCount = 3;
  unreadChats = 0;
  private onChatUpdate = () => this.zone.run(() => { this.unreadChats++; });

  constructor(
    public authService: AuthService,
    public userService: User,
    private rideService: Ride,
    public pwa: PwaInstallService,
    private chat: ChatService,
    private zone: NgZone,
    private walletService: WalletService,
    private router: Router,
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

    // Wallet: har page change par taaza (ride complete karke lautne par nayi fee dikhe)
    this.refreshWallet();
    this.navSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.refreshWallet());

    // Chat: live unread badge
    if (AuthHelper.getToken()) {
      this.chat.connect();
      this.chat.onThreadUpdate(this.onChatUpdate);
      this.refreshUnread();
    }

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

  refreshUnread(): void {
    this.chat.getUnreadCount().subscribe({
      next: (res: any) => { this.unreadChats = res?.count ?? 0; },
      error: () => { /* badge just stays as-is */ },
    });
  }

  refreshWallet(): void {
    if (!AuthHelper.getToken()) {
      this.wallet = null;
      return;
    }
    this.walletService.getWallet().subscribe({
      next: (res) => { this.wallet = res?.success ? res : null; },
      error: () => { /* wallet chip purana hi rahe */ },
    });
  }

  toggleWallet(e: MouseEvent): void {
    e.stopPropagation();
    this.isWalletOpen = !this.isWalletOpen;
    this.isUserDropdownOpen = false;
  }

  ngOnDestroy(): void {
    this.chat.offThreadUpdate(this.onChatUpdate);
    this.navSub?.unsubscribe();
  }
  navItems = [
    // BlaBla entries filhaal band — site se BlaBla option hata diya gaya hai.
    // { label: 'Publish BlaBla Ride', route: '/create-blabla-ride', icon: 'car' },
    // { label: 'BlaBla Rides', route: '/blabla-rides', icon: 'compass' },
    { label: 'My Rides', route: '/get-ride', icon: 'car' },
    { label: 'Explore Rides', route: '/available-rides', icon: 'compass' },
    { label: 'My Bookings', route: '/get-bookings', icon: 'ticket' },
    // Medical Emergency / Marketplace / Track Orders filhaal website se band —
    // admin panel me pages chaalu hain. Wapas chalu karne ke liye uncomment karo.
    // { label: 'Medical Emergency', route: '/medical-emergency', icon: 'medical' },
    // { label: 'Marketplace', route: '/marketplace', icon: 'shop' },
    // { label: 'Track Orders', route: '/marketplace/orders', icon: 'package' },
    { label: 'Profile', route: '/about-you', icon: 'user' },
    { label: 'Company Members', route: '/company-members', icon: 'users' },
    { label: 'Rating', route: '/rating-show', icon: 'star' },
    // Update Rides / User Preferences Matched filhaal band — laptop dropdown
    // (header.html) se bhi hata diye hain. Wapas dikhane ke liye ye lines aur
    // header.html ke wo blocks uncomment karo.
    // { label: 'Update Rides', route: '/auto-generated', icon: 'compass' },
    // { label: 'User Preferences Matched ', route: '/user-matched', icon: 'compass' },
   
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
    if (!(e.target as HTMLElement).closest('.wallet-menu')) {
      this.isWalletOpen = false;
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
