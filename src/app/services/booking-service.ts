import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';
export interface BookSeatResponse {
  success: boolean;
  message: string;
  booking: {
    booking_id: string;
    ride_id: string;
    gender: string;
    status: string;
  };
  ride_status: {
    male: number;
    female: number;
    total: number;
    remaining_seats: number;
  };
}


@Injectable({
  providedIn: 'root',
})
export class BookingService {
   // private readonly baseUrl = 'http://localhost:3333';
   private readonly baseUrl = environment.apiUrl;
  //  private readonly baseUrl = 'http://34.207.242.45:3333';

  constructor(private http: HttpClient) {}

 bookSeat(rideId: string, males: number, females: number,isSameFamily: boolean): Observable<BookSeatResponse> {
  return this.http.post<BookSeatResponse>(
    `${this.baseUrl}/bookSeat`,
    { 
      ride_id: rideId,
      males: males,
      females: females,
       is_same_family: isSameFamily

    }
  );
}
  updateBookingStatus(booking_id: string, status: string,reason: string = ''): Observable<any> {
  return this.http.put(`${this.baseUrl}/bookStatus`, { booking_id, status,cancellation_reason: reason  });
}

submitReview(rideId: string, rating: number, comment: string): Observable<{
  success: boolean;
  message: string;
  review_id: string;
}> {
  const payload = {
    ride_id: rideId,   // MongoDB ObjectId string
    rating,            // number: 1 to 5
    comment,           // string (optional but sent)
  };
  // return this.http.post<any>('http://localhost:3333/createReview', payload);
  return this.http.post<any>(`${this.baseUrl}/createReview`, payload);
  // return this.http.post<any>('http://34.207.242.45:3333/createReview', payload);
}
}
