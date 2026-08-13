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
}
