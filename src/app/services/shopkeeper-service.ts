import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environment';

export interface ShopRegisterPayload {
  owner_name: string;
  shop_name: string;
  shop_type: 'product' | 'service' | 'prescription' | 'opd';
  phoneNumber: string;
  email: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class ShopkeeperService {
  private readonly API_URL = environment.apiUrl;
  private readonly TOKEN_KEY = 'shop_token';
  private readonly SHOP_KEY = 'shop_user';

  constructor(private http: HttpClient) {}

  // payload is FormData (multipart) so the shop image can be uploaded.
  // The browser sets the multipart boundary — do not set Content-Type.
  register(payload: FormData): Observable<any> {
    return this.http.post(`${this.API_URL}/shop/register`, payload);
  }

  private authHeaders(): { [k: string]: string } {
    return { Authorization: `Bearer ${this.getToken() ?? ''}` };
  }

  // Logged-in shop's full profile (from server)
  me(): Observable<any> {
    return this.http.get(`${this.API_URL}/shop/me`, { headers: this.authHeaders() });
  }

  // Update profile / timings / availability — FormData so the image can be replaced
  updateSettings(payload: FormData): Observable<any> {
    return this.http.put(`${this.API_URL}/shop/settings`, payload, { headers: this.authHeaders() });
  }

  // ── Product catalog ──
  getProducts(): Observable<any> {
    return this.http.get(`${this.API_URL}/shop/products`, { headers: this.authHeaders() });
  }
  createProduct(payload: FormData): Observable<any> {
    return this.http.post(`${this.API_URL}/shop/products`, payload, { headers: this.authHeaders() });
  }
  updateProduct(id: string, payload: FormData): Observable<any> {
    return this.http.put(`${this.API_URL}/shop/products/${id}`, payload, { headers: this.authHeaders() });
  }
  deleteProduct(id: string): Observable<any> {
    return this.http.delete(`${this.API_URL}/shop/products/${id}`, { headers: this.authHeaders() });
  }

  // ── Product categories ──
  getCategories(): Observable<any> {
    return this.http.get(`${this.API_URL}/shop/categories`, { headers: this.authHeaders() });
  }
  createCategory(name: string): Observable<any> {
    return this.http.post(`${this.API_URL}/shop/categories`, { name }, { headers: this.authHeaders() });
  }
  updateCategory(id: string, name: string): Observable<any> {
    return this.http.put(`${this.API_URL}/shop/categories/${id}`, { name }, { headers: this.authHeaders() });
  }
  deleteCategory(id: string): Observable<any> {
    return this.http.delete(`${this.API_URL}/shop/categories/${id}`, { headers: this.authHeaders() });
  }

  // ── Service catalog ──
  getServices(): Observable<any> {
    return this.http.get(`${this.API_URL}/shop/services`, { headers: this.authHeaders() });
  }
  createService(payload: FormData): Observable<any> {
    return this.http.post(`${this.API_URL}/shop/services`, payload, { headers: this.authHeaders() });
  }
  updateService(id: string, payload: FormData): Observable<any> {
    return this.http.put(`${this.API_URL}/shop/services/${id}`, payload, { headers: this.authHeaders() });
  }
  deleteService(id: string): Observable<any> {
    return this.http.delete(`${this.API_URL}/shop/services/${id}`, { headers: this.authHeaders() });
  }

  // ── Service booking requests ──
  getServiceBookings(): Observable<any> {
    return this.http.get(`${this.API_URL}/shop/service-bookings`, { headers: this.authHeaders() });
  }
  updateServiceBookingStatus(id: string, status: string): Observable<any> {
    return this.http.put(`${this.API_URL}/shop/service-bookings/${id}`, { status }, { headers: this.authHeaders() });
  }

  // ── Product orders ──
  getProductOrders(): Observable<any> {
    return this.http.get(`${this.API_URL}/shop/orders`, { headers: this.authHeaders() });
  }
  updateProductOrderStatus(id: string, status: string): Observable<any> {
    return this.http.put(`${this.API_URL}/shop/orders/${id}/status`, { status }, { headers: this.authHeaders() });
  }

  login(email: string, password: string): Observable<any> {
    return this.http.post(`${this.API_URL}/shop/login`, { email, password }).pipe(
      tap((res: any) => {
        if (res?.token) {
          this.setToken(res.token);
          if (res.shop) localStorage.setItem(this.SHOP_KEY, JSON.stringify(res.shop));
        }
      })
    );
  }

  // ── Session helpers ──────────────────────────────────────
  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }

  setToken(token: string): void {
    if (this.isBrowser()) localStorage.setItem(this.TOKEN_KEY, token);
  }

  getToken(): string | null {
    return this.isBrowser() ? localStorage.getItem(this.TOKEN_KEY) : null;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  logout(): void {
    if (!this.isBrowser()) return;
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.SHOP_KEY);
  }
}
