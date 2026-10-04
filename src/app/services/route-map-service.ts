import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';
import { SKIP_LOADER_HEADER } from '../interceptors/loader-interceptor';

export interface MapPoint {
  name: string;
  lat: number;
  lng: number;
  /** true = exact area nahi mila, city ka point dikh raha hai */
  approximate: boolean;
}

export interface RouteOption {
  distance_km: number;
  duration_min: number;
  /** Encoded polyline (precision 5) — decodePolyline() se [lat, lng][] banta hai */
  polyline: string;
  /** Badi sadakon ke naam, jaise "Delhi-Dehradun Expressway, NH709B" (purani rides me nahi) */
  summary?: string;
  /** Raaste par toll plaza (OSM se); 0 = no tolls, null/undefined = pata nahi */
  tolls?: number | null;
}

export interface RideRouteResponse {
  success: boolean;
  message?: string;
  from: MapPoint | null;
  to: MapPoint | null;
  routes: RouteOption[];
  /** true = routes[0] wahi rasta hai jo rider ne publish karte waqt chuna tha */
  chosen?: boolean;
}

/** Admin ke pricing formula se bana price (backend: PricingService) */
export interface PriceQuote {
  distance_km: number;
  duration_min: number;
  approximate: boolean;
  suggested: number;
  min: number;
  max: number;
  step: number;
  breakdown: {
    fuel_litres: number;
    fuel_cost: number;
    fuel_per_seat: number;
    /** TrustRide fee per seat — sirf dikhane ke liye, price me shamil nahi */
    platform_fee: number;
    fuel_price_per_litre: number;
    mileage_kmpl: number;
    cost_sharing_seats: number;
    rider_adjust: number;
    /** Chune raaste ke toll plaza aur unka per-seat hissa (purane backend me nahi) */
    tolls?: number;
    toll_cost?: number;
    toll_per_seat?: number;
    toll_per_plaza?: number;
    toll_sharing_seats?: number;
  };
}

export interface PriceQuoteResponse {
  success: boolean;
  message?: string;
  quote?: PriceQuote;
}

export interface FromHereResponse {
  success: boolean;
  message?: string;
  pickup?: MapPoint;
  route?: RouteOption;
}

/**
 * Ride detail page ka map data. Routing aur caching backend karta hai
 * (OSRM + Redis) — yahan sirf API call.
 */
@Injectable({ providedIn: 'root' })
export class RouteMapService {
  private readonly API_URL = environment.apiUrl;
  // Map page ka side part hai — full-screen loader nahi chahiye
  private readonly headers = new HttpHeaders({ [SKIP_LOADER_HEADER]: 'true' });

  constructor(private http: HttpClient) {}

  /**
   * Publish page: from/to area → distance + suggested price + range.
   * `route` = getRouteOptions() list me chune raaste ka index — price usi ki km
   * aur toll se banta hai (server verify karta hai). Na ho to sabse tez rasta.
   */
  getPriceQuote(from: string, to: string, pick: { route?: number; tolls?: number } = {}): Observable<PriceQuoteResponse> {
    const params: Record<string, string> = { from, to };
    if (pick.route != null && pick.route >= 0) params['route'] = String(pick.route);
    if (pick.tolls) params['tolls'] = String(pick.tolls);
    return this.http.get<PriceQuoteResponse>(`${this.API_URL}/rides/price-quote`, { headers: this.headers, params });
  }

  /** Publish page ka "What is your route?" step — from/to area ke saare raaste. */
  getRouteOptions(from: string, to: string): Observable<RideRouteResponse> {
    return this.http.get<RideRouteResponse>(`${this.API_URL}/rides/route-options`, {
      headers: this.headers,
      params: { from, to },
    });
  }

  getRideRoute(rideId: string): Observable<RideRouteResponse> {
    return this.http.get<RideRouteResponse>(
      `${this.API_URL}/rides/${encodeURIComponent(rideId)}/route`,
      { headers: this.headers }
    );
  }

  getRouteFromHere(rideId: string, lat: number, lng: number): Observable<FromHereResponse> {
    return this.http.get<FromHereResponse>(
      `${this.API_URL}/rides/${encodeURIComponent(rideId)}/route/from-here`,
      { headers: this.headers, params: { lat: String(lat), lng: String(lng) } }
    );
  }
}

/**
 * Pehli baar toll ki ginti peeche ban rahi hoti hai (backend 8s tak rukta hai,
 * phir `tolls: null` bhej deta hai aur cache bharta rehta hai). Naye jawab se
 * wahi raaste (polyline se) ke tolls purane objects me bhar do — map dobara
 * nahi banta. true = abhi bhi kuch baaki hai.
 */
export function mergeTolls(routes: RouteOption[], fresh: RouteOption[]): boolean {
  const byLine = new Map(fresh.map((r) => [r.polyline, r.tolls]));
  for (const r of routes) {
    const t = byLine.get(r.polyline);
    if (r.tolls == null && t != null) r.tolls = t;
  }
  return hasMissingTolls(routes);
}

export function hasMissingTolls(routes: RouteOption[]): boolean {
  return routes.some((r) => r.tolls == null);
}

/** Toll dobara poochhne ka gap aur kitni baar */
export const TOLL_RETRY_MS = 5000;
export const TOLL_RETRIES = 3;

/** Google encoded polyline (precision 5) → [lat, lng][] */
export function decodePolyline(encoded: string): [number, number][] {
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20 && index < encoded.length);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

/** 222 → "3 h 42 min", 45 → "45 min" */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}
