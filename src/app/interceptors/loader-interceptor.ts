import { Injectable, inject } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { LoaderServices } from '../services/loader-services';

export const SKIP_LOADER_HEADER = 'X-Skip-Loader';

@Injectable()
export class LoaderInterceptor implements HttpInterceptor {
  private loader = inject(LoaderServices);

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (req.headers.has(SKIP_LOADER_HEADER)) {
      const cleaned = req.clone({ headers: req.headers.delete(SKIP_LOADER_HEADER) });
      return next.handle(cleaned);
    }

    this.loader.show();
    return next.handle(req).pipe(
      finalize(() => this.loader.hide())
    );
  }
}
