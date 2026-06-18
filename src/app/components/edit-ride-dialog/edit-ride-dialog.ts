import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

interface EditRideData {
  ride: any;
  /** true when the ride already has active (non-cancelled) bookings */
  hasBookings: boolean;
  /** number of seats already booked by passengers */
  bookedSeats: number;
}

@Component({
  selector: 'app-edit-ride-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-ride-dialog.html',
  styleUrl: './edit-ride-dialog.css',
})
export class EditRideDialog {
  // Editable fields
  rideDate = '';
  rideTime = '';
  seats = 1;
  price = 450;

  // Bounds (mirror create-ride)
  readonly maxTotalSeats = 4; // vehicle/ride seat cap (booked + available)
  readonly minPrice = 420;
  readonly maxPrice = 550;
  readonly priceStep = 10;

  constructor(
    public dialogRef: MatDialogRef<EditRideDialog>,
    @Inject(MAT_DIALOG_DATA) public data: EditRideData
  ) {
    const dt: string = data.ride?.departure_time || '';
    // departure_time is stored as `YYYY-MM-DDTHH:mm:00.000Z` — slice directly
    // so display/edit stays consistent with how it was created (UTC).
    this.rideDate = dt.slice(0, 10);
    this.rideTime = dt.slice(11, 16);
    // available_seats = REMAINING seats (booking decrements it). Total capacity
    // = remaining + already-booked.
    this.seats = data.ride?.available_seats ?? 1;
    this.price = data.ride?.price_per_seat ?? 450;

    // keep the starting value inside valid bounds
    this.seats = Math.min(Math.max(this.seats, this.minSeats), this.maxSeats);
  }

  /** seats editable in both modes; everything else only when no bookings */
  get fieldsLocked(): boolean {
    return this.data.hasBookings;
  }

  get bookedSeats(): number {
    return this.data.bookedSeats || 0;
  }

  get minSeats(): number {
    // when bookings exist seats can drop to 0 (mark full), otherwise need >= 1
    return this.data.hasBookings ? 0 : 1;
  }

  /** max remaining seats the rider can offer = capacity − already booked */
  get maxSeats(): number {
    return Math.max(0, this.maxTotalSeats - this.bookedSeats);
  }

  get today(): string {
    return new Date().toISOString().split('T')[0];
  }

  incrementSeats(): void {
    if (this.seats < this.maxSeats) this.seats++;
  }

  decrementSeats(): void {
    if (this.seats > this.minSeats) this.seats--;
  }

  incrementPrice(): void {
    if (this.price < this.maxPrice) this.price += this.priceStep;
  }

  decrementPrice(): void {
    if (this.price > this.minPrice) this.price -= this.priceStep;
  }

  get canSave(): boolean {
    if (this.fieldsLocked) {
      // only seats matter — must differ or just allow save of seats
      return this.seats >= this.minSeats && this.seats <= this.maxSeats;
    }
    return !!(this.rideDate && this.rideTime && this.seats >= this.minSeats);
  }

  save(): void {
    if (!this.canSave) return;

    if (this.fieldsLocked) {
      this.dialogRef.close({ available_seats: this.seats });
      return;
    }

    const departure_time = `${this.rideDate}T${this.rideTime}:00.000Z`;
    this.dialogRef.close({
      departure_time,
      available_seats: this.seats,
      price_per_seat: this.price,
    });
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
