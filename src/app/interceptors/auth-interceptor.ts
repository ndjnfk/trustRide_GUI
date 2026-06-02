import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { AuthHelper } from '../helpers/auth-helper';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    console.log('INTERCEPTOR HIT', req.url);

    const token = AuthHelper.getToken()

    if (token) {

      const clonedReq = req.clone({
        setHeaders: AuthHelper.getAuthHeader()
      })
       return next.handle(clonedReq);
    }

    return next.handle(req);
  }
}


