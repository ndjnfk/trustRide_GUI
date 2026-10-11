import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { JobFilters, JobOpening, JobService } from '../../services/job-service';
import { AuthHelper } from '../../helpers/auth-helper';
import { JobCard } from '../job-card/job-card';

@Component({
  selector: 'app-careers',
  imports: [FormsModule, RouterLink, JobCard],
  templateUrl: './careers.html',
  styleUrl: './careers.css',
})
export class Careers implements OnInit {
  private jobService = inject(JobService);
  private router = inject(Router);

  jobs = signal<JobOpening[]>([]);
  categories = signal<string[]>([]);
  locations = signal<string[]>([]);
  loading = signal(false);
  error = signal('');

  filters: JobFilters = { title: '', category: '', location: '' };
  readonly isLoggedIn = AuthHelper.isLoggedIn();

  page = signal(1);
  pages = signal(1);
  total = signal(0);

  /**
   * Page number buttons — pehla, aakhri, aur current ke aas-paas ke; beech ka
   * gap `null` (… dikhta hai). Jaise: 1 … 4 5 6 … 12
   */
  pageItems = computed<(number | null)[]>(() => {
    const current = this.page();
    const last = this.pages();
    const items: (number | null)[] = [];
    for (let n = 1; n <= last; n++) {
      if (n === 1 || n === last || Math.abs(n - current) <= 1) {
        items.push(n);
      } else if (items[items.length - 1] !== null) {
        items.push(null);
      }
    }
    return items;
  });

  ngOnInit(): void {
    this.fetchJobs();
  }

  /** Filter submit / reset par page 1 se; pagination se us page par. */
  fetchJobs(page = 1): void {
    this.loading.set(true);
    this.error.set('');

    this.jobService.getJobs(this.filters, false, page).subscribe({
      next: (res: any) => {
        this.jobs.set(res?.jobs || []);
        this.page.set(res?.page || 1);
        this.pages.set(res?.pages || 1);
        this.total.set(res?.total || 0);
        this.categories.set(res?.categories || []);
        // Filter laga ho to bhi chuni hui location dropdown se gayab na ho.
        const locs: string[] = res?.locations || [];
        if (this.filters.location && !locs.includes(this.filters.location)) {
          locs.push(this.filters.location);
        }
        this.locations.set(locs);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Could not load job openings. Please try again.');
      },
    });
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.pages() || page === this.page()) return;
    this.fetchJobs(page);
    this.scrollToOpenings();
  }

  resetFilters(): void {
    this.filters = { title: '', category: '', location: '' };
    this.fetchJobs();
  }

  // Bina login ke form khole to login ke baad wapas form par aao.
  postJob(): void {
    if (AuthHelper.isLoggedIn()) {
      this.router.navigate(['/careers/post']);
    } else {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/careers/post' } });
    }
  }

  // "View Openings" hero ke niche wale openings section par le jaata hai.
  scrollToOpenings(): void {
    document.getElementById('openings')?.scrollIntoView({ behavior: 'smooth' });
  }
}
