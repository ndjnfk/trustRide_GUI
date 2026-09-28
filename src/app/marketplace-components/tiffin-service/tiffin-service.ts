import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';

/**
 * "Tiffin Service" page — admin-curated tiffin cards. Login zaroori hai.
 *
 * Medical Emergency page ka hi jaddha hai. Har card par: city badge, service ka
 * naam, rate, timing, address aur dahine WhatsApp icon (seedha chat kholta hai)
 * — order user wahin WhatsApp par de deta hai.
 */
@Component({
  selector: 'app-tiffin-service',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './tiffin-service.html',
  styleUrl: './tiffin-service.css',
})
export class TiffinService {
  loading = true;
  error = '';
  tiffins: any[] = [];

  search = '';

  // Pagination client-side hai — poori list ek hi API call me aati hai.
  readonly pageSize = 20;
  page = 1;

  constructor(private marketplace: MarketplaceService, private router: Router) {}

  ngOnInit(): void {
    // URL seedha type karne par bhi page na khule — entry points chhupane ke
    // saath ye redirect hi restriction ko asli banata hai.
    if (!this.marketplace.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/tiffin-service' } });
      return;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.marketplace.getTiffinServices().subscribe({
      next: (res: any) => {
        this.tiffins = res?.data ?? [];
        this.page = 1;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load tiffin services.';
      },
    });
  }

  get filteredTiffins(): any[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return this.tiffins;

    return this.tiffins.filter((t) =>
      [t.shop_name, t.city, t.address].join(' ').toLowerCase().includes(q)
    );
  }

  /** Search badalne par page 3 par rehna bekaar hai — list hi nayi hai. */
  onSearchChange(value: string): void {
    this.search = value;
    this.page = 1;
  }

  /* ── Pagination (20 cards per page) ──────────────────────── */
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTiffins.length / this.pageSize));
  }

  get pagedTiffins(): any[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredTiffins.slice(start, start + this.pageSize);
  }

  /** "Showing X–Y" ke liye. */
  get pageStart(): number {
    return this.filteredTiffins.length ? (this.page - 1) * this.pageSize + 1 : 0;
  }

  get pageEnd(): number {
    return Math.min(this.page * this.pageSize, this.filteredTiffins.length);
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
  whatsappLink(t: any): string {
    const digits = String(t?.whatsapp_number ?? '').replace(/\D/g, '');
    // 10-digit number ke aage 91; agar admin ne pehle se code daala hai to waise hi.
    const withCode = digits.length === 10 ? `91${digits}` : digits;
    return `https://wa.me/${withCode}`;
  }

  /** "₹80 / tiffin"; rate na ho to row hi nahi dikhti. */
  formatPrice(t: any): string {
    const price = t?.price_per_tiffin;
    if (price === null || price === undefined || price === '') return '';
    return `₹${price} / tiffin`;
  }

  /** Card par meal rows isi order me aati hain. */
  private readonly meals = [
    { key: 'breakfast', label: 'Breakfast', icon: 'ti ti-sunrise' },
    { key: 'lunch', label: 'Lunch', icon: 'ti ti-sun' },
    { key: 'dinner', label: 'Dinner', icon: 'ti ti-moon' },
  ];

  /**
   * Sirf wahi meals jinka timing admin ne bhara hai.
   * Teeno khaali ho to khaali array — card par koi timing row nahi dikhti.
   */
  mealTimings(t: any): { label: string; icon: string; time: string }[] {
    return this.meals
      .map((meal) => ({
        label: meal.label,
        icon: meal.icon,
        time: this.formatWindow(t?.[`${meal.key}_start`], t?.[`${meal.key}_end`]),
      }))
      .filter((row) => !!row.time);
  }

  /** "09:00"/"11:00" → "9:00 AM – 11:00 AM"; aadha window ho to khaali. */
  private formatWindow(start: any, end: any): string {
    if (!start || !end) return '';
    return `${this.to12Hour(start)} – ${this.to12Hour(end)}`;
  }

  private to12Hour(hhmm: string): string {
    const [h, m] = String(hhmm).split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
  }
}
