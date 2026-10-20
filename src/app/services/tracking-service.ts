import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { environment } from '../../../environment';
import { AuthHelper } from '../helpers/auth-helper';
import { SKIP_LOADER_HEADER } from '../interceptors/loader-interceptor';

export interface TrackPoint {
  lat: number;
  lng: number;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  ts: number;
}

/** Location share karne wala — driver ya passenger (sab ek hi gaadi me) */
export interface Sharer {
  user_id: string;
  role: 'driver' | 'passenger';
  name: string;
}

export interface SharerLocation extends Sharer, TrackPoint {}

export interface TrackingInfo {
  success: boolean;
  role: 'driver' | 'passenger' | 'admin' | 'guest';
  /** koi bhi share kar raha hai */
  active: boolean;
  sharers: Sharer[];
  locations: SharerLocation[];
  /** main khud share kar raha hoon (server ke hisaab se) */
  me_sharing: boolean;
  ride: {
    ride_id: string;
    status: string;
    from: string;
    to: string;
    departure_time: string;
    driver_name: string;
    vehicle: { model: string; color: string; plate_number: string } | null;
  };
}

export type TrackingEvent =
  | { type: 'location'; point: SharerLocation }
  /** user_id ho to us ek user ne start/stop kiya; ended = ride complete/cancel */
  | { type: 'status'; user_id?: string; role?: Sharer['role']; name?: string; active: boolean; ended?: boolean };

/** GPS points kitni der me bhejne hain — beech ke points chhod do, ruke ho to bhi heartbeat */
const SEND_EVERY_MS = 5000;
const HEARTBEAT_MS = 10000;
/** App band hone ke baad dobara khule to kis ride ki sharing wapas chalu karni hai */
const RESUME_KEY = 'live_tracking_ride';

/**
 * Live ride tracking.
 *  - Sharer (driver ya passenger): GPS watch → REST `/rides/:id/location` (har 5–10 sec)
 *  - Dekhne wale (sab, parents bhi): socket `ride:<id>` room se `location:update`
 *  Driver ka phone band ho to passenger ke phone se gaadi dikhti rehti hai.
 *
 * GPS sirf app/page khula ho tab tak chalta hai (foreground). Isliye tracking ke
 * dauraan screen jalti rakhte hain (wake lock). App band hokar dobara khule to
 * resumeIfNeeded() sharing wapas chalu karta hai (ride abhi active ho tabhi).
 */
@Injectable({ providedIn: 'root' })
export class TrackingService {
  private readonly api = environment.apiUrl;

  private socket?: Socket;
  private events$ = new Subject<TrackingEvent>();

  private watchId: string | null = null;
  private heartbeat?: ReturnType<typeof setInterval>;
  private lastPoint: Omit<TrackPoint, 'ts'> | null = null;
  private lastSentAt = 0;
  private sharingRideId: string | null = null;
  /**
   * Sharing jis account se shuru hui uska token — localStorage sab tabs me ek hai,
   * doosre tab me koi aur login kare to bhi location galat naam se na jaaye.
   */
  private sharingToken: string | null = null;
  private wakeLock: any = null;
  /** driver side — har bheje gaye point / galti ki khabar */
  readonly sent$ = new Subject<{ ok: boolean; point?: TrackPoint; stopped?: boolean; error?: string }>();
  /** abhi kis ride ki location share ho rahi hai (null = koi nahi) — page auto-resume par update ho */
  readonly sharingRide$ = new BehaviorSubject<string | null>(null);

