import { Component, inject, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { JobOpening } from '../../services/job-service';
import { AuthHelper } from '../../helpers/auth-helper';

/**
 * Ek job opening ka card — careers page aur home dono yahi use karte hain.
 *
 * `teaser` (home): company aur Apply Now chhupe rehte hain, aur click par
 * login na ho to pehle login page — login ke baad seedha us job ka page.
 */
@Component({
  selector: 'app-job-card',
  imports: [DatePipe, RouterLink],
  templateUrl: './job-card.html',
  styleUrl: './job-card.css',
  host: { '[class.is-teaser]': 'teaser()' },
})
export class JobCard {
  private router = inject(Router);

  job = input.required<JobOpening>();
  teaser = input(false);

  open(): void {
    const jobUrl = `/careers/${this.job()._id}`;
    if (this.teaser() && !AuthHelper.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: jobUrl } });
      return;
    }
    this.router.navigateByUrl(jobUrl);
  }
}
