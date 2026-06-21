import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';
import { AuthHelper } from '../../helpers/auth-helper';

@Component({
  selector: 'app-shop-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shop-detail.html',
  styleUrl: './shop-detail.css',
})
export class ShopDetail {
  imageBase = '';
  readonly PAGE = 10;

  loading = true;
  error = '';
  shop: any = null;
  products: any[] = [];
  services: any[] = [];
  doctors: any[] = [];
  visibleCount = this.PAGE;

  constructor(
    private marketplace: MarketplaceService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.imageBase = this.marketplace.imageBase;
  }

  ngOnInit(): void {
    const shopId = this.route.snapshot.paramMap.get('shopId');
    if (!shopId) { this.error = 'Shop not found.'; this.loading = false; return; }
    this.load(shopId);
  }

  load(shopId: string): void {
    this.loading = true;
    this.marketplace.getShop(shopId).subscribe({
      next: (res: any) => {
        this.shop = res?.shop ?? null;
        this.products = res?.products ?? [];
        this.services = res?.services ?? [];
        this.doctors = res?.doctors ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load shop.';
      },
    });
  }

  /** services for service shops, otherwise products */
  get isService(): boolean {
    return this.shop?.shop_type === 'service';
  }

  /** pharmacy shops take a prescription upload instead of a product list */
  get isPharmacy(): boolean {
    return this.shop?.shop_type === 'prescription';
  }

  /** OPD/hospital shops list their doctors */
  get isHospital(): boolean {
    return this.shop?.shop_type === 'opd';
  }

  get visibleDoctors(): any[] {
    return this.doctors.slice(0, this.visibleCount);
  }
  get hasMoreDoctors(): boolean {
    return this.doctors.length > this.visibleCount;
  }

  openDoctor(d: any): void {
    this.router.navigate(['/marketplace/doctor', d._id]);
  }

  /** go to the prescription upload form, tagged with this shop */
  uploadPrescription(): void {
    if (!AuthHelper.isLoggedIn()) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: `/marketplace/medical-store?shopId=${this.shop?._id}` },
      });
      return;
    }
    this.router.navigate(['/marketplace/medical-store'], { queryParams: { shopId: this.shop?._id } });
  }

  get items(): any[] {
    return this.isService ? this.services : this.products;
  }

  get visibleItems(): any[] {
    return this.items.slice(0, this.visibleCount);
  }

  get hasMore(): boolean {
    return this.items.length > this.visibleCount;
  }

  seeMore(): void {
    this.visibleCount += this.PAGE;
  }

  /** open the full detail page for a service or product */
  openItem(it: any): void {
    if (this.isService) this.router.navigate(['/marketplace/service', it._id]);
    else this.router.navigate(['/marketplace/product', it._id]); // existing product detail (with Add to Cart)
  }

  // ── Service booking ──
  bookingId: string | null = null;
  bookedIds = new Set<string>();
  bookError = '';

  isBooked(it: any): boolean {
    return this.bookedIds.has(it._id);
  }

  bookService(it: any): void {
    this.bookError = '';
    if (!AuthHelper.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    if (this.bookingId || this.isBooked(it)) return;
    this.bookingId = it._id;
    this.marketplace.bookService(it._id).subscribe({
      next: () => {
        this.bookingId = null;
        this.bookedIds.add(it._id);
      },
      error: (err) => {
        this.bookingId = null;
        this.bookError = err?.error?.message || 'Could not send booking request.';
      },
    });
  }

  /** discounted/listed price for a product */
  priceOf(item: any): number {
    if (!this.isService && item.discount > 0 && item.final_price != null) return item.final_price;
    return item.price;
  }

  imageOf(item: any): string | null {
    if (this.isService) return item.image_url ?? null;
    return item.images?.[0] ?? item.image_url ?? null;
  }

  initials(name: string): string {
    return (name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  goBack(): void {
    if (this.shop?.shop_type) this.router.navigate(['/marketplace/shops', this.shop.shop_type]);
    else this.router.navigate(['/marketplace']);
  }
}
