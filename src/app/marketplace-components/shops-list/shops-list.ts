import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';

@Component({
  selector: 'app-shops-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shops-list.html',
  styleUrl: './shops-list.css',
})
export class ShopsList {
  imageBase = '';

  loading = true;
  error = '';
  type = '';
  shops: any[] = [];

  readonly typeLabels: any = {
    product: 'Products', service: 'Services', prescription: 'Pharmacy', opd: 'OPD / Hospitals',
  };

  constructor(
    private marketplace: MarketplaceService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.imageBase = this.marketplace.imageBase;
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((p) => {
      this.type = p.get('type') ?? '';
      this.load();
    });
  }

  get typeLabel(): string {
    return this.typeLabels[this.type] ?? 'Shops';
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.marketplace.getShopsByType(this.type).subscribe({
      next: (res: any) => {
        this.shops = res?.data ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load shops.';
      },
    });
  }

  openShop(s: any): void {
    this.router.navigate(['/marketplace/shop', s._id]);
  }

  initials(name: string): string {
    return (name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  goBack(): void {
    this.router.navigate(['/marketplace']);
  }
}
