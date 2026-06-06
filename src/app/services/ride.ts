import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs'; // ✅ throwError add kiya
import { AuthService } from './auth';
import { environment } from '../../../environment';
import { AuthHelper } from '../helpers/auth-helper';
import { SKIP_LOADER_HEADER } from '../interceptors/loader-interceptor';
import { Router } from '@angular/router';
export interface RideData {
  ride_id: string;
  driver_id: string;
  driver_name :string;
  from: string;
  to: string;
  departure_time: string;
  available_seats: number;
  price_per_seat: number;
  routeVia?:string;
  status: string;
  
}

export interface RidesResponse {
  success: boolean;
  total: number;
  rides: RideData[];
}

@Injectable({
  providedIn: 'root',
})
export class Ride {

  // private baseUrl = 'http://localhost:3333';
  private baseUrl = environment.apiUrl;
  // private baseUrl = 'http://34.207.242.45:3333';

  constructor(private http: HttpClient,private auth:AuthService,private router:Router) {}

  createRide(payload: any): Observable<any> {
    const token = AuthHelper.getToken();

    // ✅ throw nahi — Observable error return karo
    if (!token) {
      return throwError(() => ({ status: 401, message: 'Please login first' }));
    }

    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });

    return this.http.post(`${this.baseUrl}/createRide`, payload, { headers });
  }

//     getToken(): string | null {
//   if (typeof localStorage === 'undefined') return null;
//   return localStorage.getItem('auth_token');
// }

  getUserRides(): Observable<any> {
  const token = AuthHelper.getToken();
  if (!token) {
    return throwError(() => ({ status: 401 }));
  }
  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  });
  return this.http.get(`${this.baseUrl}/getUserRide`, { headers });
}
deleteRide(rideId: string): Observable<any> {
  const token = AuthHelper.getToken();
  if (!token) return throwError(() => ({ status: 401 }));

  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  });

  return this.http.delete(`${this.baseUrl}/deleteRide`, {
    headers,
    body: { id: rideId }
  });
}

updateRideStatus(rideId: string, status: string,reason: string = ''): Observable<any> {
  const token = AuthHelper.getToken();
  if (!token) return throwError(() => ({ status: 401 }));

  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  });

  return this.http.put(`${this.baseUrl}/updateRideStatus`, {
    id: rideId,
    status,
    ...(reason ? { cancellation_reason: reason } : {})
  }, { headers });
}
  private getHeaders(skipLoader = false): HttpHeaders {
    const token = AuthHelper.getToken();
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`
    };
    if (skipLoader) headers[SKIP_LOADER_HEADER] = 'true';
    return new HttpHeaders(headers);
  }
getAllRides(): Observable<RidesResponse> {
    return this.http.get<RidesResponse>(`${this.baseUrl}/getAllRide`, {
      headers: this.getHeaders()
    });
  }

getBookingsByRideId(ride_id: string): Observable<any> {
  return this.http.post(`${this.baseUrl}/getBookingsByRideId`, { ride_id });
}

 getRides(): Observable<RidesResponse> {
  return this.http.get<RidesResponse>(`${this.baseUrl}/getRides`);
}
// ride.service.ts mein
getFullDetailsByRide(rideId: string) {
  return this.http.post<any>(`${this.baseUrl}/getCompleteDetailsByRidewise`, {
    ride_id: rideId
  });
}
getPendingReviews(): Observable<any> {
  const token = AuthHelper.getToken();
  if (!token) return throwError(() => ({ status: 401 }));

  const headers = new HttpHeaders({
    Authorization: `Bearer ${token}`
  });

  return this.http.get(`${this.baseUrl}/getPendingReviews`, { headers });
}

createReview(payload: {
  rideId: string;
  revieweeId: string;
  comment: string;
  rating: number;
}): Observable<any> {
  const token = AuthHelper.getToken();
  const headers = new HttpHeaders({ Authorization: `Bearer ${token}` });

  return this.http.post(`${this.baseUrl}/createReview`, payload, { headers });
}

getReviewDetails(type: 'received' | 'given') {
  return this.http.post<any[]>(`${this.baseUrl}/reviewsDetails`, { type }, {
    headers: { Authorization: `Bearer ${AuthHelper.getToken()}` }
  });
}

checkPendingReviews() {
  const token = AuthHelper.getToken();
  if (!token) return;

  this.getPendingReviews().subscribe({
    next: (res) => {
      console.log('pending reviews:', res);
      const pending = res.pending_reviews ?? [];

      if (pending.length === 0) {
        console.log('no pending reviews — dashboard allow');
        return; // dashboard khulne do
      }

      const first = pending[0];
      console.log('pending found — role:', first.role, '| ride_id:', first.ride_id);

      // Dono cases ke liye same route — review page handle karega
      this.router.navigate(['/review', first.ride_id]);
    },
    error: (err) => {
      console.error('Pending reviews failed:', err);
      // Error pe dashboard block mat karo
    }
  });
}

getAutogeneratedRides(userId: string): Observable<any> {
  return this.http.get(`${this.baseUrl}/rides/autogenerated`, {
    headers: AuthHelper.getAuthHeader(),   // ✅ Bearer token
    params: { userId },
  })
}

updateAutogeneratedRide(data: any): Observable<any> {
  return this.http.put(`${this.baseUrl}/rides/autogenerated/update`, data, {
    headers: AuthHelper.getAuthHeader(),   // ✅ Bearer token
  })
}

getMatchingTravellers(): Observable<any> {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${AuthHelper.getToken()}`
    });
    return this.http.get(`${environment.apiUrl}/users/matching-travellers`, { headers });
  }
}