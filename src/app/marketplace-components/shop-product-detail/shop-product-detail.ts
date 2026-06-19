import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';
import { AuthHelper } from '../../helpers/auth-helper';

@Component({
  selector: 'app-shop-product-detail',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shop-product-detail.html',
  styleUrl: './shop-product-detail.css',
})
export class ShopProductDetail {
  imageBase = '';

  loading = true;
  error = '';
  product: any = null;
  shop: any = null;

  // selection
  activeImage = 0;
  selectedColor = '';
  selectedSize = '';
  qty = 1;

  // order state
  ordering = false;
  ordered = false;
  orderError = '';

  constructor(
    private marketplace: MarketplaceService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.imageBase = this.marketplace.imageBase;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('productId');
    if (!id) { this.error = 'Product not found.'; this.loading = false; return; }
    this.load(id);
  }

  load(id: string): void {
    this.loading = true;
    this.marketplace.getShopProductDetail(id).subscribe({
      next: (res: any) => {
        this.product = res?.product ?? null;
        this.shop = res?.shop ?? null;
        // preselect first available color / size for a valid default
        if (this.hasVariants) {
          this.selectedColor = this.colors[0] ?? '';
          this.selectedSize = this.sizes[0] ?? '';
        }
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load product.';
      },
    });
  }

  // ── variants (only when the product actually has them) ──
  get hasVariants(): boolean {
    return !!this.product?.has_variants && (this.product?.variants?.length ?? 0) > 0;
  }
  get colors(): string[] {
    if (!this.hasVariants) return [];
    return [...new Set(this.product.variants.map((v: any) => v.color).filter(Boolean))] as string[];
  }
  get sizes(): string[] {
    if (!this.hasVariants) return [];
    return [...new Set(this.product.variants.map((v: any) => v.size).filter(Boolean))] as string[];
  }
  get selectedVariant(): any {
    if (!this.hasVariants) return null;
    return this.product.variants.find((v: any) =>
      (!this.colors.length || v.color === this.selectedColor) &&
      (!this.sizes.length || v.size === this.selectedSize)
    ) ?? null;
  }

  get unitPrice(): number {
    if (this.hasVariants && this.selectedVariant) return this.selectedVariant.price ?? 0;
    return this.product?.final_price ?? this.product?.price ?? 0;
  }
  get availableStock(): number {
    if (this.hasVariants && this.selectedVariant) return this.selectedVariant.stock ?? 0;
    return this.product?.stock ?? 0;
  }
  get total(): number {
    return this.unitPrice * this.qty;
  }

  get canOrder(): boolean {
    if (this.hasVariants) {
      if (this.colors.length && !this.selectedColor) return false;
      if (this.sizes.length && !this.selectedSize) return false;
      return !!this.selectedVariant && this.selectedVariant.stock > 0;
    }
    return this.availableStock > 0;
  }

  selectColor(c: string): void { this.selectedColor = c; this.clampQty(); }
  selectSize(s: string): void { this.selectedSize = s; this.clampQty(); }

  incQty(): void { if (this.qty < this.availableStock) this.qty++; }
  decQty(): void { if (this.qty > 1) this.qty--; }
  private clampQty(): void { if (this.qty > this.availableStock) this.qty = Math.max(1, this.availableStock); }

  setImage(i: number): void { this.activeImage = i; }

  order(): void {
    this.orderError = '';
    if (!AuthHelper.isLoggedIn()) { this.router.navigate(['/login']); return; }
    if (this.ordering || this.ordered || !this.canOrder) return;
    this.ordering = true;
    this.marketplace.orderShopProduct(this.product._id, {
      color: this.selectedColor || null,
      size: this.selectedSize || null,
      qty: this.qty,
    }).subscribe({
      next: () => { this.ordering = false; this.ordered = true; },
      error: (err) => {
        this.ordering = false;
        this.orderError = err?.error?.message || 'Could not place order.';
      },
    });
  }

  goBack(): void {
    if (this.shop?._id) this.router.navigate(['/marketplace/shop', this.shop._id]);
    else window.history.back();
  }
}
