import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';

// City/state/pincode are fixed to the serviceable area and not user-editable.
const FIXED_LOCATION = { city: 'Saharanpur', state: 'Uttar Pradesh', pincode: '247001' };

@Component({
  selector: 'app-medical-store',
  imports: [CommonModule, FormsModule],
  templateUrl: './medical-store.html',
  styleUrl: './medical-store.css',
})
export class MedicalStore {
  fixedLocation = FIXED_LOCATION;

  form = {
    full_name: '',
    phone: '',
    line1: '',
    line2: '',
    city: FIXED_LOCATION.city,
    state: FIXED_LOCATION.state,
    pincode: FIXED_LOCATION.pincode,
    notes: '',
  };

  file: File | null = null;
  filePreview: string | null = null;

  submitting = false;
  submitted = false;
  error = '';

  /** when uploaded from a specific pharmacy shop page */
  shopId: string | null = null;

  constructor(
    private marketplace: MarketplaceService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.shopId = this.route.snapshot.queryParamMap.get('shopId');
    if (!this.marketplace.isLoggedIn()) {
      const returnUrl = this.shopId
        ? `/marketplace/medical-store?shopId=${this.shopId}`
        : '/marketplace/medical-store';
      this.router.navigate(['/login'], { queryParams: { returnUrl } });
      return;
    }
    this.prefillFromSavedAddress();
  }

  // Prefill the form from the user's default saved address, if any.
  private prefillFromSavedAddress() {
    this.marketplace.getAddresses().subscribe({
      next: (res: any) => {
        if (res.phone) this.form.phone = res.phone;
        const list = res.addresses || res.data || [];
        const def = list.find((a: any) => a.is_default) || list[0];
        if (def) {
          this.form.full_name = def.full_name || this.form.full_name;
          this.form.line1 = def.line1 || '';
          this.form.line2 = def.line2 || '';
          // city/state/pincode stay fixed to the serviceable area
          this.cdr.detectChanges();
        }
      },
      error: () => {}, // prefill is best-effort
    });
  }

  onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const f = input.files?.[0] ?? null;
    this.file = f;
    this.filePreview = null;

    if (f && f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        this.filePreview = reader.result as string;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(f);
    }
  }

  clearFile() {
    this.file = null;
    this.filePreview = null;
  }

  submit() {
    this.error = '';

    if (!this.form.full_name.trim()) { this.error = 'Please enter your full name.'; return; }
    if (!this.form.phone.trim()) { this.error = 'Please enter your phone number.'; return; }
    if (!this.form.line1.trim()) {
      this.error = 'Please complete your delivery address.';
      return;
    }
    if (!this.file) { this.error = 'Please upload your prescription.'; return; }

    const fd = new FormData();
    fd.append('full_name', this.form.full_name.trim());
    fd.append('phone', this.form.phone.trim());
    fd.append('line1', this.form.line1.trim());
    fd.append('line2', this.form.line2.trim());
    // City/state/pincode are fixed to the serviceable area.
    fd.append('city', FIXED_LOCATION.city);
    fd.append('state', FIXED_LOCATION.state);
    fd.append('pincode', FIXED_LOCATION.pincode);
    fd.append('notes', this.form.notes.trim());
    if (this.shopId) fd.append('shop_id', this.shopId);
    fd.append('prescription', this.file, this.file.name);

    this.submitting = true;
    this.marketplace.submitPrescription(fd).subscribe({
      next: () => {
        this.submitting = false;
        this.submitted = true;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.submitting = false;
        this.error = err?.error?.message || 'Failed to submit prescription. Please try again.';
        this.cdr.detectChanges();
      },
    });
  }

  goBack() {
    this.router.navigate(['/marketplace']);
  }

  goToOrders() {
    this.router.navigate(['/marketplace/orders']);
  }
}
