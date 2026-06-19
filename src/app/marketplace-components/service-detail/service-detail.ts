import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';
import { AuthHelper } from '../../helpers/auth-helper';

@Component({
  selector: 'app-service-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './service-detail.html',
  styleUrl: './service-detail.css',
})
export class ServiceDetail {
  imageBase = '';

  loading = true;
  error = '';
  service: any = null;
  shop: any = null;

  // booking state
  booking = false;
  booked = false;
  bookError = '';

  constructor(
    private marketplace: MarketplaceService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.imageBase = this.marketplace.imageBase;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('serviceId');
    if (!id) { this.error = 'Service not found.'; this.loading = false; return; }
    this.load(id);
  }

  load(id: string): void {
    this.loading = true;
    this.marketplace.getServiceDetail(id).subscribe({
      next: (res: any) => {
        this.service = res?.service ?? null;
        this.shop = res?.shop ?? null;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load service.';
      },
    });
  }

  bookNow(): void {
    this.bookError = '';
    if (!AuthHelper.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    if (this.booking || this.booked || !this.service?._id) return;
    this.booking = true;
    this.marketplace.bookService(this.service._id).subscribe({
      next: () => { this.booking = false; this.booked = true; },
      error: (err) => {
        this.booking = false;
        this.bookError = err?.error?.message || 'Could not send booking request.';
      },
    });
  }

  goBack(): void {
    if (this.shop?._id) this.router.navigate(['/marketplace/shop', this.shop._id]);
    else window.history.back();
  }
}
