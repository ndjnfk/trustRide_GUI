import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthHelper } from '../helpers/auth-helper';
import { AdminSessionHelper } from '../helpers/admin-session-helper';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private router: Router) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const isAdminRequest = req.url.includes('/admin/');

    // ── Attach the right token ──
    // Admin requests already set their own Authorization header via
    // AdminSessionHelper. For normal user requests, attach the user token.
    let outgoing = req;
    if (!isAdminRequest) {
      const token = AuthHelper.getToken();
      if (token) {
        outgoing = req.clone({ setHeaders: AuthHelper.getAuthHeader() });
      }
    }

    return next.handle(outgoing).pipe(
      catchError((error: HttpErrorResponse) => {
        // 401 = expired / invalid token. 0 = browser blocked the response
        // (an expired-token 401 without CORS headers shows up as status 0).
        const sessionExpired = error.status === 401 || error.status === 0;

        // Don't redirect-loop on the login/logout calls themselves.
        const isAuthEndpoint =
          req.url.includes('/login') || req.url.includes('/logout');

        if (sessionExpired && !isAuthEndpoint) {
          this.handleSessionExpired(isAdminRequest);
        }

        return throwError(() => error);
      })
    );
  }

  // ── Clear the session and bounce to the correct login page ──
  private handleSessionExpired(isAdminRequest: boolean): void {
    if (isAdminRequest) {
      // Already on the admin login page? Nothing to do.
      if (this.router.url.startsWith('/admin/login')) return;
      AdminSessionHelper.clearAdminToken();
      this.router.navigate(['/admin/login'], {
        queryParams: { sessionExpired: '1' }
      });
    } else {
      if (this.router.url.startsWith('/login')) return;
      AuthHelper.logout();
      this.router.navigate(['/login'], {
        queryParams: { sessionExpired: '1' }
      });
    }
  }
}
