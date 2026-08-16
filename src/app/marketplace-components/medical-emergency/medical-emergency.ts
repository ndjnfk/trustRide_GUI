import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';

/**
 * "Medical Emergency" page — admin-curated pharmacy cards. Login zaroori hai.
 *
 * Har card par: city badge, dukaan ka naam, shop timing, address aur dahine
 * WhatsApp icon (seedha chat kholta hai).
 */
@Component({
  selector: 'app-medical-emergency',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './medical-emergency.html',
  styleUrl: './medical-emergency.css',
})
export class MedicalEmergency {
  loading = true;
  error = '';
  pharmacies: any[] = [];

  search = '';

  // Pagination client-side hai — poori list ek hi API call me aati hai.
  readonly pageSize = 20;
  page = 1;

  constructor(private marketplace: MarketplaceService, private router: Router) {}

  ngOnInit(): void {
    // URL seedha type karne par bhi page na khule — entry points chhupane ke
    // saath ye redirect hi restriction ko asli banata hai.
    if (!this.marketplace.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/medical-emergency' } });
      return;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.marketplace.getMedicalEmergencyPharmacies().subscribe({
      next: (res: any) => {
        this.pharmacies = res?.data ?? [];
        this.page = 1;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load pharmacies.';
      },
    });
  }

  get filteredPharmacies(): any[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.pharmacies;

    return this.pharmacies.filter((p) =>
      [p.shop_name, p.city, p.address].join(' ').toLowerCase().includes(q)
    );
  }

  /** Search badalne par page 3 par rehna bekaar hai — list hi nayi hai. */
  onSearchChange(value: string): void {
    this.search = value;
    this.page = 1;
  }

  /* ── Pagination (20 cards per page) ──────────────────────── */
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredPharmacies.length / this.pageSize));
  }

  get pagedPharmacies(): any[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredPharmacies.slice(start, start + this.pageSize);
  }

  /** "Showing X–Y" ke liye. */
  get pageStart(): number {
    return this.filteredPharmacies.length ? (this.page - 1) * this.pageSize + 1 : 0;
  }

  get pageEnd(): number {
    return Math.min(this.page * this.pageSize, this.filteredPharmacies.length);
  }

  /** Bahut pages hone par sirf current ke aas-paas ke 5 numbers dikhao. */
  get pageNumbers(): number[] {
    const total = this.totalPages;
    const size = Math.min(5, total);
    let start = Math.max(1, this.page - Math.floor(size / 2));
    start = Math.min(start, total - size + 1);
    return Array.from({ length: size }, (_, i) => start + i);
  }

  get firstShownPage(): number {
    return this.pageNumbers[0];
  }

  get lastShownPage(): number {
    const list = this.pageNumbers;
    return list[list.length - 1];
  }

  goToPage(page: number): void {
    const target = Math.min(Math.max(1, page), this.totalPages);
    if (target === this.page) return;

    this.page = target;
    // Nayi page ka pehla card top par ho, warna user list ke beech me khada rehta hai.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /** wa.me ko country code ke saath sirf digits chahiye. */
  whatsappLink(p: any): string {
    const digits = String(p?.whatsapp_number ?? '').replace(/\D/g, '');
    // 10-digit number ke aage 91; agar admin ne pehle se code daala hai to waise hi.
    const withCode = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${withCode}`;
  }

  /** "09:00"/"22:00" → "9:00 AM – 10:00 PM"; timing na ho to row hi nahi dikhti. */
  formatTiming(p: any): string {
    if (!p?.open_time || !p?.close_time) return '';
    return `${this.to12Hour(p.open_time)} – ${this.to12Hour(p.close_time)}`;
  }

  private to12Hour(hhmm: string): string {
    const [h, m] = String(hhmm).split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
  }
}
