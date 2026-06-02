
// app/services/profile.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';
import { AuthHelper } from '../helpers/auth-helper';

export interface UserProfile {
  _id?: string;
  fullName: string;
  gender: string;
  userEmail: string;
  phoneNumber: string;
  userCode?: number;
  status?: string;
  verificationStatus?: string;
  avatarUrl?: string | null;
  created_at?: string;
}

export interface ProfessionalDoc {
  _id?: string;
  company_name: string;
  job_title: string;
  work_email: string;
  id_card_url?: string | null;
  linkedin_url: string;
  verification_status?: string;
}

export interface Vehicle {
  _id?: string;
  vehicle_type: string;
  model: string;
  plate_number: string;
  color: string;
  seat_capacity: number;
}

export interface ProfileResponse {
  success: boolean;
  user: UserProfile;
  professional: ProfessionalDoc | null;
  vehicles: Vehicle[];
}

export interface ProfileData {
  fullName:           string
  gender:             string
  userEmail:          string
  phoneNumber:        string
  userCode:           string | null
  status:             string
  verificationStatus: string
  avatarUrl:          string | null
  created_at:         string | null
  city?:              string
  aboutUser?:         string
  preferences?:       string[]
}

export interface Profileresponse {
  success: boolean
  message: string
  user:    ProfileData
}

export interface UpdateProfileResponse {
  success: boolean
  message: string
  data:    Partial<ProfileData>
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  // private readonly BASE = 'http://localhost:3333';
  private readonly BASE = environment.apiUrl;
  // private readonly BASE = 'http://34.207.242.45:3333';

  constructor(private http: HttpClient) {}

  // ── GET /profile ───────────────────────────────────────────────────────────
  getProfile(): Observable<ProfileResponse> {
    
    return this.http.get<ProfileResponse>(`${this.BASE}/profile`);
  }

  // ── PUT /profile/personal ──────────────────────────────────────────────────
  // multipart/form-data — avatar file optional
  updatePersonal(
    fullName: string,
    gender: string,
    phoneNumber: string,
    avatarFile?: File | null
  ): Observable<{ success: boolean; message: string; user: Partial<UserProfile> }> {
    const fd = new FormData();
    fd.append('fullName', fullName);
    fd.append('gender', gender);
    fd.append('phoneNumber', phoneNumber);
    if (avatarFile) fd.append('avatar', avatarFile);
    return this.http.put<any>(`${this.BASE}/profile/personal`, fd);
  }

  // ── POST /profile/professional ─────────────────────────────────────────────
  createProfessional(
    doc: ProfessionalDoc,
    idCardFile?: File | null
  ): Observable<{ success: boolean; message: string; document: ProfessionalDoc }> {
    const fd = new FormData();
    fd.append('company_name', doc.company_name);
    fd.append('job_title', doc.job_title);
    fd.append('work_email', doc.work_email);
    fd.append('linkedin_url', doc.linkedin_url);
    if (idCardFile) fd.append('id_card', idCardFile);
    return this.http.post<any>(`${this.BASE}/profile/professional`, fd);
  }

  // ── PUT /profile/professional ──────────────────────────────────────────────
  updateProfessional(
    doc: ProfessionalDoc,
    idCardFile?: File | null
  ): Observable<{ success: boolean; message: string; document: ProfessionalDoc }> {
    const fd = new FormData();
    fd.append('company_name', doc.company_name);
    fd.append('job_title', doc.job_title);
    fd.append('work_email', doc.work_email);
    fd.append('linkedin_url', doc.linkedin_url);
    if (idCardFile) fd.append('id_card', idCardFile);
    return this.http.put<any>(`${this.BASE}/profile/professional`, fd);
  }

  // ── POST /profile/vehicles ─────────────────────────────────────────────────
  addVehicle(
    v: Vehicle
  ): Observable<{ success: boolean; vehicle: Vehicle }> {
    return this.http.post<any>(`${this.BASE}/profile/vehicles`, {
      vehicle_type:  v.vehicle_type,
      model:         v.model,
      plate_number:  v.plate_number,
      color:         v.color,
      seat_capacity: v.seat_capacity,
    });
  }

  // ── PUT /profile/vehicles ──────────────────────────────────────────────────
  // vehicle_id body mein
  updateVehicle(
    v: Vehicle
  ): Observable<{ success: boolean; vehicle: Vehicle }> {
    return this.http.put<any>(`${this.BASE}/profile/vehicles`, {
      vehicle_id:    v._id,
      vehicle_type:  v.vehicle_type,
      model:         v.model,
      plate_number:  v.plate_number,
      color:         v.color,
      seat_capacity: v.seat_capacity,
    });
  }

  // ── DELETE /profile/vehicles ───────────────────────────────────────────────
  // vehicle_id body mein
  deleteVehicle(
    vehicleId: string
  ): Observable<{ success: boolean; message: string }> {
    return this.http.delete<any>(`${this.BASE}/profile/vehicles`, {
      body: { vehicle_id: vehicleId },
    });
  }

  getUserProfile(): Observable<Profileresponse> {
    return this.http.get<Profileresponse>(`${this.BASE}/profile`, {
      headers: AuthHelper.getAuthHeader()
    })
  }

  updateProfile(formData: FormData): Observable<UpdateProfileResponse> {
    return this.http.put<UpdateProfileResponse>(`${this.BASE}/profile/personal`, formData, {
      headers: AuthHelper.getAuthHeader()
    })
  }

  getUserProfileById(userId: string): Observable<any> {
  return this.http.post<any>(`${this.BASE}/getUserProfile`, { user_id: userId })
}
}
