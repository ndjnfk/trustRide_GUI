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

}