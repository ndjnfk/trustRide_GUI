import { Injectable } from '@angular/core';
import { environment } from '../../../environment';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, Observable, tap, throwError } from 'rxjs';
import { AdminSessionHelper } from '../helpers/admin-session-helper';
import { AuthHelper } from '../helpers/auth-helper';

export interface AdminLoginPayload {
  email: string;
  password: string;
}
 
export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}
 
export interface AdminLoginResponse {
  success: boolean;
  message: string;
  data: {
    token: string;
    user: AdminUser;
  };
}
export interface ProfessionalVerification {
  _id: string;
  company_name: string;
  job_title: string;
  work_email: string;
  linkedin_url: string;
  id_card_url: string;
  verification_status: string;
}
 
export interface User {
  _id: string;
  fullName: string;
  gender: string;
  userEmail: string;
  phoneNumber: string;
  userCode: number;
  status: string;
  role?: string;
  companyName:string,
  companyEmail:string,
  verificationStatus: string;
  professionalVerification: ProfessionalVerification | null;
  created_at?: string;
}
 
export interface AllUsersResponse {
  success: boolean;
  total: number;
  data: User[];
}
 
export interface UpdateVerificationRequest {
  user_id: string;
  verification_status: 'verified' | 'pending' | 'rejected';
}
 
export interface UpdateVerificationResponse {
  success: boolean;
  message: string;
  data: {
    userUpdated: boolean;
    verificationUpdated: boolean;
  };
}

export interface UpdateUserRoleRequest {
  user_id: string;
  role: 'rider' | 'passenger' | 'both' | 'admin';
}

export interface UpdateUserRoleResponse {
  success: boolean;
  message: string;
}

export interface BounceCheckResponse {
  success: boolean;
  message: string;
  details: {
    format: boolean;
    mx: boolean;
    smtp: boolean;
    bounce_checked: boolean;
  };
}

// A BlaBla ride as the admin fills it in — date/time stay as plain strings so
// the value the admin typed is the value that gets stored (no timezone shift).
export interface BlablaRidePayload {
  source: string;
  destination: string;
  ride_date: string;   // YYYY-MM-DD
  ride_time: string;   // HH:mm (24h)
  url: string;
  rider_name: string;
}

// A pharmacy card on the public "Medical Emergency" page. Admin ise haath se
// bharta hai — card par sirf naam, WhatsApp number aur address dikhta hai.
export interface MedicalEmergencyPayload {
  shop_name: string;
  city: string;              // base city — MEDICAL_EMERGENCY_CITIES me se ek
  whatsapp_number: string;   // 10-digit Indian mobile
  address: string;
  open_time?: string;        // HH:mm (24h), '' = timing hata do
  close_time?: string;       // HH:mm (24h)
  is_active?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class Adminservice {


private readonly API_URL = environment.apiUrl; 
  private readonly TOKEN_KEY = 'admin_token';
  private readonly USER_KEY = 'admin_user';
 
  constructor(private http: HttpClient, private router: Router) {}
 
  login(payload: AdminLoginPayload): Observable<AdminLoginResponse> {
    return this.http
      .post<AdminLoginResponse>(`${this.API_URL}/admin/login`, payload)
      .pipe(
        tap((res) => {
          if (res.success) {
            
             AdminSessionHelper.setAdminToken(res.data.token)
          }
        }),
        catchError(this.handleError)
      );
  }
 
  logout(): Observable<any> {
  const token = AdminSessionHelper.getAdminToken();

  return this.http.post(`${this.API_URL}/admin/logout`, {}, {
    headers: { Authorization: `Bearer ${token}` }
  }).pipe(
    tap(() => {
      AdminSessionHelper.clearAdminToken();
      this.router.navigate(['/admin/login']);
    }),
    catchError((err) => {
      AdminSessionHelper.clearAdminToken();
      this.router.navigate(['/admin/login']);
      return throwError(() => err);
    })
  );
}
 
  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }
 
  getUser(): AdminUser | null {
    const user = localStorage.getItem(this.USER_KEY);
    return user ? JSON.parse(user) : null;
  }
 
  isLoggedIn(): boolean {
    const token = this.getToken();
    const user = this.getUser();
    return !!token && !!user && user.role === 'admin';
  }
 
  private handleError(error: HttpErrorResponse): Observable<never> {
    let errorMessage = 'Kuch galat ho gaya. Dobara try karein.';
 
   if (error.status === 0) {
  errorMessage = 'Unable to connect to the server. Please check your network.';
} else if (error.status === 401) {
  errorMessage = error.error?.error || 'Invalid email or password.';
} else if (error.status === 403) {
  errorMessage = 'Admin access is not allowed.';
} else if (error.status === 422) {
  errorMessage = 'Invalid input. Please check and try again.';
} else if (error.status >= 500) {
  errorMessage = 'Server error occurred. Please try again later.';
} else if (error.error?.message) {
  errorMessage = error.error.message;
} else if (error.error?.error) {
  errorMessage = error.error.error;
}
 
    return throwError(() => new Error(errorMessage));
  }

