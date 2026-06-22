import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';
import { AuthHelper } from '../helpers/auth-helper';

@Injectable({ providedIn: 'root' })
export class ChatbotService {
  private readonly api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /** Ask the assistant. Auth header is sent when logged in (optional). */
  ask(message: string): Observable<any> {
    return this.http.post(
      `${this.api}/chatbot/ask`,
      { message },
      { headers: AuthHelper.getAuthHeader() }
    );
  }
}
