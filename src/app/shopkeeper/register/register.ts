import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ShopkeeperService } from '../../services/shopkeeper-service';

const SHOP_TYPES = [
  { value: 'product', label: 'Product Based', icon: '📦', desc: 'Sell physical products with stock' },
  { value: 'service', label: 'Service Based', icon: '🛠️', desc: 'Offer services / appointments' },
  { value: 'prescription', label: 'Prescription Based', icon: '💊', desc: 'Medical store — prescription orders' },
];

@Component({
  selector: 'app-shop-register',
  imports: [CommonModule, FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class ShopRegister {
  shopTypes = SHOP_TYPES;

  form = {
    owner_name: '',
    shop_name: '',
    shop_type: '' as '' | 'product' | 'service' | 'prescription',
    address: '',
    phoneNumber: '',
    email: '',
    password: '',
    confirmPassword: '',
  };

  imageFile: File | null = null;
  imagePreview: string | null = null;

  submitting = false;
  error = '';

  constructor(
    private shopkeeper: ShopkeeperService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  selectType(value: 'product' | 'service' | 'prescription') {
    this.form.shop_type = value;
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    const okTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!okTypes.includes(file.type)) {
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
    reader.onload = () => {
      this.imagePreview = reader.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  removeImage(): void {
    this.imageFile = null;
    this.imagePreview = null;
  }

  submit() {
    this.error = '';

    if (!this.form.owner_name.trim()) { this.error = 'Please enter the shop owner name.'; return; }
    if (!this.form.shop_name.trim()) { this.error = 'Please enter the shop name.'; return; }
    if (!this.form.shop_type) { this.error = 'Please select a shop type.'; return; }
    if (!this.form.address.trim()) { this.error = 'Please enter the shop address.'; return; }
    if (!/^[6-9]\d{9}$/.test(this.form.phoneNumber.trim())) {
      this.error = 'Please enter a valid 10-digit mobile number.';
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email.trim())) {
      this.error = 'Please enter a valid email address.';
      return;
    }
    if (this.form.password.length < 8) { this.error = 'Password must be at least 8 characters.'; return; }
    if (this.form.password !== this.form.confirmPassword) { this.error = 'Passwords do not match.'; return; }
    if (!this.imageFile) { this.error = 'Please upload your shop visiting card or board image.'; return; }

    const fd = new FormData();
    fd.append('owner_name', this.form.owner_name.trim());
    fd.append('shop_name', this.form.shop_name.trim());
    fd.append('shop_type', this.form.shop_type);
    fd.append('address', this.form.address.trim());
    fd.append('phoneNumber', this.form.phoneNumber.trim());
    fd.append('email', this.form.email.trim());
    fd.append('password', this.form.password);
    fd.append('shop_image', this.imageFile, this.imageFile.name);

    this.submitting = true;
    this.shopkeeper
      .register(fd)
      .subscribe({
        next: (res: any) => {
          this.submitting = false;
          this.router.navigate(['/shop/login'], {
            queryParams: { registered: '1' },
          });
        },
        error: (err: any) => {
          this.submitting = false;
          this.error = err?.error?.message || 'Registration failed. Please try again.';
          this.cdr.detectChanges();
        },
      });
  }

  goToLogin() {
    this.router.navigate(['/shop/login']);
  }
}