   getAllUsers(): Observable<AllUsersResponse> {
    return this.http.get<AllUsersResponse>(`${this.API_URL}/admin/allUsers`, {
      headers: AdminSessionHelper.getAuthHeaders()
    });
  }
 
  // All ratings/reviews RECEIVED by a particular user (with giver name)
  getUserReviews(userId: string): Observable<any> {
    return this.http.get(`${this.API_URL}/admin/userReviews/${userId}`, {
      headers: AdminSessionHelper.getAuthHeaders()
    });
  }

  updateVerificationStatus(payload: UpdateVerificationRequest): Observable<UpdateVerificationResponse> {
    return this.http.put<UpdateVerificationResponse>(
      `${this.API_URL}/admin/update-verification-status`,
      payload,
      { headers: AdminSessionHelper.getAuthHeaders()}
    );
  }
 
  // Admin: change any user's role (rider / passenger / both / admin)
  updateUserRole(payload: UpdateUserRoleRequest): Observable<UpdateUserRoleResponse> {
    return this.http.put<UpdateUserRoleResponse>(
      `${this.API_URL}/admin/update-user-role`,
      payload,
      { headers: AdminSessionHelper.getAuthHeaders() }
    );
  }

  downloadIdCard(idCardUrl: string): void {
    const fullUrl = `${this.API_URL}${idCardUrl}`;
    const link = document.createElement('a');
    link.href = fullUrl;
    link.target = '_blank';
    link.download = idCardUrl.split('/').pop() || 'id_card.png';
    link.click();
  }
  getAllRides(): Observable<any> {
    return this.http.get(`${this.API_URL}/admin/getAllRides`, {
      headers: AdminSessionHelper.getAuthHeaders()
    })
  }
  deleteRide(ride_id: string): Observable<any> {
  return this.http.delete(`${this.API_URL}/admin/deleteRide`, {
    headers: AdminSessionHelper.getAuthHeaders(),
    body: { ride_id }
  })
}

