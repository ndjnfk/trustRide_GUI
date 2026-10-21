import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';
import { AdminSessionHelper } from '../helpers/admin-session-helper';
import { SKIP_LOADER_HEADER } from '../interceptors/loader-interceptor';

/*
 * EV charging points (host listings).
 *   Public:  submit form, pricing, city autocomplete, directory list, points along a ride's route
 *   Admin:   verify (approve / reject), fix location, delete, set platform price
 *
 * Price host nahi likhta — admin ek rate set karta hai (per hour / per 30 min),
 * wahi sab points par dikhta hai.
 */

export type EvPriceUnit = 'hour' | '30min';
export type EvStatus = 'pending' | 'approved' | 'rejected';

export interface EvPricing {
  amount: number;
  unit: EvPriceUnit;
  label: string; // '₹100 / hour' | '₹60 / 30 min'
  updated_at?: string | null;
  updated_by?: string | null;
}

export interface EvPoint {
  _id: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  maps_link: string;
  navigate_url: string;
  lat: number | null;
  lng: number | null;
  /** 'exact' = Google link / admin se; 'city' = route par city center se rakha (≈) */
  location_precision: 'exact' | 'city' | null;
  price_label: string | null; // platform price (admin setting)
  // timings (IST) — point sirf is window me dikhta hai
  open_from: string | null;   // 'HH:mm'
  open_to: string | null;     // 'HH:mm'
  open_24h: boolean;
  timing_label: string;       // '8:00 am – 10:00 pm' | 'Open 24 hours'
  notes: string;
  status: EvStatus;
  created_at: string;
  // route mode only
  along_km?: number;
  off_route_m?: number;
  eta_label?: string | null;  // '6:40 pm'
  near_city?: string;         // unpinned point: pickup ya drop city
  // admin only
  rejection_reason?: string | null;
  reviewed_at?: string | null;
  location_detected?: boolean;
  resolved_maps_url?: string | null;
}

export interface EvSubmitPayload {
  name: string;
  phone: string;
  address: string;
  city: string;
  maps_link: string;
  open_from: string;   // 'HH:mm'
  open_to: string;     // 'HH:mm'
  open_24h: boolean;
  notes?: string;
}

export interface EvCitySuggestion {
  name: string;
  state?: string;
  source: 'trustride' | 'listed' | 'osm';
}

export interface EvListResponse {
  success: boolean;
  total: number;
  closed_now?: number;
  checked_at_label?: string;
  pricing?: EvPricing;
  cities: string[];
  points: EvPoint[];
}

export interface EvRouteResponse {
  success: boolean;
  mode: 'route' | 'city';
  message?: string;
  ride: { ride_id: string; from: string; to: string; departure_time: string; distance_km: number | null };
  near_route_km?: number;
  total: number;
  closed_at_travel_time?: number;
  pricing?: EvPricing;
  points: EvPoint[];
  /** approved par exact location (lat/lng) nahi — pickup/drop city me */
  unpinned_points?: EvPoint[];
}

export interface EvAdminListResponse {
  success: boolean;
  counts: { pending: number; approved: number; rejected: number };
  pricing: EvPricing;
  points: EvPoint[];
}

export const EV_PRICE_UNIT_LABELS: Record<EvPriceUnit, string> = {
  hour: 'per hour',
  '30min': 'per 30 min',
};

@Injectable({ providedIn: 'root' })
export class EvPointsService {
  private http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  private get silent(): HttpHeaders {
    return new HttpHeaders({ [SKIP_LOADER_HEADER]: 'true' });
  }

  // ── public ──
  pricing(): Observable<{ success: boolean; pricing: EvPricing }> {
    return this.http.get<any>(`${this.api}/ev-points/pricing`, { headers: this.silent });
  }

  submit(payload: EvSubmitPayload): Observable<{ success: boolean; message: string; location_detected: boolean }> {
    return this.http.post<any>(`${this.api}/ev-points`, payload);
  }

  cities(q: string): Observable<{ success: boolean; cities: EvCitySuggestion[] }> {
    return this.http.get<any>(`${this.api}/ev-points/cities`, { params: { q }, headers: this.silent });
  }

  list(city = ''): Observable<EvListResponse> {
    return this.http.get<EvListResponse>(`${this.api}/ev-points`, { params: city ? { city } : {} });
  }

  alongRide(rideId: string): Observable<EvRouteResponse> {
    return this.http.get<EvRouteResponse>(`${this.api}/ev-points/ride/${rideId}`);
  }

  // ── admin ──
  adminList(status: EvStatus | 'all' = 'pending'): Observable<EvAdminListResponse> {
    return this.http.get<EvAdminListResponse>(`${this.api}/admin/ev-points`, {
      params: { status },
      headers: AdminSessionHelper.getAuthHeaders(),
    });
  }

  adminUpdate(id: string, patch: Partial<EvPoint> & { rejection_reason?: string }): Observable<any> {
    return this.http.put<any>(`${this.api}/admin/ev-points/${id}`, patch, { headers: AdminSessionHelper.getAuthHeaders() });
  }

  adminRelocate(id: string, mapsLink?: string): Observable<{ success: boolean; message: string; lat?: number; lng?: number }> {
    return this.http.post<any>(`${this.api}/admin/ev-points/${id}/relocate`, mapsLink ? { maps_link: mapsLink } : {}, {
      headers: AdminSessionHelper.getAuthHeaders(),
    });
  }

  adminDelete(id: string): Observable<any> {
    return this.http.delete<any>(`${this.api}/admin/ev-points/${id}`, { headers: AdminSessionHelper.getAuthHeaders() });
  }

  adminGetPricing(): Observable<{ success: boolean; data: EvPricing; limits: { amount: { min: number; max: number } } }> {
    return this.http.get<any>(`${this.api}/admin/settings/ev-pricing`, { headers: AdminSessionHelper.getAuthHeaders() });
  }

  adminSetPricing(amount: number, unit: EvPriceUnit): Observable<{ success: boolean; message: string; data: EvPricing }> {
    return this.http.put<any>(`${this.api}/admin/settings/ev-pricing`, { amount, unit }, { headers: AdminSessionHelper.getAuthHeaders() });
  }
}
