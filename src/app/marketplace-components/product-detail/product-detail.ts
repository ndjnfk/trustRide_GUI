import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';
import { Snackbar } from '../../services/snackbar';

@Component({
  selector: 'app-product-detail',
  imports: [CommonModule, FormsModule],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.css',
})
export class ProductDetail {
  product: any = null;
  loading = false;
  error = '';

  // selected image (gallery)
  activeImage: string | null = null;
  quantity = 1;
  adding = false;

  imageBase: string;

  // ── Reviews ──
  reviews: any[] = [];
  avgRating = 0;
  reviewCount = 0;
  canReview = false;
  hasReviewed = false;
  myRating = 0;
  myComment = '';
  submittingReview = false;

  constructor(
    public marketplace: MarketplaceService,
    private route: ActivatedRoute,
    private router: Router,
    private snackbar: Snackbar,
    private cdr: ChangeDetectorRef
  ) {
    this.imageBase = marketplace.imageBase;
  }

  ngOnInit() {
    const productId = this.route.snapshot.paramMap.get('productId');
    if (productId) {
      this.fetchProduct(productId);
    } else {
      this.error = 'No product selected.';
    }
  }

  fetchProduct(productId: string) {
    this.loading = true;
    this.error = '';

    this.marketplace.getProduct(productId).subscribe({
      next: (res: any) => {
        this.product = res.product || null;
        this.activeImage = this.product?.images?.[0] ?? null;
        this.loading = false;
        this.cdr.detectChanges();
        this.resumePendingCart();
        this.loadReviews(productId);
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load product. Please try again.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  setImage(img: string) {
    this.activeImage = img;
  }

  incQty() {
    if (this.product && this.quantity < this.product.stock) this.quantity++;
  }

  decQty() {
    if (this.quantity > 1) this.quantity--;
  }

  addToCart() {
    if (!this.product || this.product.stock <= 0) return;

    if (!this.marketplace.isLoggedIn()) {
      // Remember what the user wanted, then send them to login and back here
      this.marketplace.savePendingCart(this.product._id, this.quantity);
      this.snackbar.info('Please log in to add items to your cart');
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: `/marketplace/product/${this.product._id}` },
      });
      return;
    }

    this.adding = true;
    this.marketplace.addToCart(this.product._id, this.quantity).subscribe({
      next: (res: any) => {
        this.adding = false;
        this.snackbar.success(res.message || 'Added to cart');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.adding = false;
        this.snackbar.error(err?.error?.message || 'Failed to add to cart');
        this.cdr.detectChanges();
      },
    });
  }

  // After returning from login, finish the add-to-cart the user started.
  private resumePendingCart() {
    if (!this.product || !this.marketplace.isLoggedIn()) return;

    const pending = this.marketplace.takePendingCart();
    if (pending && pending.productId === this.product._id) {
      this.quantity = pending.quantity || 1;
      this.addToCart();
    }
  }

  // ── Reviews ──────────────────────────────────────────────
  loadReviews(productId: string) {
    this.marketplace.getProductReviews(productId).subscribe({
      next: (res: any) => {
        this.reviews = res.reviews || [];
        this.avgRating = res.average_rating || 0;
        this.reviewCount = res.total || 0;
        this.cdr.detectChanges();
      },
    });

    // Only logged-in users can be eligible to review
    if (this.marketplace.isLoggedIn()) {
      this.marketplace.getReviewEligibility(productId).subscribe({
        next: (res: any) => {
          this.canReview = !!res.can_review;
          this.hasReviewed = !!res.has_reviewed;
          if (res.review) {
            this.myRating = res.review.rating || 0;
            this.myComment = res.review.comment || '';
          }
          this.cdr.detectChanges();
        },
      });
    }
  }

  setMyRating(value: number) {
    this.myRating = value;
  }

  submitReview() {
    if (!this.product) return;
    if (this.myRating < 1) {
      this.snackbar.error('Please select a rating');
      return;
    }

    this.submittingReview = true;
    this.marketplace.submitReview(this.product._id, this.myRating, this.myComment.trim()).subscribe({
      next: (res: any) => {
        this.submittingReview = false;
        this.hasReviewed = true;
        this.snackbar.success(res.message || 'Review submitted');
        this.loadReviews(this.product._id);
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.submittingReview = false;
        this.snackbar.error(err?.error?.message || 'Failed to submit review');
        this.cdr.detectChanges();
      },
    });
  }

  // Array helper for rendering star icons in the template
  stars(n: number): number[] {
    return Array(Math.max(0, Math.round(n))).fill(0);
  }

  emptyStars(n: number): number[] {
    return Array(Math.max(0, 5 - Math.round(n))).fill(0);
  }

  goBack() {
    if (this.product?.categoryId) {
      this.router.navigate(['/marketplace/category', this.product.categoryId]);
    } else {
      this.router.navigate(['/marketplace']);
    }
  }

  goToCart() {
    this.router.navigate(['/marketplace/cart']);
  }
}
