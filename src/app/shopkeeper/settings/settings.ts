import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ShopkeeperService } from '../../services/shopkeeper-service';
import { environment } from '../../../../environment';

@Component({
  selector: 'app-shop-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class ShopSettings {
  loading = true;
  saving = false;
  error = '';
  success = '';

  imageBaseUrl = environment.apiUrl;

  shopType = '';
  status = '';

  form = {
    shop_name: '',
    owner_name: '',
    address: '',
    phoneNumber: '',
    open_time: '',
    close_time: '',
    is_paused: false,
    cod_enabled: false,
  };

  weekDays = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' },
  ];
  weeklyOffs = new Set<string>();

  existingImageUrl: string | null = null;
  imageFile: File | null = null;
  imagePreview: string | null = null;

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
    this.shopkeeper.me().subscribe({
      next: (res: any) => {
        const s = res?.shop ?? {};
        this.shopType = s.shop_type ?? '';
        this.status = s.status ?? '';
        this.form.shop_name = s.shop_name ?? '';
        this.form.owner_name = s.owner_name ?? '';
        this.form.address = s.address ?? '';
        this.form.phoneNumber = s.phoneNumber ?? '';
        this.form.open_time = s.open_time ?? '';
        this.form.close_time = s.close_time ?? '';
        this.form.is_paused = !!s.is_paused;
        this.form.cod_enabled = !!s.cod_enabled;
        this.weeklyOffs = new Set<string>(Array.isArray(s.weekly_offs) ? s.weekly_offs : []);
        this.existingImageUrl = s.shop_image_url ?? null;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 401) {
          this.shopkeeper.logout();
          this.router.navigate(['/shop/login']);
          return;
        }
        this.error = err?.error?.message || 'Failed to load shop settings.';
      },
    });
  }

  toggleOff(day: string): void {
    if (this.weeklyOffs.has(day)) this.weeklyOffs.delete(day);
    else this.weeklyOffs.add(day);
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
    this.success = '';
    if (!this.form.shop_name.trim()) { this.error = 'Shop name is required.'; return; }
    if (!this.form.owner_name.trim()) { this.error = 'Owner name is required.'; return; }
    if (!this.form.address.trim()) { this.error = 'Shop address is required.'; return; }

    const fd = new FormData();
    fd.append('shop_name', this.form.shop_name.trim());
    fd.append('owner_name', this.form.owner_name.trim());
    fd.append('address', this.form.address.trim());
    fd.append('phoneNumber', this.form.phoneNumber.trim());
    fd.append('open_time', this.form.open_time);
    fd.append('close_time', this.form.close_time);
    fd.append('is_paused', String(this.form.is_paused));
    fd.append('cod_enabled', String(this.form.cod_enabled));
    fd.append('weekly_offs', JSON.stringify([...this.weeklyOffs]));
    if (this.imageFile) fd.append('shop_image', this.imageFile, this.imageFile.name);

    this.saving = true;
    this.shopkeeper.updateSettings(fd).subscribe({
      next: (res: any) => {
        this.saving = false;
        this.success = 'Settings saved successfully.';
        const s = res?.shop;
        if (s) {
          this.existingImageUrl = s.shop_image_url ?? this.existingImageUrl;
          this.imageFile = null;
          this.imagePreview = null;
          // keep cached shop_user in sync for the dashboard header
          try {
            const raw = localStorage.getItem('shop_user');
            const cached = raw ? JSON.parse(raw) : {};
            localStorage.setItem('shop_user', JSON.stringify({
              ...cached,
              shop_name: s.shop_name, owner_name: s.owner_name,
            }));
          } catch { /* ignore */ }
        }
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message || 'Failed to save settings.';
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/shop/dashboard']);
  }
}
