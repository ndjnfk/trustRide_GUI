import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ShopkeeperService } from '../../services/shopkeeper-service';
import { environment } from '../../../../environment';

@Component({
  selector: 'app-shop-services',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './services.html',
  styleUrl: './services.css',
})
export class ShopServices {
  imageBaseUrl = environment.apiUrl;

  loading = true;
  error = '';
  services: any[] = [];

  showForm = false;
  editingId: string | null = null;
  saving = false;
  form = { name: '', description: '', price: 0, duration_minutes: 30 };
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
    this.shopkeeper.getServices().subscribe({
      next: (res: any) => {
        this.services = res?.data ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 401) {
          this.shopkeeper.logout();
          this.router.navigate(['/shop/login']);
          return;
        }
        this.error = err?.error?.message || 'Failed to load services.';
      },
    });
  }

  openAdd(): void {
    this.editingId = null;
    this.form = { name: '', description: '', price: 0, duration_minutes: 30 };
    this.imageFile = null;
    this.imagePreview = null;
    this.existingImageUrl = null;
    this.error = '';
    this.showForm = true;
  }

  openEdit(s: any): void {
    this.editingId = s._id;
    this.form = {
      name: s.name ?? '',
      description: s.description ?? '',
      price: s.price ?? 0,
      duration_minutes: s.duration_minutes ?? 30,
    };
    this.imageFile = null;
    this.imagePreview = null;
    this.existingImageUrl = s.image_url ?? null;
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
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      this.error = 'Please upload a JPG, PNG or WEBP image.';
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
    if (!this.form.name.trim()) { this.error = 'Service name is required.'; return; }
    if (this.form.price < 0 || this.form.price == null) { this.error = 'Enter a valid price.'; return; }
    if (!this.form.duration_minutes || this.form.duration_minutes <= 0) { this.error = 'Enter a valid duration.'; return; }

    const fd = new FormData();
    fd.append('name', this.form.name.trim());
    fd.append('description', this.form.description.trim());
    fd.append('price', String(this.form.price));
    fd.append('duration_minutes', String(this.form.duration_minutes));
    if (this.imageFile) fd.append('image', this.imageFile, this.imageFile.name);

    this.saving = true;
    const req = this.editingId
      ? this.shopkeeper.updateService(this.editingId, fd)
      : this.shopkeeper.createService(fd);

    req.subscribe({
      next: () => { this.saving = false; this.showForm = false; this.load(); },
      error: (err) => { this.saving = false; this.error = err?.error?.message || 'Failed to save service.'; },
    });
  }

  remove(s: any): void {
    if (this.deletingId) return;
    if (!confirm(`Delete "${s.name}"?`)) return;
    this.deletingId = s._id;
    this.shopkeeper.deleteService(s._id).subscribe({
      next: () => { this.deletingId = null; this.services = this.services.filter((x) => x._id !== s._id); },
      error: (err) => { this.deletingId = null; this.error = err?.error?.message || 'Failed to delete service.'; },
    });
  }

  goBack(): void {
    this.router.navigate(['/shop/dashboard']);
  }
}
