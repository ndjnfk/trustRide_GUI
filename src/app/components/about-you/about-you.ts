import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Component, OnInit, ViewChild } from '@angular/core';
import { Router, RouterLink } from "@angular/router";
import { environment } from '../../../../environment';
import { AuthHelper } from '../../helpers/auth-helper';
import { Vehicle } from '../../servies/profile-service';
import { VehicleDialog } from '../vehicle-dialog/vehicle-dialog';

@Component({
  selector: 'app-about-you',
  imports: [CommonModule, RouterLink, VehicleDialog],
  templateUrl: './about-you.html',
  styleUrl: './about-you.css',
})
export class AboutYou implements OnInit{

  user: any = null;
  professional: any = null;
  vehicles: any[] = [];
  avatarUrl: string | null = null;
  isLoading = false;
  error = '';

  allPreferences = [
    { key: 'quiet',      icon: 'ti-message-circle',  label: "I'm the quiet type" },
    { key: 'music',      icon: 'ti-music',            label: "It's all about playlist" },
    { key: 'smoking',    icon: 'ti-smoking-no',       label: 'No smoking' },
    { key: 'pets',       icon: 'ti-paw-off',          label: 'No pets' },
   
  ]

  @ViewChild(VehicleDialog) vehicleDialog!: VehicleDialog;

  constructor(private http: HttpClient,private router:Router){}


  ngOnInit(): void {
    this.getUserDetails();
  }
  


  openAddVehicle(): void {
    this.vehicleDialog.open();
  }


  onVehicleSaved(vehicle: Vehicle): void {
    this.vehicles = [...this.vehicles, vehicle];
  }


  verificationBadge(status?: string): string {
    const map: Record<string, string> = {
      pending: '⏳ Pending',
      verified: '✅ Verified',
      rejected: '❌ Rejected',
    };
    return map[status ?? 'pending'] ?? '⏳ Pending';
  }


  getUserDetails(){
    const token = AuthHelper.getToken();

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`
    });

    this.isLoading = true;
    this.error = '';

    this.http.get(`${environment.apiUrl}/profile`, { headers }).subscribe({
      next: (res: any) => {
        if (res?.success) {
          this.user = res.user;
          this.professional = res.professional;
          this.vehicles = res.vehicles ?? [];
          this.avatarUrl = res.user?.avatarUrl
            ? `${environment.apiUrl}${res.user.avatarUrl}`
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
get activePreferences() {
  return this.allPreferences.filter(p => 
    (this.user?.preferences ?? []).includes(p.key)
  )
}
goToProfile(userId: string) {
  console.log('Navigating with userId:', userId)  // ✅ check karo
  this.router.navigate(['/my-profile'], { state: { user_id: userId } })
}
}
