import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';
import { environment } from '../../../../environment';
import { AuthHelper } from '../../helpers/auth-helper';
import { Router } from '@angular/router';


@Component({
  selector: 'app-company-members',
  imports: [CommonModule],
  templateUrl: './company-members.html',
  styleUrl: './company-members.css',
})
export class CompanyMembers implements OnInit {

  members: any[] = [];
  companyName: string = '';
  totalNumbers: number = 0;

  imageBaseUrl = environment.apiUrl;

  constructor(private http: HttpClient,private router:Router) {}

  ngOnInit() {
    this.getCompanyMembers();
  }

  getCompanyMembers() {
    const token = AuthHelper.getToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    this.http.get(`${environment.apiUrl}/users/companyMembers`, { headers }).subscribe({
      next: (res: any) => {
        this.members = res.members;
        this.companyName = res.company_name;
        this.totalNumbers = res.total;
      },
      error: (err) => {
        console.log(err);
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
    console.log("memberid",userId)
  this.router.navigate(['/my-profile'], { state: { user_id: userId } })
}

}
