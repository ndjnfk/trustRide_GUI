import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';
import { AuthHelper } from '../helpers/auth-helper';

@Injectable({
  providedIn: 'root',
})
export class User {
    // private api = 'http://localhost:3333'
  private api = environment.apiUrl
    // private api = 'http://34.207.242.45:3333'
  constructor(private http: HttpClient) {}

  
  getCurrentUser(): Observable<any> {

    const token = AuthHelper.getToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    return this.http.get(`${this.api}/users/me`, { headers });
  }
}
