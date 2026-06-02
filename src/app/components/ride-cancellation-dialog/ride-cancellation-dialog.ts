import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

@Component({
  selector: 'app-ride-cancellation-dialog',
  imports: [CommonModule,FormsModule],
  templateUrl: './ride-cancellation-dialog.html',
  styleUrl: './ride-cancellation-dialog.css',
})
export class RideCancellationDialog {
   reasons = [
    'Change in travel plans',
    'Vehicle issue / breakdown',
    'Personal emergency',
    'Weather conditions',
    'Not enough passengers',
    'Other',
  ];

  selectedReason = '';
  customReason = '';

  get canConfirm(): boolean {
    if (!this.selectedReason) return false;
    if (this.selectedReason === 'Other') return this.customReason.trim().length > 0;
    return true;
  }

  get finalReason(): string {
    return this.selectedReason === 'Other' ? this.customReason.trim() : this.selectedReason;
  }

  constructor(
    public dialogRef: MatDialogRef<RideCancellationDialog>,
    @Inject(MAT_DIALOG_DATA) public data: { ride: any }
  ) {}

  confirm(): void {
    this.dialogRef.close({ reason: this.finalReason });
  }

  close(): void {
    this.dialogRef.close(null);
  }
}
