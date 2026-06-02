import { HttpHeaders } from "@angular/common/http";

export class AdminSessionHelper {
     private static readonly TOKEN_KEY = 'admin_token';

  private static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined';
  }

  // Get admin token directly
  static getAdminToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(this.TOKEN_KEY); // ← sessionStorage → localStorage
  }

  static setAdminToken(token: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(this.TOKEN_KEY, token); // ← sessionStorage → localStorage
  }

  static clearAdminToken(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(this.TOKEN_KEY); // ← sessionStorage → localStorage
  }

  static isAdminLoggedIn(): boolean {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(this.TOKEN_KEY); // ← sessionStorage → localStorage
  }

  static getAuthHeaders(): HttpHeaders {
    const token = typeof window !== 'undefined'
      ? (localStorage.getItem(this.TOKEN_KEY) || '')  // ← sessionStorage → localStorage
      : '';
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }
}
