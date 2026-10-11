import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthHelper } from '../../helpers/auth-helper';
import {
  JobOpening,
  JobService,
  jobApplyHref,
  jobDownloadUrl,
  jobFileUrl,
} from '../../services/job-service';

/** Skills pills ke rang — design ki tarah har pill alag rang me ghoomta hai. */
const SKILL_TONES = ['sky', 'green', 'indigo', 'rose', 'amber'];

@Component({
  selector: 'app-job-detail',
  imports: [DatePipe, RouterLink],
  templateUrl: './job-detail.html',
  styleUrl: './job-detail.css',
})
export class JobDetail implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private jobService = inject(JobService);

  job = signal<JobOpening | null>(null);
  loading = signal(true);
  notFound = signal(false);

  applyHref = computed(() => {
    const job = this.job();
    return job ? jobApplyHref(job) : '';
  });

  /** Sirf UI ke liye — asli owner check backend `PUT /jobs/:id` par hota hai. */
  isOwner = computed(() => {
    const owner = this.job()?.posted_by;
    return !!owner && owner === AuthHelper.getUserId();
  });

  logoUrl = computed(() => jobFileUrl(this.job()?.logo_url));
  imageDownload = computed(() => (this.job()?.image_url ? jobDownloadUrl(this.job()!._id, 'image') : ''));
  pdfDownload = computed(() => (this.job()?.pdf_url ? jobDownloadUrl(this.job()!._id, 'pdf') : ''));

  /** Logo na ho to company ke naam ka pehla akshar. */
  initial = computed(() => (this.job()?.company || '?').trim().charAt(0).toUpperCase());

  share = computed(() => {
    const url = encodeURIComponent(typeof window !== 'undefined' ? window.location.href : '');
    const text = encodeURIComponent(`${this.job()?.title ?? ''} at ${this.job()?.company ?? ''}`);
    return {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`,
      twitter: `https://twitter.com/intent/tweet?url=${url}&text=${text}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      whatsapp: `https://wa.me/?text=${text}%20${url}`,
    };
  });

  ngOnInit(): void {
    // Job details sirf logged-in users ke liye — shared link bhi pehle login,
    // phir login ke baad wapas isi job par.
    if (!AuthHelper.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.jobService.getJob(id).subscribe({
      next: (res: any) => {
        this.job.set(res?.job ?? null);
        this.notFound.set(!res?.job);
        this.loading.set(false);
      },
      error: () => {
        this.notFound.set(true);
        this.loading.set(false);
      },
    });
  }

  skillTone(index: number): string {
    return SKILL_TONES[index % SKILL_TONES.length];
  }
}
