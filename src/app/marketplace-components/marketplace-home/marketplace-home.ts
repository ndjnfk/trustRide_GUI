import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthHelper } from '../../helpers/auth-helper';

interface HomeTile {
  icon: string;
  label: string;
  desc: string;
  /** Shop-type tiles ka type; Medical Emergency jaisi tile me `route` hota hai. */
  type?: string;
  route?: string;
  urgent?: boolean;
  /** Login ke baad hi dikhti hai — page khud bhi login maangta hai. */
  authOnly?: boolean;
}

@Component({
  selector: 'app-marketplace-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './marketplace-home.html',
  styleUrl: './marketplace-home.css',
})
export class MarketplaceHome {
  private readonly tiles: HomeTile[] = [
    { type: 'product', icon: '📦', label: 'Products', desc: 'Kirana, grocery, electronics & more' },
    { type: 'service', icon: '🛠️', label: 'Services', desc: 'Salon, fitness, repairs & home services' },
    { type: 'prescription', icon: '💊', label: 'Pharmacy', desc: 'Medicines & prescription orders' },
    { type: 'opd', icon: '🏥', label: 'OPD / Hospitals', desc: 'Clinics, doctors & appointments' },
    {
      route: '/medical-emergency',
      icon: '🚑',
      label: 'Medical Emergency',
      desc: 'Pharmacy numbers you can WhatsApp right away',
      urgent: true,
      authOnly: true,
    },
  ];

  constructor(private router: Router) {}

  /** Logout state me authOnly tiles chhupi rehti hain. */
  get shopTypes(): HomeTile[] {
    const loggedIn = AuthHelper.isLoggedIn();
    return this.tiles.filter((t) => !t.authOnly || loggedIn);
  }

  open(tile: HomeTile): void {
    if (tile.route) {
      this.router.navigate([tile.route]);
      return;
    }
    this.router.navigate(['/marketplace/shops', tile.type]);
  }
}
