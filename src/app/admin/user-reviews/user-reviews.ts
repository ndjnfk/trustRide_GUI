import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Adminservice } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';

@Component({
  selector: 'app-user-reviews',
  standalone: true,
  imports: [CommonModule, SideBar],
  templateUrl: './user-reviews.html',
  styleUrl: './user-reviews.css',
})
export class UserReviews implements OnInit {
  loading = true;
  error = '';
  user: any = null;
  reviews: any[] = [];
  count = 0;
  avgRating = 0;

  readonly stars = [1, 2, 3, 4, 5];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminService: Adminservice,
  ) {}

  ngOnInit(): void {
    const userId = this.route.snapshot.paramMap.get('userId');
    if (!userId) {
      this.error = 'No user specified.';
      this.loading = false;
      return;
    }
    this.load(userId);
  }

  load(userId: string): void {
    this.loading = true;
    this.adminService.getUserReviews(userId).subscribe({
      next: (res: any) => {
        const data = res?.data ?? {};
        this.user = data.user ?? null;
        this.reviews = data.reviews ?? [];
        this.count = data.count ?? this.reviews.length;
        this.avgRating = data.avgRating ?? 0;
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load reviews.';
        this.loading = false;
      },
    });
  }

  initials(name: string): string {
    return (name || '?').split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
  }

  formatDate(dt: string): string {
    if (!dt) return '';
    return new Date(dt).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/dashboard']);
  }
}
