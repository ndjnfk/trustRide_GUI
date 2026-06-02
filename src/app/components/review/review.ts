import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthHelper } from '../../helpers/auth-helper';
import { Ride } from '../../services/ride';
import { AuthService } from '../../services/auth';
import { Snackbar } from '../../services/snackbar';

@Component({
  selector: 'app-review',
  imports: [CommonModule, FormsModule],
  templateUrl: './review.html',
  styleUrl: './review.css',
})
export class Review {
  reviewerType: string = '';
  reviewees: any[] = [];
  rideId: string = '';
  selectedReviewee: any = null;
  isSubmitting: boolean = false;
  rating: number = 0;
  reviewText: string = '';

  constructor(
    private snackBar: Snackbar,
    private activatedRoute: ActivatedRoute,
    private rideService: Ride,
    private authService: AuthService,
    private router: Router
  ) {}

  compareReviewee(a: any, b: any): boolean {
    return a?.reviewee_id === b?.reviewee_id;
  }

  ngOnInit() {
    const rideId = this.activatedRoute.snapshot.paramMap.get('ride_id');
    const token = AuthHelper.getToken();

    if (!rideId || !token) {
      this.snackBar.error('Invalid session. Please try again.');
      return;
    }

    this.rideId = rideId;

    this.rideService.getPendingReviews().subscribe({
      next: (res) => {
        console.log('pending reviews:', res.pending_reviews);

        const forThisRide = res.pending_reviews.filter(
          (p: any) => p.ride_id === rideId
        );

        console.log('forThisRide:', forThisRide);

        if (forThisRide.length === 0) {
          this.snackBar.error('No pending reviews for this ride.');
          return;
        }

        this.reviewerType = forThisRide[0].reviewer_role;

        this.reviewees = forThisRide.map((p: any) => ({
          reviewee_id: p.reviewee_id,
          name: p.reviewee_name ?? 'User',
          from: p.from,
          to: p.to,
          date: p.date,
          booking_id: p.booking_id
        }));

        this.selectedReviewee = this.reviewees[0];
        console.log('reviewees:', this.reviewees);
        console.log('selectedReviewee:', this.selectedReviewee);
      },
      error: () => {
        this.snackBar.error('Failed to load pending reviews.');
      }
    });
  }

  setRating(star: number) {
    this.rating = star;
  }

  submitReview() {
    if (!this.rating) {
      this.snackBar.error('Please select a rating.');
      return;
    }

    if (!this.reviewText.trim()) {
      this.snackBar.error('Please write a review.');
      return;
    }

    if (!this.selectedReviewee) {
      this.snackBar.error('No reviewee found. Please reload the page.');
      return;
    }

    const payload = {
      rideId: this.rideId,
      revieweeId: this.selectedReviewee.reviewee_id,
      comment: this.reviewText.trim(),
      rating: this.rating
    };

    console.log('payload:', payload);
    this.isSubmitting = true;

    this.rideService.createReview(payload).subscribe({
      next: (res: any) => {
        this.isSubmitting = false;
        this.rating = 0;
        this.reviewText = '';

        if (this.reviewerType === 'driver') {
          this.reviewees = this.reviewees.filter(
            r => r.reviewee_id !== this.selectedReviewee.reviewee_id
          );

          if (this.reviewees.length > 0) {
            this.selectedReviewee = this.reviewees[0];
            this.snackBar.success(
              `Review submitted! ${this.reviewees.length} passenger(s) remaining.`
            );
          } else {
            this.selectedReviewee = null;
            this.snackBar.success('All passengers reviewed! Redirecting...');
            setTimeout(() => this.router.navigate(['/dashboard']), 2000);
          }
        } else {
          this.snackBar.success(res.message ?? 'Review submitted successfully!');
          setTimeout(() => this.router.navigate(['/dashboard']), 2000);
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        const msg = err?.error?.message ?? 'Something went wrong. Please try again.';
        this.snackBar.error(msg);
      }
    });
  }
}