import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-marketplace-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './marketplace-home.html',
  styleUrl: './marketplace-home.css',
})
export class MarketplaceHome {
  readonly shopTypes = [
    { type: 'product', icon: '📦', label: 'Products', desc: 'Kirana, grocery, electronics & more' },
    { type: 'service', icon: '🛠️', label: 'Services', desc: 'Salon, fitness, repairs & home services' },
    { type: 'prescription', icon: '💊', label: 'Pharmacy', desc: 'Medicines & prescription orders' },
    { type: 'opd', icon: '🏥', label: 'OPD / Hospitals', desc: 'Clinics, doctors & appointments' },
  ];

  constructor(private router: Router) {}

  open(type: string): void {
    this.router.navigate(['/marketplace/shops', type]);
  }
}
