import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Ride } from '../services/ride';

@Injectable({
  providedIn: 'root',
})
export class AuthHelper {

  constructor(private router:Router,private rideService:Ride){}
   private static readonly TOKEN_KEY = 'auth_token'

  private static isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
  }

    // ✅ Token Save Karo — localStorage taaki browser band karne par bhi 7 din login rahe
  static setToken(token: string): void {
    if (!this.isBrowser()) return
    localStorage.setItem(this.TOKEN_KEY, token)
  }

  // ✅ Token Get Karo
  static getToken(): string | null {
    if (!this.isBrowser()) return null
    return localStorage.getItem(this.TOKEN_KEY)
  }

  // ✅ Token Remove Karo
  static removeToken(): void {
    if (!this.isBrowser()) return
    localStorage.removeItem(this.TOKEN_KEY)
  }
 // ✅ Logout — Sab Clear Karo
  static logout(): void {
    if (!this.isBrowser()) return
    localStorage.removeItem(this.TOKEN_KEY)

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

  // ✅ Token se apni user id nikalo.
  // Token JWT nahi hai — login pe `auth:<userId>` banta hai (AuthController) aur
  // Auth middleware usi string ko Redis key ki tarah use karta hai.
  // Sirf UI decisions ke liye (apni profile hai ya kisi aur ki) — asli
  // authorization backend hi karta hai, kyunki ye value client-side se aati hai.
  static getUserId(): string {
    const token = this.getToken()
    if (!token) return ''

    const [prefix, id] = token.split(':')
    return prefix === 'auth' && id ? id : ''
  }


  
}
