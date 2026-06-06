import { Injectable } from '@angular/core'
import { HttpClient, HttpHeaders } from '@angular/common/http'
import { catchError, Observable, tap, throwError } from 'rxjs'

import { Router } from '@angular/router';
import { environment } from '../../../environment';
import { AuthHelper } from '../helpers/auth-helper';
export interface LogoutResponse {
  message: string;
}
export interface VerifyAnsPayload  { email: string; Ans: string; }
export interface VerifyAnsResponse { status: boolean; message: string; resetToken: string; }
 
export interface ResetPasswordPayload  { resetToken: string; newPassword: string; }
export interface ResetPasswordResponse { status: boolean; message: string; }
export interface CurrentUserResponse {
  Id:string,

  Name: string;

  Email: string;

  role:string,

  Phone_Number: string;

  skillName: string | null;

  skillExperience: string | null;
}
@Injectable({
  providedIn: 'root'
})
export class AuthService {

  // private api = 'http://localhost:3333'
  private api = environment.apiUrl
  // private api = 'http://34.207.242.45:3333'

  constructor(private http: HttpClient,
  private router: Router) {
   
  }

  // ── Register ─────────────────────────────
  register(data: any): Observable<any> {
    return this.http.post(`${this.api}/auth/register`, data)
  }

  // ── Verify Email (send verification mail after register) ─────────────────────────────
  verifyEmail(email: string): Observable<any> {
    return this.http.post(`${this.api}/verify-email`, { email })
  }

  // ── Login ────────────────────────────────
  login(data: any): Observable<any> {
    return this.http.post<any>(`${this.api}/auth/login`, data).pipe(
      tap((res) => {
        if (res.token) {
       
          AuthHelper.setToken(res.token)
        }
      })
    )
  }

  // // ── Logout ───────────────────────────────
  logout(): Observable<LogoutResponse> {
    return this.http.get<LogoutResponse>(`${this.api}/auth/logout`).pipe(
      tap(() => {
        AuthHelper.removeToken()
      }),
      catchError(() => {
        // API fail hone par bhi frontend logout karo
        localStorage.removeItem('auth_token');
        return throwError(() => new Error('Logout failed, cleared locally.'));
      })
    );
  }
 

//   getToken(): string | null {
//   if (typeof localStorage === 'undefined') return null;
//   return localStorage.getItem('auth_token');
// }

  //   isLoggedIn(): boolean {
  //   return !!this.getToken();
  // }
  setSecurityQuestion(data: any) {

  return this.http.post(
    `${this.api}/auth/setSecurityQues`,
    data
  )
}
 verifySecurityAnswer(payload: VerifyAnsPayload): Observable<VerifyAnsResponse> {
    return this.http.post<VerifyAnsResponse>(`${this.api}/verifySecurityAns`, payload);
  }
 
  resetPassword(payload: ResetPasswordPayload): Observable<ResetPasswordResponse> {
    return this.http.post<ResetPasswordResponse>(`${this.api}/resetPassword`, payload);
  }



 getCurrentUser(): Observable<CurrentUserResponse> {

    const token = AuthHelper.getToken();

    const headers = new HttpHeaders({

      Authorization: `Bearer ${token}`
    });

    return this.http.get<CurrentUserResponse>(
      `${this.api}/users/me`,
      { headers }
    );
  }
}