import { CommonModule, DatePipe } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from "@angular/router";
import { environment } from '../../../../environment';
import { AuthHelper } from '../../helpers/auth-helper';
import { ProfileService } from '../../servies/profile-service';


@Component({
  selector: 'app-my-profile',
  imports: [CommonModule, RouterLink, DatePipe],
  templateUrl: './my-profile.html',
  styleUrl: './my-profile.css',
})
export class MyProfile implements OnInit {

  user: any = null;
  professional: any = null;
  vehicles: any[] = [];
  avatarUrl: string | null = null;
  isLoading = false;
  error = '';
  userId = '';
  role = '';

  roleLabels: Record<string, string> = {
    passenger: 'Passenger',
    rider: 'Rider',
    both: 'Passenger & Rider',
  }

   allPreferences = [
    { key: 'quiet',      icon: 'ti-message-circle',  label: "I'm the quiet type" },
    { key: 'music',      icon: 'ti-music',            label: "It's all about playlist" },
    { key: 'smoking',    icon: 'ti-smoking-no',       label: 'No smoking' },
    { key: 'pets',       icon: 'ti-paw-off',          label: 'No pets' },
   
  ]

  constructor(private http: HttpClient,private router:Router,private profileService:ProfileService){
    const nav = this.router.getCurrentNavigation()
  this.userId = nav?.extras?.state?.['user_id'] 
    ?? history.state?.['user_id']  // ✅ fallback
    ?? ''
  console.log('userId:', this.userId)
  }


  ngOnInit(): void {
    this.getUserDetails();
  }

  roleLabel(role?: string): string {
    if (!role) return '';
    return this.roleLabels[role] ?? (role.charAt(0).toUpperCase() + role.slice(1));
  }

  verificationBadge(status?: string): string {
    const map: Record<string, string> = {
      pending: '⏳ Pending',
      verified: '✅ Verified',
      rejected: '❌ Rejected',
    };
    return map[status ?? 'pending'] ?? '⏳ Pending';
  }


  // getUserDetails(){
  //   const token = AuthHelper.getToken();

  //   const headers = new HttpHeaders({
  //     Authorization: `Bearer ${token}`
  //   });

  //   this.isLoading = true;
  //   this.error = '';

  //   this.http.get(`${environment.apiUrl}/profile`, { headers }).subscribe({
  //     next: (res: any) => {
  //       if (res?.success) {
  //         this.user = res.user;
  //         this.professional = res.professional;
  //         this.vehicles = res.vehicles ?? [];
  //         this.avatarUrl = res.user?.avatarUrl
  //           ? `${environment.apiUrl}${res.user.avatarUrl}`
  //           : null;
  //       }
  //       this.isLoading = false;
  //     },
  //     error: (err) => {
  //       this.error = err?.error?.message || 'Failed to load profile.';
  //       this.isLoading = false;
  //     }
  //   });
  // }

 getUserDetails() {
  this.isLoading = true;
  this.error = '';

  this.profileService.getUserProfileById(this.userId).subscribe({
    next: (res: any) => {
      if (res?.success) {
        const d = res.data;
        console.log('[my-profile] profile data keys:', Object.keys(d));
        console.log('[my-profile] phone candidates:', d.phone_Number, d.phone_number, d.phoneNumber, d.Phone_Number, d.mobile_number);
        this.role = d.current_role ?? d.currentRole ?? d.user_Role ?? d.user_role ?? d.role ?? '';
        this.user = {
          fullName:           d.full_name,
          gender:             d.gender,
          userEmail:          d.user_Email,
          phoneNumber:        d.phone_Number ?? d.phone_number ?? d.phoneNumber ?? d.Phone_Number ?? d.mobile_number,
          verificationStatus: d.verification_Status,
          avatarUrl:          d.avatar_Url,
          avgRating:          d.avg_rating,
          totalReviews:       d.total_reviews,
          aboutUser:          d.about_user,
          totalRides:         d.total_rides,
          totalCancelledRides:    d.total_cancelled_rides ?? 0,
          totalCancelledBookings: d.total_cancelled_bookings ?? 0,
          totalBookings:          d.total_bookings ?? 0,
          companyName:        d.company_Name,
          preferences:        d.preferences ?? [],
          preferredTravelDays: this.normalizeTravelDays(
            d.preferred_travel_days ?? d.preferredTravelDays ?? d.preferred_Travel_Days ?? d.travelDays
          ),
          created_at:         d.created_at,
        };

           this.vehicles = d.vehicle ? [d.vehicle] : [];

        this.avatarUrl = d.avatar_Url
          ? `${environment.apiUrl}${d.avatar_Url}`
          : null;
      }
      this.isLoading = false;
    },
    error: (err) => {
      this.error = err?.error?.message || 'Failed to load profile.';
      this.isLoading = false;
    }
  });
}
get ratingLabel(): string {
  const rating = this.user?.avgRating ?? 0
  if (rating >= 4.5) return 'Excellent driving skills'
  if (rating >= 4.0) return 'Good driving skills'
  if (rating >= 3.0) return 'Average driving skills'
  if (rating >= 2.0) return 'Below average driving skills'
  return 'Poor driving skills'
}

get ratingDisplay(): string {
  const rating = this.user?.avgRating ?? 0
  if (rating >= 4.5) return '5/5'
  if (rating >= 4.0) return '4/5'
  if (rating >= 3.0) return '3/5'
  if (rating >= 2.0) return '2/5'
  return '1/5'
}
get activePreferences() {
  return this.allPreferences.filter(p =>
    (this.user?.preferences ?? []).includes(p.key)
  )
}

// ✅ Travel days may arrive with camelCase or snake_case inner keys — normalize them
normalizeTravelDays(days: any): { goingTo: string; going: string; comingTo: string; leaving: string }[] {
  if (!Array.isArray(days)) return []
  return days.map(d => ({
    goingTo:  d?.goingTo  ?? d?.going_to  ?? '',
    going:    d?.going    ?? '',
    comingTo: d?.comingTo ?? d?.coming_to ?? '',
    leaving:  d?.leaving  ?? '',
  }))
}
}
