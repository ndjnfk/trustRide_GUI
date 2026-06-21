import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ShopkeeperService } from '../../services/shopkeeper-service';
import { environment } from '../../../../environment';

@Component({
  selector: 'app-shop-doctors',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './doctors.html',
  styleUrl: './doctors.css',
})
export class ShopDoctors {
  imageBaseUrl = environment.apiUrl;

  loading = true;
  error = '';
  doctors: any[] = [];

  showForm = false;
  editingId: string | null = null;
  saving = false;
  form = {
    name: '',
    specialization: '',
    qualification: '',
    registration_no: '',
    experience_years: 0,
    consultation_fee: 0,
    available_time: '',
    phone: '',
    email: '',
  };
  imageFile: File | null = null;
  imagePreview: string | null = null;
  existingImageUrl: string | null = null;

  deletingId: string | null = null;

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
    this.shopkeeper.getDoctors().subscribe({
      next: (res: any) => {
        this.doctors = res?.data ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 401) { this.shopkeeper.logout(); this.router.navigate(['/shop/login']); return; }
        this.error = err?.error?.message || 'Failed to load doctors.';
      },
    });
  }

  openAdd(): void {
    this.editingId = null;
    this.form = { name: '', specialization: '', qualification: '', registration_no: '', experience_years: 0, consultation_fee: 0, available_time: '', phone: '', email: '' };
    this.imageFile = null;
    this.imagePreview = null;
    this.existingImageUrl = null;
    this.error = '';
    this.showForm = true;
  }

  openEdit(d: any): void {
    this.editingId = d._id;
    this.form = {
      name: d.name ?? '',
      specialization: d.specialization ?? '',
      qualification: d.qualification ?? '',
      registration_no: d.registration_no ?? '',
      experience_years: d.experience_years ?? 0,
      consultation_fee: d.consultation_fee ?? 0,
      available_time: d.available_time ?? '',
      phone: d.phone ?? '',
      email: d.email ?? '',
    };
    this.imageFile = null;
    this.imagePreview = null;
    this.existingImageUrl = d.photo_url ?? null;
    this.error = '';
    this.showForm = true;
  }

  cancelForm(): void {
    this.showForm = false;
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;
    if (file.type && !file.type.startsWith('image/')) {
      this.error = 'Please upload an image file.';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.error = 'Image must be 5MB or smaller.';
      return;
    }
    this.error = '';
    this.imageFile = file;
    const reader = new FileReader();
    reader.onload = () => (this.imagePreview = reader.result as string);
    reader.readAsDataURL(file);
  }

  save(): void {
    this.error = '';
    if (!this.form.name.trim()) { this.error = 'Doctor name is required.'; return; }
    if (!this.form.specialization.trim()) { this.error = 'Specialization is required.'; return; }
    if (this.form.consultation_fee < 0) { this.error = 'Enter a valid consultation fee.'; return; }

    const fd = new FormData();
    fd.append('name', this.form.name.trim());
    fd.append('specialization', this.form.specialization.trim());
    fd.append('qualification', this.form.qualification.trim());
    fd.append('registration_no', this.form.registration_no.trim());
    fd.append('experience_years', String(this.form.experience_years || 0));
    fd.append('consultation_fee', String(this.form.consultation_fee || 0));
    fd.append('available_time', this.form.available_time.trim());
    fd.append('phone', this.form.phone.trim());
    fd.append('email', this.form.email.trim());
    if (this.imageFile) fd.append('image', this.imageFile, this.imageFile.name);

    this.saving = true;
    const req = this.editingId
      ? this.shopkeeper.updateDoctor(this.editingId, fd)
      : this.shopkeeper.createDoctor(fd);

    req.subscribe({
      next: () => { this.saving = false; this.showForm = false; this.load(); },
      error: (err) => { this.saving = false; this.error = err?.error?.message || 'Failed to save doctor.'; },
    });
  }

  remove(d: any): void {
    if (this.deletingId) return;
    if (!confirm(`Remove Dr. ${d.name}?`)) return;
    this.deletingId = d._id;
    this.shopkeeper.deleteDoctor(d._id).subscribe({
      next: () => { this.deletingId = null; this.doctors = this.doctors.filter((x) => x._id !== d._id); },
      error: (err) => { this.deletingId = null; this.error = err?.error?.message || 'Failed to delete doctor.'; },
    });
  }

  initials(name: string): string {
    return (name || '?').split(' ').filter(Boolean).map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?';
  }

  goBack(): void {
    this.router.navigate(['/shop/dashboard']);
  }
}
