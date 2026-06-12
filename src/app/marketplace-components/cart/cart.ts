import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';
import { Snackbar } from '../../services/snackbar';

@Component({
  selector: 'app-cart',
  imports: [CommonModule],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class Cart {
  items: any[] = [];
  totalAmount = 0;
  loading = false;
  error = '';

  updatingId: string | null = null;
  removingId: string | null = null;
  placingOrder = false;

  imageBase: string;

  constructor(
    private marketplace: MarketplaceService,
    private router: Router,
    private snackbar: Snackbar,
    private cdr: ChangeDetectorRef
  ) {
    this.imageBase = marketplace.imageBase;
  }

  ngOnInit() {
    if (!this.marketplace.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/marketplace/cart' } });
      return;
    }
    this.fetchCart();
  }

  fetchCart() {
    this.loading = true;
    this.error = '';

    this.marketplace.getCart().subscribe({
      next: (res: any) => {
        this.items = res.items || [];
        this.totalAmount = res.total_amount || 0;
        this.marketplace.setCartCount(res.total_items ?? this.items.length);
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load your cart.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  changeQty(item: any, delta: number) {
    const newQty = item.quantity + delta;
    if (newQty < 1 || newQty > item.stock) return;

    this.updatingId = item.productId;
    this.marketplace.updateCartItem(item.productId, newQty).subscribe({
      next: () => {
        this.updatingId = null;
        this.fetchCart();
      },
      error: (err: any) => {
        this.updatingId = null;
        this.snackbar.error(err?.error?.message || 'Failed to update quantity');
        this.cdr.detectChanges();
      },
    });
  }

  removeItem(item: any) {
    this.removingId = item.productId;
    this.marketplace.removeCartItem(item.productId).subscribe({
      next: () => {
        this.removingId = null;
        this.snackbar.success('Item removed');
        this.fetchCart();
      },
      error: (err: any) => {
        this.removingId = null;
        this.snackbar.error(err?.error?.message || 'Failed to remove item');
        this.cdr.detectChanges();
      },
    });
  }

  checkout() {
    if (this.items.length === 0) return;
    // Move to the address step; the order is placed from there
    this.router.navigate(['/marketplace/checkout']);
  }

  continueShopping() {
    this.router.navigate(['/marketplace']);
  }
}
