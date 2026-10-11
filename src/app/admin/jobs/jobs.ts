import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Adminservice } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { JobFileKind, JobOpening, jobFileUrl, toJobFormData } from '../../services/job-service';

type StatusFilter = '' | 'approved' | 'disapproved';

/**
 * Deadline IST midnight par save hoti hai (UTC me pichhla din 18:30), isliye
 * ISO string kaatne se ek din peeche aata — local date se yyyy-mm-dd banao.
 */
function toDateInput(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Careers page ki saari openings — users ki daali hui. Default approved;
 * admin disapprove kare to public page se hat jaati hai, yahan dikhti rehti hai.
 */
@Component({
  selector: 'app-admin-jobs',
  imports: [DatePipe, FormsModule, SideBar],
  templateUrl: './jobs.html',
  styleUrl: './jobs.css',
})
export class AdminJobs implements OnInit {
  private adminService = inject(Adminservice);
  private snackbar = inject(Snackbar);

  jobs = signal<JobOpening[]>([]);
  categories = signal<string[]>([]);
  jobTypes = signal<string[]>([]);
  workModes = signal<string[]>([]);
  experienceLevels = signal<string[]>([]);

  loading = signal(false);
  error = signal('');

  search = signal('');
  status = signal<StatusFilter>('');

  editingId = signal<string | null>(null);
  editForm: any = {};
  editFiles: Record<JobFileKind, File | null> = { logo: null, image: null, pdf: null };
  removeFiles: Record<JobFileKind, boolean> = { logo: false, image: false, pdf: false };
  readonly fileKinds: { kind: JobFileKind; label: string; accept: string }[] = [
    { kind: 'logo', label: 'Company logo', accept: 'image/png,image/jpeg,image/webp' },
    { kind: 'image', label: 'Opening image', accept: 'image/png,image/jpeg,image/webp' },
    { kind: 'pdf', label: 'PDF file', accept: 'application/pdf' },
  ];
  readonly fileUrl = jobFileUrl;
  savingId = signal<string | null>(null);
  busyId = signal<string | null>(null);

  filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const status = this.status();
    return this.jobs().filter((j) => {
      if (status === 'approved' && !j.is_approved) return false;
      if (status === 'disapproved' && j.is_approved) return false;
      if (!q) return true;
      return [j.title, j.company, j.location, j.posted_by_name, j.posted_by_email]
        .some((v) => (v || '').toLowerCase().includes(q));
    });
  });

  approvedCount = computed(() => this.jobs().filter((j) => j.is_approved).length);

  ngOnInit(): void {
    this.fetchJobs();
  }

  fetchJobs(): void {
    this.loading.set(true);
    this.error.set('');
    this.adminService.getJobs().subscribe({
      next: (res: any) => {
        this.jobs.set(res?.jobs || []);
        this.categories.set(res?.categories || []);
        this.jobTypes.set(res?.job_types || []);
        this.workModes.set(res?.work_modes || []);
        this.experienceLevels.set(res?.experience_levels || []);
        this.loading.set(false);
      },
      error: (err: any) => {
        this.loading.set(false);
        this.error.set(err?.error?.message || 'Failed to load job openings.');
      },
    });
  }

  toggle(job: JobOpening): void {
    this.busyId.set(job._id);
    this.adminService.toggleJob(job._id).subscribe({
      next: (res: any) => {
        this.busyId.set(null);
        this.jobs.update((list) =>
          list.map((j) => (j._id === job._id ? { ...j, is_approved: res?.is_approved } : j))
        );
        this.snackbar.success(res?.message || 'Updated');
      },
      error: (err: any) => {
        this.busyId.set(null);
        this.snackbar.error(err?.error?.message || 'Could not update status');
      },
    });
  }

  remove(job: JobOpening): void {
    if (!window.confirm(`Delete "${job.title}" at ${job.company}? This cannot be undone.`)) return;

    this.busyId.set(job._id);
    this.adminService.deleteJob(job._id).subscribe({
      next: () => {
        this.busyId.set(null);
        this.jobs.update((list) => list.filter((j) => j._id !== job._id));
        if (this.editingId() === job._id) this.editingId.set(null);
        this.snackbar.success('Job opening deleted');
      },
      error: (err: any) => {
        this.busyId.set(null);
        this.snackbar.error(err?.error?.message || 'Could not delete');
      },
    });
  }

  startEdit(job: JobOpening): void {
    this.editingId.set(job._id);
    this.editForm = {
      title: job.title,
      company: job.company,
      category: job.category,
      job_type: job.job_type,
      work_mode: job.work_mode,
      experience: job.experience,
      location: job.location,
      vacancies: job.vacancies ?? null,
      deadline: toDateInput(job.deadline),
      office_time: job.office_time,
      salary: job.salary,
      company_description: job.company_description,
      description: job.description,
      apply_email: job.apply_email,
      apply_link: job.apply_link,
      skills: (job.skills || []).join(', '),
    };
    this.editFiles = { logo: null, image: null, pdf: null };
    this.removeFiles = { logo: false, image: false, pdf: false };
  }

  onEditFile(kind: JobFileKind, event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.editFiles[kind] = file;
    if (file) this.removeFiles[kind] = false;
  }

  fileOf(job: JobOpening, kind: JobFileKind): string | null {
    return (job as any)[`${kind}_url`] ?? null;
  }

  cancelEdit(): void {
    this.editingId.set(null);
  }

  saveEdit(job: JobOpening): void {
    const f = this.editForm;
    if (
      !f.title?.trim() ||
      !f.company?.trim() ||
      !f.location?.trim() ||
      !f.apply_email?.trim() ||
      !f.apply_link?.trim()
    ) {
      this.snackbar.error('Title, company, location, HR email and apply link are required');
      return;
    }

    // Khaali field bhi bhejte hain — backend use "saaf karo" samajhta hai.
    const payload = toJobFormData(f, this.editFiles, true);
    for (const { kind } of this.fileKinds) {
      if (this.removeFiles[kind] && !this.editFiles[kind]) payload.append(`remove_${kind}`, 'true');
    }

    this.savingId.set(job._id);
    this.adminService.updateJob(job._id, payload).subscribe({
      next: (res: any) => {
        this.savingId.set(null);
        this.editingId.set(null);
        if (res?.job) {
          this.jobs.update((list) => list.map((j) => (j._id === job._id ? res.job : j)));
        }
        this.snackbar.success('Job opening updated');
      },
      error: (err: any) => {
        this.savingId.set(null);
        this.snackbar.error(
          err?.error?.errors?.[0]?.message || err?.error?.message || 'Could not save changes'
        );
      },
    });
  }
}
