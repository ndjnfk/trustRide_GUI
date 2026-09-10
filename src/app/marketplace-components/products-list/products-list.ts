import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';

/**
 * Marketplace ka main page — saare products ek grid me.
 *
 * Pehle yahan pehle categories dikhti thi phir products. Ab "Products" par
 * click karte hi poori list aa jaati hai; category sirf ek filter chip hai,
 * ek extra screen nahi.
 */
@Component({
  selector: 'app-products-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products-list.html',
  styleUrl: './products-list.css',
})
export class ProductsList implements OnInit {
  products: any[] = [];
  categories: any[] = [];

  /** null = "All" chip selected */
  activeCategoryId: string | null = null;
  searchQuery = '';

  loading = false;
  error = '';

  imageBase: string;

  constructor(
    private marketplace: MarketplaceService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.imageBase = marketplace.imageBase;
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadProducts();
  }

  /** Chips ke liye. Categories na aayein to sirf grid dikha do, page tootna nahi chahiye. */
  private loadCategories(): void {
    this.marketplace.getCategories().subscribe({
      next: (res: any) => {
        this.categories = res?.categories || [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.categories = [];
      },
    });
  }

  loadProducts(): void {
    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();

    this.marketplace
      .getAllProducts({ categoryId: this.activeCategoryId ?? undefined })
      .subscribe({
        next: (res: any) => {
          this.products = res?.products || [];
          this.loading = false;
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.error = err?.error?.message || 'Products load nahi ho paye. Dobara try karein.';
          this.loading = false;
          this.cdr.detectChanges();
        },
      });
  }

  selectCategory(categoryId: string | null): void {
    if (this.activeCategoryId === categoryId) return;
    this.activeCategoryId = categoryId;
    this.loadProducts();
  }

  /** Search client-side hai — list already load ho chuki hai, har keystroke par
   *  server call karna bekaar hai. */
  get visibleProducts(): any[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.products;
    return this.products.filter(
      (p) =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.company_name || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
    );
  }

  openProduct(product: any): void {
    this.router.navigate(['/marketplace/product', product._id]);
  }

  goBack(): void {
    this.router.navigate(['/marketplace']);
  }
}