  constructor(private http: HttpClient, private zone: NgZone) {
    if (typeof document === 'undefined') return;
    // app wapas saamne aaye — screen lock (wake lock) dobara lo aur turant point bhejo
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible' || !this.sharingRideId) return;
      this.keepScreenOn();
      if (this.lastPoint) this.send();
    });
  }

  private headers(token: string | null = AuthHelper.getToken()) {
    return {
      Authorization: `Bearer ${token ?? ''}`,
      [SKIP_LOADER_HEADER]: 'true',
    };
  }

  // ── REST ──
  getTracking(rideId: string): Observable<TrackingInfo> {
    return this.http.get<TrackingInfo>(`${this.api}/rides/${rideId}/tracking`, { headers: this.headers() });
  }
  getPublicTracking(token: string): Observable<TrackingInfo> {
    return this.http.get<TrackingInfo>(`${this.api}/track/${encodeURIComponent(token)}`, {
      headers: { [SKIP_LOADER_HEADER]: 'true' },
    });
  }
  createShareLink(rideId: string): Observable<{ success: boolean; token: string; expires_in: number }> {
    return this.http.post<any>(`${this.api}/rides/${rideId}/tracking/share`, {}, { headers: this.headers() });
  }

  /**
   * Parents ka link — jo website abhi khuli hai usi ka page (document.baseURI me
   * /new-design/ jaisa base-href bhi aata hai). apiUrl se nahi: local par API alag
   * port (3333) par hai, wahan /track/<token> JSON deta hai, page nahi.
   * Native app (Capacitor) ka origin https://localhost hota hai — wahan apiUrl ki website.
   */
  shareUrl(token: string): string {
    if (Capacitor.isNativePlatform()) {
      const url = new URL(this.api, window.location.origin);
      const base = url.pathname.replace(/\/+$/, '').replace(/\/api$/, '');
      return `${url.origin}${base}/track/${token}`;
    }
    return new URL(`track/${token}`, document.baseURI).href;
  }

  // ── Watcher (passenger / parent) ──
  /** `ride:<id>` room se live events. Login wale ke liye rideId, parent ke liye trackToken. */
  watch(opts: { rideId?: string; trackToken?: string }): Observable<TrackingEvent> {
    this.unwatch();
    const auth = opts.trackToken ? { trackToken: opts.trackToken } : { token: AuthHelper.getToken() ?? '' };

    // socket zone ke bahar — warna polling timers Angular ko "busy" rakhte hain (ChatService jaisa)
    this.zone.runOutsideAngular(() => {
      const url = new URL(this.api, window.location.origin);
      const base = url.pathname.replace(/\/+$/, '').replace(/\/api$/, '');
      const socket = io(url.origin, {
        path: `${base}/socket.io/`,
        auth,
        transports: ['websocket', 'polling'],
        reconnection: true,
      });
      this.socket = socket;

      // reconnect ke baad room dobara join (share-token wala server khud join karata hai)
      socket.on('connect', () => {
        if (opts.rideId) socket.emit('ride:join', opts.rideId);
      });
      socket.on('location:update', (p: SharerLocation) =>
        this.zone.run(() => this.events$.next({ type: 'location', point: p }))
      );
      socket.on('tracking:status', (s: any) =>
        this.zone.run(() =>
          this.events$.next({
            type: 'status',
            user_id: s?.user_id,
            role: s?.role,
            name: s?.name,
            active: !!s?.active,
            ended: !!s?.ended,
          })
        )
      );
    });
    return this.events$.asObservable();
  }

  unwatch(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = undefined;
  }

  // ── Sharer (driver / passenger) ──
  isSharing(rideId: string): boolean {
    return this.sharingRideId === rideId;
  }

  /** GPS permission lo, tracking start karo, aur points bhejna shuru */
  async startSharing(rideId: string): Promise<void> {
    if (this.sharingRideId === rideId) return;
    await this.stopWatchOnly();

    const perm = await Geolocation.checkPermissions().catch(() => null);
    if (perm && perm.location !== 'granted') {
      const req = await Geolocation.requestPermissions().catch(() => null);
      if (req && req.location !== 'granted') {
        throw new Error('Location permission denied. Please allow location access to share your ride.');
      }
    }

    const token = AuthHelper.getToken();
    await new Promise<void>((resolve, reject) =>
      this.http.post(`${this.api}/rides/${rideId}/tracking/start`, {}, { headers: this.headers(token) })
        .subscribe({ next: () => resolve(), error: (e) => reject(new Error(e?.error?.message || 'Could not start live tracking')) })
    );

    this.sharingRideId = rideId;
    this.sharingToken = token;
    this.lastPoint = null;
    this.lastSentAt = 0;

    await this.startWatch();
    this.sharingRide$.next(rideId);
    this.remember(rideId);

    // gaadi ruki ho to watch fire nahi hota — last point dobara bhejo taaki "signal lost" na dikhe
    this.heartbeat = setInterval(() => {
      if (this.lastPoint && Date.now() - this.lastSentAt >= HEARTBEAT_MS) this.send();
    }, 2000);

    this.keepScreenOn();
  }

  private async startWatch(): Promise<void> {
    this.watchId = await Geolocation.watchPosition(
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 },
      (pos, err) => {
        if (err || !pos) {
          this.zone.run(() => this.sent$.next({ ok: false, error: err?.message || 'GPS signal not available' }));
          return;
        }
        this.onPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? null,
          heading: pos.coords.heading ?? null,
          speed: pos.coords.speed ?? null,
        });
      }
    );
  }

  private onPosition(p: Omit<TrackPoint, 'ts'>): void {
    this.lastPoint = p;
    if (Date.now() - this.lastSentAt >= SEND_EVERY_MS) this.send();
  }

  /**
   * App khulte hi (App root se) — pichli baar sharing chal rahi thi aur app band ho
   * gayi, to wapas chalu karo. Ride complete/cancel, sharing band, ya user ride ka
   * hissa nahi (logout/dusra account) — to bhool jao. true = resume hua.
   */
  async resumeIfNeeded(): Promise<boolean> {
    const rideId = this.remembered();
    if (!rideId || this.sharingRideId) return false;
    if (!AuthHelper.getToken()) {
      this.forget();
      return false;
    }

    let info: TrackingInfo;
    try {
      info = await new Promise<TrackingInfo>((resolve, reject) =>
        this.getTracking(rideId).subscribe({ next: resolve, error: reject })
      );
    } catch (e: any) {
      // network nahi hai to yaad rakho — agli baar khulne par try karenge
      if (e?.status !== 0) this.forget();
      return false;
    }
    const canShare = info.role === 'driver' || info.role === 'passenger';
    if (!canShare || !info.me_sharing || info.ride.status !== 'active') {
      this.forget();
      return false;
    }

    try {
      await this.startSharing(rideId);
      return true;
    } catch {
      this.forget();
      return false;
    }
  }

  async stopSharing(rideId: string): Promise<void> {
    // jis account ne share shuru kiya usi ka stop — stopWatchOnly token saaf kar deta hai
    const token = this.sharingToken ?? AuthHelper.getToken();
    this.forget();
    await this.stopWatchOnly();
    await new Promise<void>((resolve) =>
      this.http.post(`${this.api}/rides/${rideId}/tracking/stop`, {}, { headers: this.headers(token) })
        .subscribe({ next: () => resolve(), error: () => resolve() })
    );
  }

  private send(): void {
    const rideId = this.sharingRideId;
    if (!rideId || !this.lastPoint) return;
    this.lastSentAt = Date.now();
    const point = { ...this.lastPoint, ts: this.lastSentAt };
    const url = `${this.api}/rides/${rideId}/location`;

    const done = (status: number, message?: string) => {
      if (status >= 200 && status < 300) {
        this.sent$.next({ ok: true, point });
      } else if (status === 409 || status === 403 || status === 404) {
        // ride complete/cancel ho gayi ya tracking band — GPS bhi band karo
        this.forget();
        this.stopWatchOnly();
        this.sent$.next({ ok: false, stopped: true, error: message || 'Live tracking stopped' });
      } else {
        this.sent$.next({ ok: false, error: 'Network issue — retrying…' });
      }
    };

    this.http.post(url, point, { headers: this.headers(this.sharingToken) }).subscribe({
      next: () => done(200),
      error: (e) => done(e?.status ?? 0, e?.error?.message),
    });
  }

  private async stopWatchOnly(): Promise<void> {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = undefined;
    if (this.watchId) await Geolocation.clearWatch({ id: this.watchId }).catch(() => {});
    this.watchId = null;
    this.sharingRideId = null;
    this.sharingToken = null;
    this.sharingRide$.next(null);
    this.lastPoint = null;
    this.wakeLock?.release?.().catch?.(() => {});
    this.wakeLock = null;
  }

  // localStorage private window / blocked storage me throw kar sakta hai — tab resume bas nahi hoga
  private remember(rideId: string): void {
    try {
      localStorage.setItem(RESUME_KEY, rideId);
    } catch {}
  }
  private forget(): void {
    try {
      localStorage.removeItem(RESUME_KEY);
    } catch {}
  }
  private remembered(): string | null {
    try {
      return localStorage.getItem(RESUME_KEY);
    } catch {
      return null;
    }
  }

  /** GPS sirf foreground me — screen jalti rahe to tracking nahi rukti (jahan support ho) */
  private async keepScreenOn(): Promise<void> {
    try {
      this.wakeLock = await (navigator as any).wakeLock?.request('screen');
    } catch {
      this.wakeLock = null;
    }
  }
}
