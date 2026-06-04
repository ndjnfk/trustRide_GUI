import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Ride } from '../../services/ride';
import { environment } from '../../../../environment';

interface Review {
  userId: string,
  name: string;
  avatar?: string | null;
  verified?: boolean;
  rating: string;
  comment: string;
  date: string;
  reviewCount: number;
  allReviews: { rating: string; comment: string; date: string }[]; 
}

interface Breakdown {
  label: string;
  count: number;
}

@Component({
  selector: 'app-rating',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './rating.html',
  styleUrl: './rating.css',
})
export class Rating implements OnInit {
  activeTab: 'received' | 'given' = 'received';
  showGivenTab = true;
  isLoading = false;

  average = '0/5';
  totalRatings = 0;

  breakdown: Breakdown[] = [
    { label: 'Outstanding', count: 0 },  // 5
    { label: 'Good', count: 0 },          // 4
    { label: 'Okay', count: 0 },          // 3
    { label: 'Poor', count: 0 },          // 2
    { label: 'Very disappointing', count: 0 }, // 1
  ];

  receivedReviews: Review[] = [];
  givenReviews: Review[] = [];

  constructor(private rideService: Ride, private route: ActivatedRoute, private router: Router) { }

  ngOnInit() {
    // When opened from the profile rating link (?view=received), show only Received.
    this.showGivenTab = this.route.snapshot.queryParamMap.get('view') !== 'received';
    this.loadReviews('received');
  }

  setTab(tab: 'received' | 'given'): void {
    this.activeTab = tab;
    this.loadReviews(tab);
  }

 loadReviews(type: 'received' | 'given') {
  this.isLoading = true;
  this.rideService.getReviewDetails(type).subscribe({
    next: (data: any[]) => {
      // API grouped data deta hai: [{ person, reviewCount, averageRating, reviews: [...] }]
      const mapped: Review[] = data.map(entry => {
        const firstReview = entry.reviews?.[0];
        return {
          userId:      entry.person.id,
          name:        entry.person?.name ?? 'User',
          avatar:      entry.person?.avatarUrl
                         ? `${environment.apiUrl}${entry.person.avatarUrl}`
                         : null,
          verified:    false,
          rawRating:   firstReview?.rating ?? 0,
          rating:      this.ratingLabel(firstReview?.rating ?? 0),
          comment:     firstReview?.comment ?? '',
          date:        this.formatDate(firstReview?.date ?? ''),
          reviewCount: entry.reviewCount ?? 1,
          allReviews:  (entry.reviews ?? []).map((r: any) => ({  // ← add karo
      rating:  this.ratingLabel(r.rating),
      comment: r.comment,
      date:    this.formatDate(r.date),
    })),
        };
      });

      if (type === 'received') {
        this.receivedReviews = mapped;
        this.calcSummary(data);
      } else {
        this.givenReviews = mapped;
      }

      this.isLoading = false;
    },
    error: () => { this.isLoading = false; }
  });
}

calcSummary(data: any[]) {
  // grouped data se saare reviews flatten karo
  const allReviews = data.flatMap(entry => entry.reviews ?? []);
  this.totalRatings = allReviews.length;

  if (allReviews.length === 0) {
    this.average = '0/5';
    this.breakdown = [
      { label: 'Outstanding', count: 0 },
      { label: 'Good', count: 0 },
      { label: 'Okay', count: 0 },
      { label: 'Poor', count: 0 },
      { label: 'Very disappointing', count: 0 },
    ];
    return;
  }

  const sum = allReviews.reduce((acc: number, r: any) => acc + r.rating, 0);
  this.average = (sum / allReviews.length).toFixed(1) + '/5';

  this.breakdown = [
    { label: 'Outstanding',        count: allReviews.filter((r: any) => r.rating === 5).length },
    { label: 'Good',               count: allReviews.filter((r: any) => r.rating === 4).length },
    { label: 'Okay',               count: allReviews.filter((r: any) => r.rating === 3).length },
    { label: 'Poor',               count: allReviews.filter((r: any) => r.rating === 2).length },
    { label: 'Very disappointing', count: allReviews.filter((r: any) => r.rating === 1).length },
  ];
}



  ratingLabel(rating: number): string {
    const map: Record<number, string> = {
      5: 'Outstanding',
      4: 'Good',
      3: 'Okay',
      2: 'Poor',
      1: 'Very disappointing'
    };
    return map[rating] ?? rating.toString();
  }

  formatDate(dateStr: string): string {

    if (!dateStr) return 'No date';

    const date = new Date(dateStr);


    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  get reviews(): Review[] {
    return this.activeTab === 'received' ? this.receivedReviews : this.givenReviews;
  }

  goToProfile(userId: string) {

    this.router.navigate(['/my-profile'], { state: { user_id: userId } })
  }

  // Modal state — class mein add karo
selectedReview: Review | null = null;

openModal(event: Event, review: Review) {
  event.stopPropagation();
  this.selectedReview = review;
  document.body.style.overflow = 'hidden';
  document.body.style.paddingRight = '0';
  document.body.style.height = '100vh';  // ← add
}

closeModal() {
  this.selectedReview = null;
  document.body.style.overflow = '';
  document.body.style.paddingRight = '';
  document.body.style.height = '';       // ← add
}

}