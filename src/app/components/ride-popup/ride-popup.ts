import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MaterialModule } from '../../shared/material/material-module';
import { Router } from '@angular/router';

export interface Ride {
  ride_id: string;
  driver_id: string;
  driver_name: string;
  from: string;
  to: string;
  departure_time: string;
  available_seats: number;
  price_per_seat: number;
  status: string;
}

@Component({
  selector: 'app-ride-popup',
  imports: [CommonModule,MaterialModule],
  templateUrl: './ride-popup.html',
  styleUrl: './ride-popup.css',
})
export class RidePopup {
  rides: Ride[];
  from: string;
  to: string;
 
  constructor(
    public dialogRef: MatDialogRef<RidePopup>,
    @Inject(MAT_DIALOG_DATA) public data: { rides: Ride[]; from: string; to: string },private router:Router
  ) {
    this.rides = data.rides;
    this.from  = data.from;
    this.to    = data.to;
  }
 
  close(): void {
    this.dialogRef.close();
  }
 
  formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }
  openRideDetail(rideId: string) {
  this.dialogRef.close();
  this.router.navigate(['/ride-detail'], { state: { ride_id: rideId } });
}
}
