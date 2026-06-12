import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';
import { Snackbar } from '../../services/snackbar';

interface AddressForm {
  full_name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

@Component({
  selector: 'app-checkout',
  imports: [CommonModule, FormsModule],
  templateUrl: './checkout.html',
  styleUrl: './checkout.css',
})
export class Checkout {
  addresses: any[] = [];
  phone: string | null = null;

  // 'saved' = use a saved address, 'new' = enter a new one
  mode: 'saved' | 'new' = 'saved';
  selectedAddressId: string | null = null;
  setDefault = false;
  form: AddressForm = this.emptyForm();

  // Payment — only Cash on Delivery for now, selected by default
  paymentMethod = 'COD';

  // summary
  totalItems = 0;
  totalAmount = 0;

  loading = false;
  placing = false;
  error = '';

  constructor(
    private marketplace: MarketplaceService,
    private router: Router,
    private snackbar: Snackbar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    if (!this.marketplace.isLoggedIn()) {
      this.router.navigate(['/login'], { queryParams: { returnUrl: '/marketplace/checkout' } });
      return;
    }
    this.load();
  }

  emptyForm(): AddressForm {
    return { full_name: '', line1: '', line2: '', city: '', state: '', pincode: '' };
  }

  load() {
    this.loading = true;
    this.error = '';

    this.marketplace.getAddresses().subscribe({
      next: (res: any) => {
        this.addresses = res.addresses || [];
        this.phone = res.phone ?? null;

        const def = this.addresses.find((a) => a.is_default) || this.addresses[0];
        if (def) {
          this.mode = 'saved';
          this.selectedAddressId = def._id;
        } else {
          // No saved address yet — go straight to the new-address form
          this.mode = 'new';
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Failed to load your addresses.';
        this.cdr.detectChanges();
      },
    });

    // Cart summary (and guard against an empty cart)
    this.marketplace.getCart().subscribe({
      next: (res: any) => {
        this.totalItems = res.total_items ?? 0;
        this.totalAmount = res.total_amount ?? 0;
        this.loading = false;
        if (this.totalItems === 0) {
          this.snackbar.info('Your cart is empty');
          this.router.navigate(['/marketplace/cart']);
        }
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  selectSaved(id: string) {
    this.mode = 'saved';
    this.selectedAddressId = id;
  }

  useNew() {
    this.mode = 'new';
  }

  private validNewAddress(): boolean {
    const required: (keyof AddressForm)[] = ['full_name', 'line1', 'city', 'state', 'pincode'];
    for (const f of required) {
      if (!this.form[f].trim()) {
        this.snackbar.error('Please fill all required address fields');
        return false;
      }
    }
    return true;
  }

  placeOrder() {
    let payload: any;

    if (this.mode === 'saved') {
      if (!this.selectedAddressId) {
        this.snackbar.error('Please select a delivery address');
        return;
      }
      payload = { addressId: this.selectedAddressId };
    } else {
      if (!this.validNewAddress()) return;
      payload = {
        newAddress: {
          full_name: this.form.full_name.trim(),
          line1: this.form.line1.trim(),
          line2: this.form.line2.trim(),
          city: this.form.city.trim(),
          state: this.form.state.trim(),
          pincode: this.form.pincode.trim(),
        },
        setDefault: this.setDefault,
      };
    }

    payload.paymentMethod = this.paymentMethod;

    this.placing = true;
    this.marketplace.checkout(payload).subscribe({
      next: (res: any) => {
        this.placing = false;
        this.snackbar.success(res.message || 'Order placed successfully');
        this.router.navigate(['/marketplace']);
      },
      error: (err: any) => {
        this.placing = false;
        this.snackbar.error(err?.error?.message || 'Checkout failed');
        this.cdr.detectChanges();
      },
    });
  }

  goBack() {
    this.router.navigate(['/marketplace/cart']);
  }
}
