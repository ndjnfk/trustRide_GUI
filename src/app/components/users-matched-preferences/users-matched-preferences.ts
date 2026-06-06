
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { environment } from '../../../../environment';
import { AuthHelper } from '../../helpers/auth-helper';
import { Router } from '@angular/router';
import { Ride } from '../../services/ride';


@Component({
  selector: 'app-users-matched-preferences',
  imports: [CommonModule],
  templateUrl: './users-matched-preferences.html',
  styleUrl: './users-matched-preferences.css',
})
export class UsersMatchedPreferences implements OnInit {

  members: any[] = [];
  companyName: string = '';
  totalNumbers: number = 0;
  imageBaseUrl = environment.apiUrl;

  // ✅ Naye fields
  riders: any[] = [];
  passengers: any[] = [];
  userRole: string = '';
  loading = false;

  constructor(
    private http: HttpClient,
    private router: Router,
    private matchingService: Ride
  ) {}

  ngOnInit() {
    this.getCompanyMembers();
    this.getMatchingTravellers();  // ✅
  }

  getCompanyMembers() {
    const headers = new HttpHeaders({
      Authorization: `Bearer ${AuthHelper.getToken()}`
    });
    this.http.get(`${environment.apiUrl}/users/companyMembers`, { headers }).subscribe({
      next: (res: any) => {
        this.members = res.members;
        this.companyName = res.company_name;
        this.totalNumbers = res.total;
      },
      error: (err) => console.log(err)
    });
  }

  // ✅ Matching travellers
  getMatchingTravellers() {
    this.loading = true;
    this.matchingService.getMatchingTravellers().subscribe({
      next: (res: any) => {
        this.userRole = res.role;         // "passenger" ya "rider"
        this.riders = res.riders || [];
        this.passengers = res.passengers || [];
        this.loading = false;
      },
      error: (err) => {
        console.log(err);
        this.loading = false;
      }
    });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
  }

  goToProfile(userId: string) {
    this.router.navigate(['/my-profile'], { state: { user_id: userId } });
  }
}