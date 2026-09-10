import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

interface HomeTile {
  icon: string;
  label: string;
  desc: string;
  route: string;
}

/**
 * Marketplace ka landing page.
 *
 * Filhaal sirf Products chalu hai — Services / Pharmacy / OPD shopkeeper
 * panel par tike the aur wo band hai. Poora marketplace ab admin manage
 * karta hai. Neeche `disabledTiles` me wo tiles rakhe hain jo wapas chalu
 * karni hon to bas `tiles` me daal dena.
 */
@Component({
  selector: 'app-marketplace-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './marketplace-home.html',
  styleUrl: './marketplace-home.css',
})
export class MarketplaceHome {
  readonly tiles: HomeTile[] = [
    {
      route: '/marketplace/products',
      icon: '📦',
      label: 'Products',
      desc: 'Browse everything available right now',
    },
  ];

  // Shopkeeper panel band hone par ye teen tiles hat gayi thi. Wapas chalu
  // karne ke liye inhe `tiles` me move karo aur backend ka /shop group
  // uncomment karo.
  // { route: '/marketplace/shops/service',      icon: '🛠️', label: 'Services',        desc: '...' }
  // { route: '/marketplace/shops/prescription', icon: '💊', label: 'Pharmacy',        desc: '...' }
  // { route: '/marketplace/shops/opd',          icon: '🏥', label: 'OPD / Hospitals', desc: '...' }

  constructor(private router: Router) {}

  open(tile: HomeTile): void {
    this.router.navigate([tile.route]);
  }
}
