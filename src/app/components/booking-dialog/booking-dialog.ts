import { CommonModule } from '@angular/common';
import { Component, Inject,OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
export interface BookingDialogResult {
  males: number;
  females: number;
  total: number;
  isSameFamily: boolean;
}
@Component({
  selector: 'app-booking-dialog',
  imports: [CommonModule],
  templateUrl: './booking-dialog.html',
  styleUrl: './booking-dialog.css',
})
export class BookingDialog implements OnInit  {

  males = 0;
  females = 0;
  // field add karo
isSameFamily = false;
   constructor(
    public dialogRef: MatDialogRef<BookingDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { ride: any }
  ) {
    console.log('dialog data:', data);      // ← kya aa raha hai
  console.log('ride in dialog:', data.ride); // ← ride object
  }
ngOnInit(): void {
  // Tabler icons load karo
  if (!document.getElementById('tabler-icons-dialog')) {
    const link = document.createElement('link');
    link.id = 'tabler-icons-dialog';
    link.rel = 'stylesheet';
    link.href = 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css';
    document.head.appendChild(link);
  }
}
  get total(): number {
    return this.males + this.females;
  }

  increment(gender: 'male' | 'female'): void {
    if (this.total >= this.data.ride.available_seats) return;
    if (gender === 'male') this.males++;
    else this.females++;
  }

  decrement(gender: 'male' | 'female'): void {
    if (gender === 'male' && this.males > 0) this.males--;
    else if (gender === 'female' && this.females > 0) this.females--;
  }

  confirm(): void {
    if (this.total === 0) return;
    this.dialogRef.close({ males: this.males, females: this.females, total: this.total,isSameFamily: this.isSameFamily });
  }

  close(): void {
    this.dialogRef.close(null);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true
    });
  }
 
}
