import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';

export interface BlablaRide {
  ride_id: string;
  source: string;
  destination: string;
  ride_date: string;      // YYYY-MM-DD
  ride_time: string;      // HH:mm (24h)
  departure_time: string;
  url: string;
  rider_name: string;
  created_at?: string;
}

export interface BlablaRidesResponse {
  success: boolean;
  total: number;
  rides: BlablaRide[];
}

/**
 * User panel ke form se jaane wali ride.
 * Date/time plain strings hi rehti hain — jo user ne bhara wahi store hota hai.
 */
export interface CreateBlablaRidePayload {
  source: string;
  destination: string;
  ride_date: string;      // YYYY-MM-DD
  ride_time: string;      // HH:mm (24h)
  url: string;
  rider_name: string;
  user_email: string;     // registered + admin-verified hona chahiye
}

/**
 * Live email check ka jawab. HTTP hamesha 200 aata hai — "email nahi mila"
 * bhi ek valid jawab hai, error nahi.
 */
export interface BlablaEmailCheck {
  success: boolean;
  exists: boolean;
  verified: boolean;
  verification_status?: string;
  error_code?: 'INVALID_EMAIL' | 'EMAIL_NOT_REGISTERED' | 'USER_NOT_VERIFIED' | 'VERIFICATION_REJECTED';
  message: string;
}

/**
 * BlaBlaCar rides the admin has curated by hand.
 *
 * Public on purpose — koi token nahi bhejte, user panel ko ye rides bina
 * login ke dikhni hain.
 */
@Injectable({
  providedIn: 'root',
})
export class BlablaRideService {

  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getBlablaRides(filters: { from?: string; to?: string; date?: string } = {}): Observable<BlablaRidesResponse> {
    const params: Record<string, string> = {};
    if (filters.from) params['from'] = filters.from;
    if (filters.to) params['to'] = filters.to;
    if (filters.date) params['date'] = filters.date;

    return this.http.get<BlablaRidesResponse>(`${this.baseUrl}/blabla-rides`, { params });
  }

  /**
   * Ride publish karo. Backend email ko `users` me dhoondhta hai aur
   * verification check karta hai — fail hone par 404/403 aata hai.
   */
  createBlablaRide(payload: CreateBlablaRidePayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/blabla-rides`, payload);
  }

  /**
   * Email registered + admin-verified hai ya nahi — form me type karte hi
   * call hota hai, taaki user ko submit tak intezaar na karna pade.
   */
  checkBlablaEmail(email: string): Observable<BlablaEmailCheck> {
    return this.http.get<BlablaEmailCheck>(`${this.baseUrl}/blabla-rides/check-email`, {
      params: { email },
    });
  }
}
