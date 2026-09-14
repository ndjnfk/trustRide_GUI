import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from '../../../environment';
import { SKIP_LOADER_HEADER } from '../interceptors/loader-interceptor';

/**
 * Ride click counter.
 *
 * Jab bhi koi ride khulti hai (/ride-detail/:id), yahan se ek chhoti si POST
 * jaati hai. Admin panel ka "Ride Clicks" chart isi data par banta hai.
 *
 * Naam ka jugaad:
 *   • Logged-in — token request ke saath jaata hai (AuthInterceptor lagata hai),
 *     server session se user ka naam le leta hai.
 *   • Guest     — naam hai hi nahi, isliye browser ek random id localStorage me
 *     rakhta hai aur server usse permanent label deta hai: guest1, guest2…
 *     Wahi id har baar bheji jaati hai taaki ek hi guest ke clicks jud sakein.
 *
 * Call fire-and-forget hai — count fail ho to bhi ride page normal chalta hai.
 */
@Injectable({ providedIn: 'root' })
export class RideClickTracker {
  private readonly baseUrl = environment.apiUrl;
  private readonly GUEST_KEY = 'ride_click_guest_id';

  constructor(private http: HttpClient) {}

  /** Ek ride open hone ka click record karo. Errors chup-chaap ignore. */
  track(rideId: string): void {
    if (!rideId) return;
    // SSR ke dauran mat bhejo — wo real user ka click nahi hai.
    if (typeof window === 'undefined') return;

    this.http
      .post<{ success: boolean; guest_id: string | null }>(
        `${this.baseUrl}/ride-clicks`,
        { ride_id: rideId, guest_id: this.guestId() },
        // Global loader is background call ke liye nahi chahiye.
        { headers: { [SKIP_LOADER_HEADER]: '1' } }
      )
      .subscribe({
        next: (res) => {
          // Server ne naya id banaya ho (localStorage khaali tha) to save kar lo.
          if (res?.guest_id) this.rememberGuestId(res.guest_id);
        },
        error: () => {
          /* counting best-effort hai — user ko kuch dikhane ki zaroorat nahi */
        },
      });
  }

  /** localStorage me pada guest id, warna naya bana ke save kar do. */
  private guestId(): string {
    if (!this.isBrowser()) return '';
    try {
      const saved = localStorage.getItem(this.GUEST_KEY);
      if (saved) return saved;
      const fresh = this.newGuestId();
      localStorage.setItem(this.GUEST_KEY, fresh);
      return fresh;
    } catch {
      // Private mode / storage blocked — id ke bina bhejo, server khud bana lega.
      return '';
    }
  }

  private rememberGuestId(id: string): void {
    if (!this.isBrowser()) return;
    try {
      if (localStorage.getItem(this.GUEST_KEY) !== id) {
        localStorage.setItem(this.GUEST_KEY, id);
      }
    } catch {
      /* ignore */
    }
  }

  private newGuestId(): string {
    const webCrypto = (globalThis as any).crypto;
    const rand =
      typeof webCrypto?.randomUUID === 'function'
        ? String(webCrypto.randomUUID()).replace(/-/g, '')
        : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    return `g_${Date.now().toString(36)}_${rand}`.slice(0, 64);
  }

  private isBrowser(): boolean {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  }
}
