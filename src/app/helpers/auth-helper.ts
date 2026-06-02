import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class AuthHelper {
   private static readonly TOKEN_KEY = 'auth_token'

  private static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof sessionStorage !== 'undefined'
  }

    // ✅ Token Save Karo
  static setToken(token: string): void {
    if (!this.isBrowser()) return
    sessionStorage.setItem(this.TOKEN_KEY, token)
  }

  // ✅ Token Get Karo
  static getToken(): string | null {
    if (!this.isBrowser()) return null
    return sessionStorage.getItem(this.TOKEN_KEY)
  }

  // ✅ Token Remove Karo
  static removeToken(): void {
    if (!this.isBrowser()) return
    sessionStorage.removeItem(this.TOKEN_KEY)
  }
 // ✅ Logout — Sab Clear Karo
  static logout(): void {
    if (!this.isBrowser()) return
    sessionStorage.removeItem(this.TOKEN_KEY)

  }

  // ✅ Authorization Header Banao
  static getAuthHeader(): { Authorization: string } | {} {
    const token = this.getToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  }
   // ✅ Logged In Hai Ya Nahi
  static isLoggedIn(): boolean {
    return !!this.getToken()
  }
}
