import { Injectable, signal } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';

/**
 * App mode — backend har authenticated response me `x-render-profile` header bhejta hai
 * (Auth middleware): 'std' (normal) ya 'cmp' (limited). Naam neutral hain, jaan-bujh kar.
 *
 * 'cmp' = admin ne is user ko lock kiya hai. User ko ye kabhi nahi batana —
 * bas `body.rp-cmp` class lagti hai (App component) aur styles.css page ke
 * sab action buttons ko click par unresponsive kar deta hai (dikhne me normal). Backend asli rok hai;
 * ye sirf dikhawa hai taaki "app me dikkat hai" jaisa lage.
 *
 * Header na ho (public route) to kuch nahi badalta — flicker nahi hota.
 */
@Injectable({ providedIn: 'root' })
export class AppModeService {
  // Naam jaan-bujh kar neutral — DevTools/bundle me 'lock' ya 'limited' jaisa kuch na dikhe
  static readonly HEADER = 'x-render-profile';
  static readonly BODY_CLASS = 'rp-cmp';

  readonly limited = signal(false);

  applyFromHeaders(headers: HttpHeaders | null | undefined): void {
    const value = headers?.get(AppModeService.HEADER);
    if (!value) return;
    const next = value.toLowerCase() === 'cmp';
    if (this.limited() !== next) this.limited.set(next);
  }

  reset(): void {
    if (this.limited()) this.limited.set(false);
  }
}
