import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse,
  HttpResponse
} from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { AuthHelper } from '../helpers/auth-helper';
import { AdminSessionHelper } from '../helpers/admin-session-helper';
import { AppModeService } from '../services/app-mode';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  constructor(private router: Router, private appMode: AppModeService) {}

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
      // Backend har authenticated user response me `x-render-profile` header deta hai
      // (std / cmp). Yahin se pata chalta hai ki is user ke action buttons
      // chalne hain ya nahi — admin panel ke requests isme nahi aate.
      tap(event => {
        if (!isAdminRequest && event instanceof HttpResponse) {
          this.appMode.applyFromHeaders(event.headers);
        }
      }),
      catchError((error: HttpErrorResponse) => {
        // Blocked write (503) bhi yahi header leke aata hai — mode turant update.
        if (!isAdminRequest && error.status !== 0) {
          this.appMode.applyFromHeaders(error.headers);
        }

        // 401 = expired / invalid token. 0 = browser blocked the response
        // (an expired-token 401 without CORS headers shows up as status 0).
        const sessionExpired = error.status === 401 || error.status === 0;

        // Don't redirect-loop on the login/logout calls themselves.
        const isAuthEndpoint =
          req.url.includes('/login') || req.url.includes('/logout');

        // Ride click counter background me chalta hai aur guest ke liye bhi —
        // uske fail hone par kisi ko logout nahi karna chahiye.
        // (admin ka /admin/ride-clicks isme nahi aata — wahan 401 par logout sahi hai)
        // Live tracking: driver ka GPS signal/network jaate hi status 0 aata hai —
        // us par logout nahi. Parents ka /track/ link bina login ka hai.
        const isTrackingCall =
          /\/rides\/[^/]+\/(location|tracking)/.test(req.url) && error.status === 0;
        const isBestEffort = !isAdminRequest && (
          req.url.includes('/ride-clicks') || req.url.includes('/track/') || isTrackingCall
        );

        if (sessionExpired && !isAuthEndpoint && !isBestEffort) {
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
      this.appMode.reset();
      this.router.navigate(['/login'], {
        queryParams: { sessionExpired: '1' }
      });
    }
  }
}
