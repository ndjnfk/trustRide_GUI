import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-booking-cancellation-dialog',
  imports: [MatDialogModule,FormsModule],
  templateUrl: './booking-cancellation-dialog.html',
  styleUrl: './booking-cancellation-dialog.css',
})
export class BookingCancellationDialog {
   cancelReasons = [
    'Passenger no-show',
    'Duplicate booking',
    'Passenger request',
    'Route changed',
    'Emergency',
    'Other'
  ];

  selectedReason = '';
  additionalNote = '';
  showError = false;

  constructor(
    public dialogRef: MatDialogRef<BookingCancellationDialog>,
    @Inject(MAT_DIALOG_DATA) public data:{ booking: any } 
  ) {}

 confirm(): void {
  if (!this.additionalNote.trim()) {
    this.showError = true;
    return;
  }
  this.dialogRef.close({ reason: this.additionalNote.trim() });
}

  dismiss(): void {
    this.dialogRef.close(null);
  }
}
