import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../../environment';
import { SKIP_LOADER_HEADER } from '../interceptors/loader-interceptor';
import { DEFAULT_LOCATION_CITIES, LocationCity } from '../helpers/locations';
import { setBaseCities } from '../helpers/route-rules';

/**
 * Poori site ki pickup/drop locations — ek hi jagah se.
 *
 * `GET /locations` sirf visible (admin ne hide nahi kiye) areas bhejta hai.
 * Ek session me ek hi call hoti hai (shareReplay); admin panel me badlaav ke
 * baad `refresh()` cache hata deta hai.
 *
 * API fail ho to default list mil jaati hai — search/publish kabhi khaali
 * dropdown ke saath nahi atakte.
 */
@Injectable({
  providedIn: 'root',
})
export class LocationService {
  private readonly API_URL = environment.apiUrl;
  private cities$?: Observable<LocationCity[]>;

  constructor(private http: HttpClient) {}

  getCities(): Observable<LocationCity[]> {
    if (!this.cities$) {
      this.cities$ = this.http
        .get<{ success: boolean; cities: LocationCity[]; base_cities?: string[] }>(`${this.API_URL}/locations`, {
          // Background data hai — full-screen loader nahi chahiye.
          headers: new HttpHeaders({ [SKIP_LOADER_HEADER]: 'true' }),
        })
        .pipe(
          // Admin wali nayi cities (hidden bhi — purani rides me ho sakti hain)
          // baseCityOf() pehchane — route/price rules unhi par chalte hain
          tap((res) => setBaseCities([
            ...(res?.base_cities ?? []),
            ...(res?.cities ?? []).map((c) => c.key),
          ])),
          map((res) => (Array.isArray(res?.cities) && res.cities.length ? res.cities : DEFAULT_LOCATION_CITIES)),
          catchError(() => {
            // Failed call cache me mat rakho — agli baar dobara try ho.
            this.cities$ = undefined;
            return of(DEFAULT_LOCATION_CITIES);
          }),
          shareReplay(1)
        );
    }
    return this.cities$;
  }

  /** Admin ne list badli — agli getCities() taaza data laayegi. */
  refresh(): void {
    this.cities$ = undefined;
  }
}
