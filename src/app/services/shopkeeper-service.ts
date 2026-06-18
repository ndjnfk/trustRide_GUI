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
