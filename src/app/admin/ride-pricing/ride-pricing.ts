import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Adminservice, PlatformFeeResponse, RidePricingResponse, RidePricingSettings } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { LoaderServices } from '../../services/loader-services';

type PricingForm = Omit<RidePricingSettings, 'updated_at' | 'updated_by'>;

/**
 * Admin page: publish ride ka price kaise banega.
 *
 *   price/seat = (distance ÷ mileage × fuel price) ÷ seats
 *              + (toll plaza × toll per plaza) ÷ toll seats
 *   TrustRide fee alag chhote card se — sirf dikhti hai, price me nahi judti.
 *   ₹10 me round; rider ±rider_adjust tak badal sakta hai.
 *   Toll plaza rider ke chune raaste par OpenStreetMap se gine jaate hain.
 *
 * Neeche live preview — koi bhi distance daal kar dekho price kitna banega.
 * Formula backend (PricingService.calculatePrice) jaisa hi hai; save ke baad
 * asli range server hi lagata hai.
 */
@Component({
  selector: 'app-ride-pricing',
  imports: [CommonModule, FormsModule, SideBar],
  templateUrl: './ride-pricing.html',
  // Layout registration-limit page wala hi — CSS dobara nahi likhi
  styleUrls: ['../registration-limit/registration-limit.css', './ride-pricing.css'],
})
export class RidePricing implements OnInit {
  form: PricingForm = {
    fuel_price_per_litre: 95,
    mileage_kmpl: 15,
    cost_sharing_seats: 3,
    rider_adjust: 50,
    toll_per_plaza: 100,
    toll_sharing_seats: 4,
  };
  limits: RidePricingResponse['limits'] | null = null;
  updatedAt: string | null = null;

  // Live preview — Dehradun → Saharanpur jaisa
  sampleKm = 67;
  sampleTolls = 0;

  loading = true;
  submitting = false;
  error = '';

  // TrustRide fee — alag form, alag save
  fee = 0;
  feeLimits: PlatformFeeResponse['limits'] | null = null;
  feeLoading = true;
  feeSaving = false;
  feeError = '';

  private loader = inject(LoaderServices);

  constructor(
    private adminService: Adminservice,
    private cdr: ChangeDetectorRef,
    private snackbar: Snackbar
  ) {}

  ngOnInit(): void {
    this.load();
    this.loadFee();
  }

  loadFee(): void {
    this.feeLoading = true;
    this.feeError = '';
    this.adminService.getPlatformFee().subscribe({
      next: (res) => this.applyFee(res),
      error: (err) => {
        this.feeLoading = false;
        this.feeError = err?.error?.message || 'Failed to load TrustRide fee.';
        this.cdr.detectChanges();
      },
    });
  }

  saveFee(): void {
    const v = Number(this.fee);
    const L = this.feeLimits?.fee_per_seat;
    if (!Number.isFinite(v) || (L && (v < L.min || v > L.max))) {
      this.feeError = L ? `Fee must be between ₹${L.min} and ₹${L.max}.` : 'Enter a valid fee.';
      return;
    }
    this.feeSaving = true;
    this.feeError = '';
    this.cdr.detectChanges();
    this.adminService.updatePlatformFee(v).subscribe({
      next: (res) => {
        this.feeSaving = false;
        this.applyFee(res);
        this.snackbar.success(res?.message || 'TrustRide fee updated.');
      },
      error: (err) => {
        this.feeSaving = false;
        this.feeError = err?.error?.message || err?.error?.errors?.[0]?.message || 'Failed to update TrustRide fee.';
        this.snackbar.error(this.feeError);
        this.cdr.detectChanges();
      },
    });
  }

