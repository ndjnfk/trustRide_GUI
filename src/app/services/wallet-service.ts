import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';
import { AuthHelper } from '../helpers/auth-helper';
import { SKIP_LOADER_HEADER } from '../interceptors/loader-interceptor';

export interface WalletResponse {
  success: boolean;
  /** User par platform ki kitni fee baaki hai (₹) */
  due: number;
}

/** Wallet — user ne platform ki kitni fee use ki / pay karni hai (backend: WalletService). */
@Injectable({ providedIn: 'root' })
export class WalletService {
  private readonly api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getWallet(): Observable<WalletResponse> {
    // Header ka chhota hissa hai — global loader nahi
    return this.http.get<WalletResponse>(`${this.api}/wallet`, {
      headers: { Authorization: `Bearer ${AuthHelper.getToken() ?? ''}`, [SKIP_LOADER_HEADER]: 'true' },
    });
  }
}
