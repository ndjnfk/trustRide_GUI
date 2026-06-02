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
        console.log('first review person:', data[0]?.person);
        const mapped: Review[] = data
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
          .slice(0, 10)
          .map(r => ({
            userId: r.person.id,
            name: r.person?.name ?? 'User',
            avatar: r.person?.avatarUrl
              ? `${environment.apiUrl}${r.person.avatarUrl}`  // ✅ prefix lagao
              : null,
            verified: false,
            rating: this.ratingLabel(r.rating),
            comment: r.comment,
            date: this.formatDate(r.date),
            rawRating: r.rating
          }));

        if (type === 'received') {
          this.receivedReviews = mapped;
          this.calcSummary(data);
        } else {
          this.givenReviews = mapped;
        }

        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
      }
    });
  }

  calcSummary(data: any[]) {
    this.totalRatings = data.length;

    if (data.length === 0) {
      this.average = '0/5';
      return;
    }

    const sum = data.reduce((acc, r) => acc + r.rating, 0);
    this.average = (sum / data.length).toFixed(1) + '/5';

    this.breakdown = [
      { label: 'Outstanding', count: data.filter(r => r.rating === 5).length },
      { label: 'Good', count: data.filter(r => r.rating === 4).length },
      { label: 'Okay', count: data.filter(r => r.rating === 3).length },
      { label: 'Poor', count: data.filter(r => r.rating === 2).length },
      { label: 'Very disappointing', count: data.filter(r => r.rating === 1).length },
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
}