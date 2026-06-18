import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ShopkeeperService } from '../../services/shopkeeper-service';

@Component({
  selector: 'app-shop-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class ShopDashboard {
  shop: any = null;

  constructor(private shopkeeper: ShopkeeperService, private router: Router) {}

  ngOnInit() {
    if (!this.shopkeeper.isLoggedIn()) {
      this.router.navigate(['/shop/login']);
      return;
    }
    const raw = typeof window !== 'undefined' ? localStorage.getItem('shop_user') : null;
    this.shop = raw ? JSON.parse(raw) : null;
  }

  typeLabel(t: string): string {
    return (
      { product: 'Product Based', service: 'Service Based', prescription: 'Prescription Based', opd: 'OPD / Hospitals' } as any
    )[t] || t;
  }

  logout() {
    this.shopkeeper.logout();
    this.router.navigate(['/shop/login']);
  }
}
