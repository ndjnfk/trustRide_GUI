import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { MarketplaceService } from '../../services/marketplace-service';

@Component({
  selector: 'app-cart-fab',
  imports: [CommonModule],
  templateUrl: './cart-fab.html',
  styleUrl: './cart-fab.css',
})
export class CartFab {
  count$: Observable<number>;

  constructor(private marketplace: MarketplaceService, private router: Router) {
    this.count$ = this.marketplace.cartCount$;
  }

  ngOnInit() {
    // Sync the badge with the server whenever the storefront opens
    this.marketplace.refreshCartCount();
  }

  openCart() {
    this.router.navigate(['/marketplace/cart']);
  }
}
