import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  JobFileKind,
  JobOpening,
  JobPayload,
  JobService,
  jobFileUrl,
  toJobFormData,
} from '../../services/job-service';
import { AuthHelper } from '../../helpers/auth-helper';
import { Snackbar } from '../../services/snackbar';

/** API ki JOB_FILE_RULES jaisi limits — server bhi yahi check karta hai. */
const FILE_RULES: Record<JobFileKind, { label: string; maxMb: number; types: string[] }> = {
  logo: { label: 'Company logo', maxMb: 2, types: ['image/png', 'image/jpeg', 'image/webp'] },
  image: { label: 'Opening image', maxMb: 5, types: ['image/png', 'image/jpeg', 'image/webp'] },
  pdf: { label: 'PDF file', maxMb: 10, types: ['application/pdf'] },
};

/**
 * Job opening ka form — naya post (`/careers/post`) aur apni posting ka edit
 * (`/careers/:id/edit`) dono. Title, company, location, HR email aur apply
 * link zaroori; baaki sab optional. Nayi posting default approved hoti hai;
 * edit se approval status nahi badalta.
 */
@Component({
  selector: 'app-post-job',
  imports: [FormsModule, RouterLink],
  templateUrl: './post-job.html',
  styleUrl: './post-job.css',
})
export class PostJob implements OnInit, OnDestroy {
  private jobService = inject(JobService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private snackbar = inject(Snackbar);

  categories = signal<string[]>([]);
  jobTypes = signal<string[]>([]);
  workModes = signal<string[]>([]);
  experienceLevels = signal<string[]>([]);

  /** Edit mode me posting ki id; null = naya post. */
  editId: string | null = null;
  loadingJob = signal(false);
  saving = signal(false);
  error = signal('');

  form: JobPayload = {
    title: '',
    company: '',
    category: '',
    job_type: '',
    work_mode: '',
    experience: '',
    location: '',
    vacancies: null,
    deadline: '',
    office_time: '',
    salary: '',
    company_description: '',
    description: '',
    skills: '',
    apply_email: '',
    apply_link: '',
  };

  files: Record<JobFileKind, File | null> = { logo: null, image: null, pdf: null };
  /** Edit me server par pehle se padi files. */
  existingFiles = signal<Partial<Record<JobFileKind, string>>>({});
  /** Edit me "Remove current" tick ki hui files. */
  removeFiles: Record<JobFileKind, boolean> = { logo: false, image: false, pdf: false };
  /** Logo aur image ka local preview (object URL). */
  previews = signal<Partial<Record<JobFileKind, string>>>({});

  readonly fileUrl = jobFileUrl;
  /** Aaj se pehle ki deadline na chuni ja sake. */
  readonly today = new Date().toISOString().slice(0, 10);

  ngOnInit(): void {
    this.editId = this.route.snapshot.paramMap.get('id');

    if (!AuthHelper.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    this.jobService.getOptions().subscribe({
      next: (res: any) => {
        this.categories.set(res?.categories || []);
        this.jobTypes.set(res?.job_types || []);
        this.workModes.set(res?.work_modes || []);
        this.experienceLevels.set(res?.experience_levels || []);
      },
      error: () => this.error.set('Could not load form options. Please refresh.'),
    });

    if (this.editId) this.loadJob(this.editId);
  }

  ngOnDestroy(): void {
    Object.values(this.previews()).forEach((url) => url && URL.revokeObjectURL(url));
  }

  private loadJob(id: string): void {
    this.loadingJob.set(true);
    this.jobService.getJobForEdit(id).subscribe({
      next: (res: any) => {
        const job: JobOpening = res?.job;
        this.form = {
          title: job.title,
          company: job.company,
          category: job.category || '',
          job_type: job.job_type || '',
          work_mode: job.work_mode || '',
          experience: job.experience || '',
          location: job.location,
          vacancies: job.vacancies ?? null,
          deadline: toDateInput(job.deadline),
          office_time: job.office_time || '',
          salary: job.salary || '',
          company_description: job.company_description || '',
          description: job.description || '',
          skills: (job.skills || []).join(', '),
          apply_email: job.apply_email || '',
          apply_link: job.apply_link || '',
        };
        this.existingFiles.set({
          logo: job.logo_url || undefined,
          image: job.image_url || undefined,
          pdf: job.pdf_url || undefined,
        });
        this.loadingJob.set(false);
      },
      error: () => {
        this.loadingJob.set(false);
        this.snackbar.error('You can only edit your own job postings');
        this.router.navigate(['/careers/mine']);
      },
    });
  }

  onFile(kind: JobFileKind, event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const rule = FILE_RULES[kind];

    if (file && !rule.types.includes(file.type)) {
      this.snackbar.error(`${rule.label}: unsupported file type`);
      input.value = '';
      return;
    }
    if (file && file.size > rule.maxMb * 1024 * 1024) {
      this.snackbar.error(`${rule.label} must be under ${rule.maxMb} MB`);
      input.value = '';
      return;
    }

    this.setFile(kind, file);
    if (file) this.removeFiles[kind] = false;
  }

  clearFile(kind: JobFileKind, input: HTMLInputElement): void {
    input.value = '';
    this.setFile(kind, null);
  }

  private setFile(kind: JobFileKind, file: File | null): void {
    this.files[kind] = file;
    const old = this.previews()[kind];
    if (old) URL.revokeObjectURL(old);
    this.previews.update((p) => ({
      ...p,
      [kind]: file && kind !== 'pdf' ? URL.createObjectURL(file) : undefined,
    }));
  }

  submit(): void {
    this.error.set('');

    const f = this.form;
    if (!f.title.trim() || !f.company.trim() || !f.location.trim()) {
      this.error.set('Please fill job title, company and location.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.apply_email.trim())) {
      this.error.set('Please enter a valid HR contact email.');
      return;
    }
    if (!/^https?:\/\/\S+\.\S+/i.test(f.apply_link.trim())) {
      this.error.set('Please enter a valid apply link starting with http:// or https://');
      return;
    }
    if (f.vacancies !== null && f.vacancies < 1) {
      this.error.set('Vacancies must be at least 1.');
      return;
    }

    // Edit me khaali field bhi bhejte hain — backend use "saaf karo" samajhta hai.
    const payload = toJobFormData(f, this.files, !!this.editId);
    if (this.editId) {
      for (const kind of Object.keys(this.removeFiles) as JobFileKind[]) {
        if (this.removeFiles[kind] && !this.files[kind]) payload.append(`remove_${kind}`, 'true');
      }
    }

    const request$ = this.editId
      ? this.jobService.updateJob(this.editId, payload)
      : this.jobService.createJob(payload);

    this.saving.set(true);
    request$.subscribe({
      next: (res: any) => {
        this.saving.set(false);
        if (this.editId) {
          this.snackbar.success('Job opening updated');
          this.router.navigate(['/careers/mine']);
        } else {
          this.snackbar.success('Job opening posted');
          this.router.navigate(['/careers', res?.job?._id ?? '']);
        }
      },
      error: (err: any) => {
        this.saving.set(false);
        this.error.set(
          err?.error?.errors?.[0]?.message || err?.error?.message || 'Could not save the job. Please try again.'
        );
      },
    });
  }
}

/** Deadline IST midnight par save hoti hai — ISO kaatne se ek din peeche aata. */
function toDateInput(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
