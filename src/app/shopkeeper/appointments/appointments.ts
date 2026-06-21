import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ShopkeeperService } from '../../services/shopkeeper-service';

@Component({
  selector: 'app-shop-appointments',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './appointments.html',
  styleUrl: './appointments.css',
})
export class ShopAppointments {
  loading = true;
  error = '';
  appointments: any[] = [];
  doctors: { id: string; name: string }[] = [];
  updatingId: string | null = null;

  /** current doctor filter — '' = all */
  doctorFilter = '';
  /** per-appointment time input (keyed by appointment id) */
  timeInput: Record<string, string> = {};

  constructor(private shopkeeper: ShopkeeperService, private router: Router) {}

  ngOnInit(): void {
    if (!this.shopkeeper.isLoggedIn()) {
      this.router.navigate(['/shop/login']);
      return;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.shopkeeper.getAppointments().subscribe({
      next: (res: any) => {
        this.appointments = res?.data ?? [];
        this.doctors = res?.doctors ?? [];
        for (const a of this.appointments) {
          if (a.appointment_time) this.timeInput[a._id] = a.appointment_time;
        }
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 401) { this.shopkeeper.logout(); this.router.navigate(['/shop/login']); return; }
        this.error = err?.error?.message || 'Failed to load appointments.';
      },
    });
  }

  get filtered(): any[] {
    if (!this.doctorFilter) return this.appointments;
    return this.appointments.filter((a) => String(a.doctor_id) === this.doctorFilter);
  }

  /** accept (requires a time), reject, or complete */
  setStatus(a: any, status: string): void {
    if (this.updatingId) return;
    const time = (this.timeInput[a._id] || '').trim();
    if (status === 'accepted' && !time) {
      this.error = 'Enter the appointment time before accepting.';
      return;
    }
    this.error = '';
    this.updatingId = a._id;
    const prevStatus = a.status;
    a.status = status; // optimistic
    if (status === 'accepted') a.appointment_time = time;

    this.shopkeeper.updateAppointment(a._id, { status, appointment_time: time }).subscribe({
      next: () => { this.updatingId = null; },
      error: (err) => {
        this.updatingId = null;
        a.status = prevStatus;
        this.error = err?.error?.message || 'Failed to update appointment.';
      },
    });
  }

  statusClass(s: string): string {
    return 'ap-pill ap-' + s;
  }

  formatDate(dt: string): string {
    if (!dt) return '';
    return new Date(dt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  goBack(): void {
    this.router.navigate(['/shop/dashboard']);
  }
}
