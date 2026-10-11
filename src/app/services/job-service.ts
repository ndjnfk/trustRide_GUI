import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environment';
import { AuthHelper } from '../helpers/auth-helper';
import { SKIP_LOADER_HEADER } from '../interceptors/loader-interceptor';

export interface JobOpening {
  _id: string;
  title: string;
  company: string;
  category: string;
  job_type: string;
  work_mode: string;
  experience: string;
  location: string;
  vacancies: number | null;
  deadline: string | null;
  office_time: string;
  salary: string;
  company_description: string;
  description: string;
  skills: string[];
  apply_email: string;
  apply_link: string;
  logo_url: string | null;
  image_url: string | null;
  pdf_url: string | null;
  posted_by: string | null;
  posted_by_name: string;
  created_at: string;
  /** Poster ne close ki — owner aur admin ko hi dikhti hai. */
  is_closed?: boolean;
  // Sirf admin / owner list me aate hain
  is_approved?: boolean;
  posted_by_email?: string;
}

/** Form ke text fields. Sirf title, company, location, apply_email zaroori. */
export interface JobPayload {
  title: string;
  company: string;
  category: string;
  job_type: string;
  work_mode: string;
  experience: string;
  location: string;
  vacancies: number | null;
  deadline: string;
  office_time: string;
  salary: string;
  company_description: string;
  description: string;
  skills: string;
  apply_email: string;
  apply_link: string;
}

export type JobFileKind = 'logo' | 'image' | 'pdf';

/**
 * Text fields + files ko multipart me badlo. Khaali text field `keepBlank`
 * na ho to chhod do (create par); admin edit me khaali bhejna = field saaf karna.
 */
export function toJobFormData(
  payload: JobPayload,
  files: Partial<Record<JobFileKind, File | null>>,
  keepBlank = false
): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(payload)) {
    const text = value === null || value === undefined ? '' : String(value).trim();
    if (text || keepBlank) fd.append(key, text);
  }
  for (const [kind, file] of Object.entries(files)) {
    if (file) fd.append(kind, file, file.name);
  }
  return fd;
}

export interface JobFilters {
  title?: string;
  category?: string;
  location?: string;
}

/** Careers page — list/detail public, post karne ke liye login (backend: user/JobsController). */
@Injectable({ providedIn: 'root' })
export class JobService {
  private readonly api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * Public openings, page-wise (naye se purane). `quiet` = global loader mat
   * dikhao (home jaise side sections ke liye). `limit` na do to API ka default (10).
   */
  getJobs(filters: JobFilters = {}, quiet = false, page = 1, limit?: number): Observable<any> {
    const params: any = { page };
    if (limit) params.limit = limit;
    if (filters.title) params.title = filters.title;
    if (filters.category) params.category = filters.category;
    if (filters.location) params.location = filters.location;
    const headers: Record<string, string> = quiet ? { [SKIP_LOADER_HEADER]: 'true' } : {};
    return this.http.get(`${this.api}/jobs`, { params, headers });
  }

  getJob(id: string): Observable<any> {
    return this.http.get(`${this.api}/jobs/${id}`);
  }

  getOptions(): Observable<any> {
    return this.http.get(`${this.api}/jobs/options`);
  }

  // Multipart — Content-Type browser khud boundary ke saath set karta hai.
  createJob(payload: FormData): Observable<any> {
    return this.http.post(`${this.api}/jobs`, payload, { headers: this.authHeader() });
  }

  // ── Owner — sirf apni postings ──
  getMyJobs(): Observable<any> {
    return this.http.get(`${this.api}/jobs/mine`, { headers: this.authHeader() });
  }

  /** Edit form ke liye — disapproved posting bhi milti hai. */
  getJobForEdit(id: string): Observable<any> {
    return this.http.get(`${this.api}/jobs/${id}/manage`, { headers: this.authHeader() });
  }

  updateJob(id: string, payload: FormData): Observable<any> {
    return this.http.put(`${this.api}/jobs/${id}`, payload, { headers: this.authHeader() });
  }

  /** Close ⇄ reopen — closed opening public jagah se hat jaati hai. */
  toggleClose(id: string): Observable<any> {
    return this.http.patch(`${this.api}/jobs/${id}/close`, {}, { headers: this.authHeader() });
  }

  private authHeader() {
    return { Authorization: `Bearer ${AuthHelper.getToken() ?? ''}` };
  }
}

/** `/uploads/jobs/...` jaisa path → poora URL (API server se serve hota hai). */
export function jobFileUrl(path: string | null | undefined): string {
  return path ? `${environment.apiUrl}${path}` : '';
}

/** Image/pdf ka download link — API `Content-Disposition: attachment` bhejti hai. */
export function jobDownloadUrl(jobId: string, kind: 'image' | 'pdf'): string {
  return `${environment.apiUrl}/jobs/${jobId}/download/${kind}`;
}

/** Card aur detail page dono ka "Apply Now" — link ho to wahi, warna email. */
export function jobApplyHref(job: JobOpening): string {
  if (job.apply_link) return job.apply_link;
  if (job.apply_email) {
    return `mailto:${job.apply_email}?subject=${encodeURIComponent('Application for ' + job.title)}`;
  }
  return '';
}
