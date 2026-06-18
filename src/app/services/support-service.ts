import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';

export interface TicketPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
  category?: string;
  phone?: string;
}

@Injectable({ providedIn: 'root' })
export class SupportService {
  private readonly baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  createTicket(payload: TicketPayload): Observable<any> {
    return this.http.post(`${this.baseUrl}/createTicket`, payload);
  }
}
