import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';
import { AuthHelper } from '../../helpers/auth-helper';
import { Snackbar } from '../../services/snackbar';

@Component({
  selector: 'app-doctor-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './doctor-detail.html',
  styleUrl: './doctor-detail.css',
})
export class DoctorDetail {
  imageBase: string;

  loading = true;
  error = '';
  doctor: any = null;
  shop: any = null;

  showForm = false;
  submitting = false;
  submitted = false;
  form = { patient_name: '', patient_phone: '', patient_email: '', reason: '', preferred_date: '' };

  constructor(
    private marketplace: MarketplaceService,
    private route: ActivatedRoute,
    private router: Router,
    private snackbar: Snackbar,
    private cdr: ChangeDetectorRef
  ) {
    this.imageBase = marketplace.imageBase;
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('doctorId');
    if (!id) { this.error = 'Doctor not found.'; this.loading = false; return; }
    this.load(id);
  }

  load(id: string): void {
    this.loading = true;
    this.marketplace.getDoctor(id).subscribe({
      next: (res: any) => {
        this.doctor = res?.doctor ?? null;
        this.shop = res?.shop ?? null;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.error = err?.error?.message || 'Failed to load doctor.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  openForm(): void {
    if (!AuthHelper.isLoggedIn()) {
      this.router.navigate(['/login'], {
        queryParams: { returnUrl: `/marketplace/doctor/${this.doctor?._id}` },
      });
      return;
    }
    this.showForm = true;
  }

  submit(): void {
    this.error = '';
    if (!this.form.patient_name.trim()) { this.error = 'Please enter the patient name.'; return; }
    if (!this.form.patient_phone.trim()) { this.error = 'Please enter a phone number.'; return; }
    if (!this.form.patient_email.trim()) { this.error = 'Please enter an email — we send the confirmed time here.'; return; }

    this.submitting = true;
    this.marketplace.bookAppointment(this.doctor._id, {
      patient_name: this.form.patient_name.trim(),
      patient_phone: this.form.patient_phone.trim(),
      patient_email: this.form.patient_email.trim(),
      reason: this.form.reason.trim(),
      preferred_date: this.form.preferred_date.trim(),
    }).subscribe({
      next: () => {
        this.submitting = false;
        this.submitted = true;
        this.showForm = false;
        this.snackbar.success('Appointment request sent');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.submitting = false;
        this.error = err?.error?.message || 'Could not send appointment request.';
        this.cdr.detectChanges();
      },
    });
  }

  initials(name: string): string {
    return (name || '?').split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  goToAppointments(): void {
    this.router.navigate(['/marketplace/appointments']);
  }

  goBack(): void {
    if (this.doctor?.shop_id) this.router.navigate(['/marketplace/shop', this.doctor.shop_id]);
    else this.router.navigate(['/marketplace']);
  }
}
