import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environment';
import { AuthHelper } from '../helpers/auth-helper';
import { SKIP_LOADER_HEADER } from '../interceptors/loader-interceptor';
import { Snackbar } from './snackbar';

/*
 * Browser push notifications (Firebase Cloud Messaging).
 *
 * Flow:
 *   enable()        → permission maango → firebase-messaging-sw.js register →
 *                     FCM token lo → POST /push/register (backend user doc me save)
 *   disable()       → PUT /push/preference {enabled:false} + token delete
 *   syncOnStartup() → app khulte hi: permission granted + server pe ON ho to
 *                     token refresh karke dobara register (tokens rotate hote hain)
 *                     + foreground messages ke liye listener
 *
 * Firebase SDK lazy import hota hai — initial bundle me nahi aata, aur SSR par
 * kabhi load nahi hota (isBrowser guard).
 *
 * Service worker alag scope par register hota hai taaki Angular ka
 * ngsw-worker.js (PWA) replace na ho.
 */

const SW_URL = '/firebase-messaging-sw.js';
const SW_SCOPE = '/firebase-cloud-messaging-push-scope/';
const TOKEN_KEY = 'push_token';

export type PushState = 'unsupported' | 'blocked' | 'off' | 'on';

export interface PushStatusResponse {
  success: boolean;
  enabled: boolean;
  devices: number;
  configured: boolean;
}

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private platformId = inject(PLATFORM_ID);
  private http = inject(HttpClient);
  private snackbar = inject(Snackbar);

  private readonly api = environment.apiUrl;
  private foregroundBound = false;
  private swRegistration: ServiceWorkerRegistration | null = null;

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId) && typeof window !== 'undefined';
  }

  private get silentHeaders(): HttpHeaders {
    return new HttpHeaders({ [SKIP_LOADER_HEADER]: 'true' });
  }

  /** Browser web-push support karta hai? (HTTPS/localhost + SW + Notification API) */
  async isSupported(): Promise<boolean> {
    if (!this.isBrowser) return false;
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
      return false;
    }
    try {
      const { isSupported } = await import('firebase/messaging');
      return await isSupported();
    } catch {
      return false;
    }
  }

  /** Browser-level permission */
  get permission(): NotificationPermission | 'unsupported' {
    if (!this.isBrowser || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  }

  /** Server par stored preference + devices */
  async getServerStatus(): Promise<PushStatusResponse | null> {
    if (!this.isBrowser || !AuthHelper.isLoggedIn()) return null;
    try {
      return await firstValueFrom(
        this.http.get<PushStatusResponse>(`${this.api}/push/status`, { headers: this.silentHeaders })
      );
    } catch {
      return null;
    }
  }

  /** Combined state for the profile toggle */
  async getState(): Promise<PushState> {
    if (!(await this.isSupported())) return 'unsupported';
    if (this.permission === 'denied') return 'blocked';
    if (this.permission !== 'granted') return 'off';
    const status = await this.getServerStatus();
    return status?.enabled ? 'on' : 'off';
  }

  /**
   * Notifications ON karo: permission → token → backend register.
   * Returns final state ('on' | 'blocked' | 'unsupported' | 'off' on failure).
   */
  async enable(): Promise<PushState> {
    if (!(await this.isSupported())) return 'unsupported';
    if (!AuthHelper.isLoggedIn()) return 'off';

    let permission = this.permission;
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }
    if (permission === 'denied') return 'blocked';
    if (permission !== 'granted') return 'off';

    const token = await this.obtainToken();
    if (!token) return 'off';

    await firstValueFrom(
      this.http.post(`${this.api}/push/register`, { token, platform: 'web' }, { headers: this.silentHeaders })
    );
    await firstValueFrom(
      this.http.put(`${this.api}/push/preference`, { enabled: true }, { headers: this.silentHeaders })
    );
    this.safeSet(TOKEN_KEY, token);
    await this.bindForeground();
    return 'on';
  }

  /** Notifications OFF karo (server preference + is device ka token) */
  async disable(): Promise<void> {
    if (!this.isBrowser) return;
    try {
      await firstValueFrom(
        this.http.put(`${this.api}/push/preference`, { enabled: false }, { headers: this.silentHeaders })
      );
    } catch {
      /* best effort */
    }
    await this.unregisterCurrentDevice();
  }

  /** Is device ka token backend + Firebase dono se hata do (logout / disable) */
  async unregisterCurrentDevice(): Promise<void> {
    if (!this.isBrowser) return;
    const token = this.safeGet(TOKEN_KEY);
    if (token && AuthHelper.isLoggedIn()) {
      try {
        await firstValueFrom(
          this.http.delete(`${this.api}/push/unregister`, { body: { token }, headers: this.silentHeaders })
        );
      } catch {
        /* best effort */
      }
    }
    try {
      const messaging = await this.getMessaging();
      if (messaging) {
        const { deleteToken } = await import('firebase/messaging');
        await deleteToken(messaging);
      }
    } catch {
      /* token already gone */
    }
    this.safeRemove(TOKEN_KEY);
  }

  /** Test push apne hi devices par (profile page button) */
  async sendTest(): Promise<{ ok: boolean; message: string }> {
    try {
      const res: any = await firstValueFrom(
        this.http.post(`${this.api}/push/test`, {}, { headers: this.silentHeaders })
      );
      return { ok: true, message: `Sent to ${res?.sent ?? 1} device(s)` };
    } catch (err: any) {
      return { ok: false, message: err?.error?.message || 'Could not send test notification' };
    }
  }

  /**
   * App start par: logged-in + permission granted + server pe ON → token
   * refresh karke register, foreground listener laga do. Kuch bhi fail ho to
   * chup-chaap ignore (notifications optional feature hai).
   */
  async syncOnStartup(): Promise<void> {
    if (!this.isBrowser || !AuthHelper.isLoggedIn()) return;
    if (this.permission !== 'granted') return;
    if (!(await this.isSupported())) return;

    try {
      const status = await this.getServerStatus();
      if (!status?.enabled) return;

      const token = await this.obtainToken();
      if (!token) return;
      if (token !== this.safeGet(TOKEN_KEY)) {
        await firstValueFrom(
          this.http.post(`${this.api}/push/register`, { token, platform: 'web' }, { headers: this.silentHeaders })
        );
        this.safeSet(TOKEN_KEY, token);
      }
      await this.bindForeground();
    } catch (e) {
      console.warn('[push] startup sync skipped:', (e as any)?.message ?? e);
    }
  }

  // ── internals ──────────────────────────────────────────────────────────────

  private async getRegistration(): Promise<ServiceWorkerRegistration> {
    if (this.swRegistration?.active) return this.swRegistration;
    const reg = await navigator.serviceWorker.register(SW_URL, { scope: SW_SCOPE });
    if (!reg.active) {
      await new Promise<void>((resolve) => {
        const sw = reg.installing ?? reg.waiting;
        if (!sw) return resolve();
        const onChange = () => {
          if (sw.state === 'activated') {
            sw.removeEventListener('statechange', onChange);
            resolve();
          }
        };
        sw.addEventListener('statechange', onChange);
        // safety: 10s se zyada mat ruko
        setTimeout(resolve, 10000);
      });
    }
    this.swRegistration = reg;
    return reg;
  }

  private async getMessaging() {
    if (!this.isBrowser) return null;
    const { initializeApp, getApps } = await import('firebase/app');
    const { getMessaging } = await import('firebase/messaging');
    const app = getApps()[0] ?? initializeApp(environment.firebase);
    return getMessaging(app);
  }

  private async obtainToken(): Promise<string | null> {
    try {
      const reg = await this.getRegistration();
      const messaging = await this.getMessaging();
      if (!messaging) return null;
      const { getToken } = await import('firebase/messaging');
      const token = await getToken(messaging, {
        vapidKey: environment.vapidKey,
        serviceWorkerRegistration: reg,
      });
      return token || null;
    } catch (e) {
      console.warn('[push] token failed:', (e as any)?.message ?? e);
      return null;
    }
  }

  /** Page khuli ho tab push SW ko nahi, page ko milta hai → snackbar + (tab hidden ho to) native notification */
  private async bindForeground(): Promise<void> {
    if (this.foregroundBound) return;
    const messaging = await this.getMessaging();
    if (!messaging) return;
    const { onMessage } = await import('firebase/messaging');
    this.foregroundBound = true;

    onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? payload.data?.['title'] ?? 'TrustRide';
      const body = payload.notification?.body ?? payload.data?.['body'] ?? '';
      const url = payload.data?.['url'] ?? '';
      console.log('[push] foreground message:', payload.data?.['type'], title);

      // Page focus me ho to browser khud OS notification NAHI dikhata (FCM SDK
      // message page ko de deta hai). User ko wahi popup chahiye, isliye hum
      // service worker registration se khud dikhate hain — har haal me.
      this.showNative(title, body, url, payload.data?.['tag']);
    });
  }

  /** OS-level notification (service worker ke through) — fallback: snackbar */
  private async showNative(title: string, body: string, url: string, tag?: string): Promise<void> {
    try {
      const reg = this.swRegistration ?? (await this.getRegistration());
      await reg.showNotification(title, {
        body,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: tag || undefined,
        data: { url },
      });
    } catch (e) {
      console.warn('[push] showNotification failed, falling back to snackbar:', (e as any)?.message ?? e);
      this.snackbar.info(body ? `${title} — ${body}` : title);
    }
  }

  private safeGet(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  private safeSet(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* ignore */
    }
  }
  private safeRemove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
