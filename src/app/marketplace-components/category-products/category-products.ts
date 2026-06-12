import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';

@Component({
  selector: 'app-category-products',
  imports: [CommonModule],
  templateUrl: './category-products.html',
  styleUrl: './category-products.css',
})
export class CategoryProducts {
  products: any[] = [];
  category: any = null;
  loading = false;
  error = '';

  imageBase: string;

  constructor(
    private marketplace: MarketplaceService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {
    this.imageBase = marketplace.imageBase;
  }

  ngOnInit() {
    const categoryId = this.route.snapshot.paramMap.get('categoryId');
    if (categoryId) {
      this.fetchProducts(categoryId);
    } else {
      this.error = 'No category selected.';
    }
  }

  fetchProducts(categoryId: string) {
    this.loading = true;
    this.error = '';

    this.marketplace.getProductsByCategory(categoryId).subscribe({
      next: (res: any) => {
        this.products = res.products || [];
        this.category = res.category || null;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load products. Please try again.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  goBack() {
    this.router.navigate(['/marketplace']);
  }

  openProduct(product: any) {
    this.router.navigate(['/marketplace/product', product._id]);
  }
}
