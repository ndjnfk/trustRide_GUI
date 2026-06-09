import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-user-profile-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatIconModule,
    MatButtonModule
  ],
  templateUrl: './user-profile-dialog.html',
  styleUrls: ['./user-profile-dialog.css']
})
export class UserProfileDialog {

  constructor(
    @Inject(MAT_DIALOG_DATA) public user: any
  ) {}

  /** Read the travel-days array from whichever field the API returns */
  getTravelDays(): any[] {
    const u = this.user;
    const d =
      u?.preferred_travel_days ?? u?.preferredTravelDays ??
      u?.preferred_Travel_Days ?? u?.travelDays ?? u?.travel_days;
    return Array.isArray(d) ? d : [];
  }

  /** Readable label for a single travel-day entry */
  travelDayLabel(d: any): string {
    if (typeof d === 'string') return d;
    const parts = [
      d?.day, d?.going, d?.leaving, d?.goingTo ?? d?.going_to,
      d?.comingTo ?? d?.coming_to,
    ].filter(v => typeof v === 'string' && v.trim());
    return parts.join(' · ');
  }
}