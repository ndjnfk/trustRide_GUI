import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../../environment';
import { AuthHelper } from '../helpers/auth-helper';

@Injectable({ providedIn: 'root' })
export class MarketplaceService {
  private readonly API_URL = environment.apiUrl;

  // Prefix for stored image paths like "/uploads/categories/x.jpg"
  readonly imageBase = environment.apiUrl;

  // Live cart count for the floating cart badge (0 when empty/logged out)
  private cartCountSubject = new BehaviorSubject<number>(0);
  cartCount$ = this.cartCountSubject.asObservable();

  constructor(private http: HttpClient) {}

  setCartCount(count: number): void {
    this.cartCountSubject.next(count < 0 ? 0 : count);
  }

  // Pull the current count from the server (or reset to 0 if logged out)
  refreshCartCount(): void {
    if (!AuthHelper.isLoggedIn()) {
      this.setCartCount(0);
      return;
    }
    this.getCart().subscribe({
      next: (res: any) => this.setCartCount(res.total_items ?? 0),
      error: () => this.setCartCount(0),
    });
  }

  // Public — all categories with image
  getCategories(): Observable<any> {
    return this.http.get(`${this.API_URL}/marketplace/categories`);
  }

  // Public — active products for one category
  getProductsByCategory(categoryId: string): Observable<any> {
    return this.http.get(`${this.API_URL}/marketplace/categories/${categoryId}/products`);
  }

  // Public — single product detail
  getProduct(productId: string): Observable<any> {
    return this.http.get(`${this.API_URL}/marketplace/products/${productId}`);
  }

  // Requires a logged-in user (sends the user auth token)
  addToCart(productId: string, quantity = 1): Observable<any> {
    return this.http
      .post(
        `${this.API_URL}/marketplace/cart`,
        { productId, quantity },
        { headers: AuthHelper.getAuthHeader() }
      )
      .pipe(tap((res: any) => this.setCartCount(res?.cart_count ?? 0)));
  }

  // ── Cart (all require a logged-in user) ──────────────────
  getCart(): Observable<any> {
    return this.http.get(`${this.API_URL}/marketplace/cart`, {
      headers: AuthHelper.getAuthHeader(),
    });
  }

  updateCartItem(productId: string, quantity: number): Observable<any> {
    return this.http.put(
      `${this.API_URL}/marketplace/cart/${productId}`,
      { quantity },
      { headers: AuthHelper.getAuthHeader() }
    );
  }

  removeCartItem(productId: string): Observable<any> {
    return this.http
      .delete(`${this.API_URL}/marketplace/cart/${productId}`, {
        headers: AuthHelper.getAuthHeader(),
      })
      .pipe(tap(() => this.refreshCartCount()));
  }

  // payload: { addressId } or { newAddress: {...}, setDefault?: boolean }
  checkout(payload: any = {}): Observable<any> {
    return this.http
      .post(
        `${this.API_URL}/marketplace/checkout`,
        payload,
        { headers: AuthHelper.getAuthHeader() }
      )
      .pipe(tap(() => this.setCartCount(0)));
  }

  // ── Addresses (require a logged-in user) ─────────────────
  getAddresses(): Observable<any> {
    return this.http.get(`${this.API_URL}/marketplace/addresses`, {
      headers: AuthHelper.getAuthHeader(),
    });
  }

  addAddress(payload: any): Observable<any> {
    return this.http.post(`${this.API_URL}/marketplace/addresses`, payload, {
      headers: AuthHelper.getAuthHeader(),
    });
  }

  // The user's own orders (for tracking)
  getMyOrders(): Observable<any> {
    return this.http.get(`${this.API_URL}/marketplace/orders`, {
      headers: AuthHelper.getAuthHeader(),
    });
  }

  // ── Product reviews ──────────────────────────────────────
  getProductReviews(productId: string): Observable<any> {
    return this.http.get(`${this.API_URL}/marketplace/products/${productId}/reviews`);
  }

  // Can the logged-in user review this product? (needs auth)
  getReviewEligibility(productId: string): Observable<any> {
    return this.http.get(`${this.API_URL}/marketplace/products/${productId}/review-eligibility`, {
      headers: AuthHelper.getAuthHeader(),
    });
  }

  submitReview(productId: string, rating: number, comment: string): Observable<any> {
    return this.http.post(
      `${this.API_URL}/marketplace/products/${productId}/reviews`,
      { rating, comment },
      { headers: AuthHelper.getAuthHeader() }
    );
  }

  isLoggedIn(): boolean {
    return AuthHelper.isLoggedIn();
  }

  // ── Pending "add to cart" intent across the login redirect ──
  private readonly PENDING_KEY = 'pending_cart';

  savePendingCart(productId: string, quantity: number): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.PENDING_KEY, JSON.stringify({ productId, quantity }));
  }

  takePendingCart(): { productId: string; quantity: number } | null {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(this.PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(this.PENDING_KEY);
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