  // Admin: update any field of a ride
  updateRide(payload: {
    ride_id: string;
    from?: string;
    to?: string;
    departure_time?: string;   // fake-UTC ISO: `${date}T${time}:00.000Z`
    available_seats?: number;
    price_per_seat?: number;
    route_via?: string;
    status?: string;
    cancellation_reason?: string;
    additional_notes?: string;
  }): Observable<any> {
    return this.http.put(`${this.API_URL}/admin/updateRide`, payload, {
      headers: AdminSessionHelper.getAuthHeaders()
    })
  }


clearRedisData(): Observable<any> {
  return this.http.delete(`${this.API_URL}/admin/clearRedisData`, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

clearMongoData(): Observable<any> {
  return this.http.delete(`${this.API_URL}/admin/clearMongoData`, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

  deleteUser(user_id: string): Observable<any> {
  return this.http.delete(`${this.API_URL}/admin/deleteUser`, {
    headers: AdminSessionHelper.getAuthHeaders(),
    body: { user_id }
  })
}

checkBounceEmail(email: string): Observable<BounceCheckResponse> {
  return this.http.post<BounceCheckResponse>(
    `${this.API_URL}/bounceCheck`,
    { email },
    { headers: AdminSessionHelper.getAuthHeaders() }
  );
}

// ── Reset a user's password + security question (admin) ───────
resetUserSecurity(payload: {
  userEmail: string;
  newPassword: string;
  newSecurityAns: string;
  securityQuesId: number;
}): Observable<{ message: string; status: boolean }> {
  return this.http.post<{ message: string; status: boolean }>(
    `${this.API_URL}/admin/reset-security`,
    payload,
    { headers: AdminSessionHelper.getAuthHeaders() }
  );
}

// ── BlaBlaCar rides (hand-curated, separate collection) ───
getBlablaRides(): Observable<any> {
  return this.http.get(`${this.API_URL}/admin/blabla-rides`, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

createBlablaRide(payload: BlablaRidePayload): Observable<any> {
  return this.http.post(`${this.API_URL}/admin/blabla-rides`, payload, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

updateBlablaRide(id: string, payload: Partial<BlablaRidePayload>): Observable<any> {
  return this.http.put(`${this.API_URL}/admin/blabla-rides/${id}`, payload, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

deleteBlablaRide(id: string): Observable<any> {
  return this.http.delete(`${this.API_URL}/admin/blabla-rides/${id}`, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

// Bulk delete — DELETE ke saath body bhejna reliable nahi hai, isliye POST.
bulkDeleteBlablaRides(ids: string[]): Observable<any> {
  return this.http.post(`${this.API_URL}/admin/blabla-rides/bulk-delete`, { ids }, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

// ── Medical Emergency (pharmacy cards) ────────────────────
getMedicalEmergencyPharmacies(): Observable<any> {
  return this.http.get(`${this.API_URL}/admin/medical-emergency`, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

createMedicalEmergencyPharmacy(payload: MedicalEmergencyPayload): Observable<any> {
  return this.http.post(`${this.API_URL}/admin/medical-emergency`, payload, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

updateMedicalEmergencyPharmacy(id: string, payload: Partial<MedicalEmergencyPayload>): Observable<any> {
  return this.http.put(`${this.API_URL}/admin/medical-emergency/${id}`, payload, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

deleteMedicalEmergencyPharmacy(id: string): Observable<any> {
  return this.http.delete(`${this.API_URL}/admin/medical-emergency/${id}`, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

// ── Categories ────────────────────────────────────────────
getCategories(): Observable<any> {
  return this.http.get(`${this.API_URL}/admin/categories`, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

// Multipart so an optional category image can be uploaded.
createCategory(category_name: string, image?: File | null): Observable<any> {
  const fd = new FormData();
  fd.append('category_name', category_name);
  if (image) fd.append('image', image, image.name);
  return this.http.post(`${this.API_URL}/admin/categories`, fd, {
    headers: this.authOnlyHeader()
  });
}

updateCategory(id: string, category_name: string, image?: File | null): Observable<any> {
  const fd = new FormData();
  fd.append('category_name', category_name);
  if (image) fd.append('image', image, image.name);
  return this.http.put(`${this.API_URL}/admin/categories/${id}`, fd, {
    headers: this.authOnlyHeader()
  });
}

deleteCategory(id: string): Observable<any> {
  return this.http.delete(`${this.API_URL}/admin/categories/${id}`, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

// ── Products ──────────────────────────────────────────────
getProducts(params: Record<string, any> = {}): Observable<any> {
  // Drop empty values so we don't send blank query params
  const query: Record<string, string> = {};
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value !== '' && value !== null && value !== undefined) {
      query[key] = String(value);
    }
  });
  return this.http.get(`${this.API_URL}/admin/products`, {
    headers: AdminSessionHelper.getAuthHeaders(),
    params: query
  });
}

// payload is FormData (multipart) so images can be uploaded as files.
// Note: no Content-Type header — the browser sets the multipart boundary.
createProduct(payload: FormData): Observable<any> {
  return this.http.post(`${this.API_URL}/admin/products`, payload, {
    headers: this.authOnlyHeader()
  });
}

updateProduct(id: string, payload: FormData): Observable<any> {
  return this.http.put(`${this.API_URL}/admin/products/${id}`, payload, {
    headers: this.authOnlyHeader()
  });
}

private authOnlyHeader(): { [header: string]: string } {
  const token = typeof window !== 'undefined'
    ? (localStorage.getItem('admin_token') || '')
    : '';
  return { Authorization: `Bearer ${token}` };
}

deleteProduct(id: string): Observable<any> {
  return this.http.delete(`${this.API_URL}/admin/products/${id}`, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

// ── Orders ────────────────────────────────────────────────
getOrders(params: Record<string, any> = {}): Observable<any> {
  const query: Record<string, string> = {};
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value !== '' && value !== null && value !== undefined) {
      query[key] = String(value);
    }
  });
  return this.http.get(`${this.API_URL}/admin/orders`, {
    headers: AdminSessionHelper.getAuthHeaders(),
    params: query
  });
}

updateOrderStatus(id: string, status: string): Observable<any> {
  return this.http.put(`${this.API_URL}/admin/orders/${id}/status`, { status }, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

deleteOrder(id: string): Observable<any> {
  return this.http.delete(`${this.API_URL}/admin/orders/${id}`, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

clearOrders(): Observable<any> {
  return this.http.delete(`${this.API_URL}/admin/orders`, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

// ── Prescriptions (Medical Store) ─────────────────────────
getPrescriptions(params: Record<string, any> = {}): Observable<any> {
  const query: Record<string, string> = {};
  Object.keys(params).forEach((key) => {
    const value = params[key];
    if (value !== '' && value !== null && value !== undefined) {
      query[key] = String(value);
    }
  });
  return this.http.get(`${this.API_URL}/admin/prescriptions`, {
    headers: AdminSessionHelper.getAuthHeaders(),
    params: query
  });
}

updatePrescriptionStatus(id: string, status: string): Observable<any> {
  return this.http.put(`${this.API_URL}/admin/prescriptions/${id}/status`, { status }, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}

deletePrescription(id: string): Observable<any> {
  return this.http.delete(`${this.API_URL}/admin/prescriptions/${id}`, {
    headers: AdminSessionHelper.getAuthHeaders()
  });
}
}