  private applyFee(res: PlatformFeeResponse): void {
    this.fee = res.data.fee_per_seat;
    this.feeLimits = res.limits;
    this.feeLoading = false;
    this.cdr.detectChanges();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();

    this.adminService.getRidePricing().subscribe({
      next: (res) => this.apply(res),
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load ride pricing.';
        this.cdr.detectChanges();
      },
    });
  }

  /** Backend ke calculatePrice() jaisa — sirf preview ke liye. */
  get preview() {
    const f = this.form;
    const km = Number(this.sampleKm);
    if (!(km > 0) || !(f.mileage_kmpl > 0) || !(f.cost_sharing_seats > 0)) return null;

    const step = 10;
    const toStep = (n: number) => Math.round(n / step) * step;
    const litres = km / f.mileage_kmpl;
    const fuelCost = litres * f.fuel_price_per_litre;
    const perSeat = fuelCost / f.cost_sharing_seats;
    const tollCost = Math.max(0, Math.round(Number(this.sampleTolls) || 0)) * (Number(f.toll_per_plaza) || 0);
    const tollPerSeat = tollCost / (Number(f.toll_sharing_seats) || 4);
    const suggested = Math.max(10, toStep(perSeat + tollPerSeat));
    const min = Math.max(10, toStep(suggested - (Number(f.rider_adjust) || 0)));
    const max = Math.max(min, toStep(suggested + (Number(f.rider_adjust) || 0)));

    return { litres, fuelCost, perSeat, tollCost, tollPerSeat, suggested, min, max };
  }

  save(): void {
    this.error = '';
    const f = this.form;
    const L = this.limits;

    const fields: [keyof PricingForm, string][] = [
      ['fuel_price_per_litre', 'Fuel price'],
      ['mileage_kmpl', 'Mileage'],
      ['cost_sharing_seats', 'Seats'],
      ['rider_adjust', 'Rider adjustment'],
      ['toll_per_plaza', 'Toll per plaza'],
      ['toll_sharing_seats', 'Toll sharing seats'],
    ];
    for (const [key, label] of fields) {
      const v = Number(f[key]);
      if (!Number.isFinite(v)) {
        this.error = `${label} is required.`;
        return;
      }
      if (L && (v < L[key].min || v > L[key].max)) {
        this.error = `${label} must be between ${L[key].min} and ${L[key].max}.`;
        return;
      }
    }
    if (!Number.isInteger(Number(f.cost_sharing_seats)) || !Number.isInteger(Number(f.toll_sharing_seats))) {
      this.error = 'Seats must be a whole number.';
      return;
    }

    this.submitting = true;
    this.loader.show();
    this.cdr.detectChanges();

    this.adminService
      .updateRidePricing({
        fuel_price_per_litre: Number(f.fuel_price_per_litre),
        mileage_kmpl: Number(f.mileage_kmpl),
        cost_sharing_seats: Number(f.cost_sharing_seats),
        rider_adjust: Number(f.rider_adjust),
        toll_per_plaza: Number(f.toll_per_plaza),
        toll_sharing_seats: Number(f.toll_sharing_seats),
      })
      .subscribe({
        next: (res) => {
          this.submitting = false;
          this.loader.hide();
          this.apply(res);
          this.snackbar.success(res?.message || 'Ride pricing updated.');
        },
        error: (err) => {
          this.submitting = false;
          this.loader.hide();
          this.error =
            err?.error?.message || err?.error?.errors?.[0]?.message || 'Failed to update ride pricing.';
          this.snackbar.error(this.error);
          this.cdr.detectChanges();
        },
      });
  }

  private apply(res: RidePricingResponse): void {
    const d = res.data;
    this.form = {
      fuel_price_per_litre: d.fuel_price_per_litre,
      mileage_kmpl: d.mileage_kmpl,
      cost_sharing_seats: d.cost_sharing_seats,
      rider_adjust: d.rider_adjust,
      toll_per_plaza: d.toll_per_plaza ?? 100,
      toll_sharing_seats: d.toll_sharing_seats ?? 4,
    };
    this.limits = res.limits;
    this.updatedAt = d.updated_at ?? null;
    this.loading = false;
    this.cdr.detectChanges();
  }
}
