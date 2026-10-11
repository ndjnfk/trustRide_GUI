import { Component, Inject, OnInit, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { Adminservice } from '../../services/adminservice';

interface WalletTx {
  _id: string;
  role: 'rider' | 'passenger' | null;
  from: string;
  to: string;
  seats: number | null;
  fee_per_seat: number | null;
  amount: number;
  created_at: string;
}

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
export class UserProfileDialog implements OnInit {
  private adminService = inject(Adminservice);

  /** Wallet = user par platform ki kitni fee baaki hai, har complete ride ka record. */
  walletLoading = signal(true);
  walletError = signal('');
  walletDue = signal(0);
  walletTx = signal<WalletTx[]>([]);

  constructor(
    @Inject(MAT_DIALOG_DATA) public user: any
  ) {}

  ngOnInit(): void {
    this.adminService.getUserWallet(this.user?._id).subscribe({
      next: (res: any) => {
        this.walletDue.set(Number(res?.due) || 0);
        this.walletTx.set(res?.transactions || []);
        this.walletLoading.set(false);
      },
      error: (err: any) => {
        this.walletError.set(err?.error?.message || 'Could not load wallet');
        this.walletLoading.set(false);
      },
    });
  }

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