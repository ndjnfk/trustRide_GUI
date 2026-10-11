import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { JobOpening, JobService, jobFileUrl } from '../../services/job-service';
import { AuthHelper } from '../../helpers/auth-helper';
import { Snackbar } from '../../services/snackbar';

/**
 * User ki apni job postings — admin ne disapprove ki hui bhi dikhti hain
 * (status ke saath), taaki user unhe theek karke edit kar sake.
 */
@Component({
  selector: 'app-my-jobs',
  imports: [DatePipe, RouterLink],
  templateUrl: './my-jobs.html',
  styleUrl: './my-jobs.css',
})
export class MyJobs implements OnInit {
  private jobService = inject(JobService);
  private router = inject(Router);
  private snackbar = inject(Snackbar);

  jobs = signal<JobOpening[]>([]);
  loading = signal(true);
  error = signal('');
  /** Jis posting ka close/reopen chal raha hai — button double-click se bache. */
  busyId = signal<string | null>(null);

  readonly fileUrl = jobFileUrl;

  ngOnInit(): void {
    if (!AuthHelper.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/careers/mine' } });
      return;
    }

    this.jobService.getMyJobs().subscribe({
      next: (res: any) => {
        this.jobs.set(res?.jobs || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load your job postings. Please try again.');
      },
    });
  }

  /** Close karne se pehle poochho — reopen bina pooche. */
  toggleClose(job: JobOpening): void {
    if (
      !job.is_closed &&
      !window.confirm(`Close "${job.title}"? It will be hidden from the Careers page. You can reopen it anytime.`)
    ) {
      return;
    }

    this.busyId.set(job._id);
    this.jobService.toggleClose(job._id).subscribe({
      next: (res: any) => {
        this.busyId.set(null);
        this.jobs.update((list) =>
          list.map((j) => (j._id === job._id ? { ...j, is_closed: res?.is_closed } : j))
        );
        this.snackbar.success(res?.message || 'Updated');
      },
      error: (err: any) => {
        this.busyId.set(null);
        this.snackbar.error(err?.error?.message || 'Could not update the job opening');
      },
    });
  }
}
