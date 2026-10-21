import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { EV_PRICE_UNIT_LABELS, EvPoint, EvPointsService, EvPriceUnit, EvPricing, EvStatus } from '../../services/ev-points';

/*
 * Admin: EV charging points verification + platform price.
 * - Price: ek hi rate sab points par (per hour / per 30 min). Host price nahi likhta.
 * - Pending → approve / reject. Approve tabhi jab lat/lng ho (route par dikhane ke liye).
 *   Link se location na mili ho to "Detect from link" ya manual lat/lng.
 */
@Component({
  selector: 'app-admin-ev-points',
  imports: [CommonModule, FormsModule, SideBar],
  templateUrl: './ev-points.html',
  styleUrls: ['../registration-limit/registration-limit.css', './ev-points.css'],
})
export class AdminEvPoints implements OnInit {
  private evService = inject(EvPointsService);
  private snack = inject(Snackbar);
  private cdr = inject(ChangeDetectorRef);

  // ── pricing ──
  pricing: EvPricing | null = null;
  priceAmount = 100;
  priceUnit: EvPriceUnit = 'hour';
  priceLimits = { min: 0, max: 5000 };
  priceSaving = false;
  readonly priceUnits = Object.entries(EV_PRICE_UNIT_LABELS) as [EvPriceUnit, string][];

  // ── points ──
  tab: EvStatus | 'all' = 'pending';
  counts = { pending: 0, approved: 0, rejected: 0 };
  points: EvPoint[] = [];
  loading = true;
  busyId: string | null = null;

  // inline edits
  latlng: Record<string, { lat: string; lng: string }> = {};
  rejectReason: Record<string, string> = {};
  rejecting: Record<string, boolean> = {};

  ngOnInit(): void {
    this.loadPricing();
    this.load();
  }

  // ── pricing ──
  loadPricing(): void {
    this.evService.adminGetPricing().subscribe({
      next: (res) => {
        this.pricing = res.data;
        this.priceAmount = res.data.amount;
        this.priceUnit = res.data.unit;
        if (res.limits?.amount) this.priceLimits = res.limits.amount;
        this.cdr.markForCheck();
      },
      error: () => {
        /* pricing card bas default dikhayega */
      },
    });
  }

  get pricePreview(): string {
    return `₹${this.priceAmount || 0} / ${this.priceUnit === '30min' ? '30 min' : 'hour'}`;
  }

  get priceDirty(): boolean {
    return !this.pricing || this.pricing.amount !== Number(this.priceAmount) || this.pricing.unit !== this.priceUnit;
  }

  savePricing(): void {
    const amount = Number(this.priceAmount);
    if (!Number.isFinite(amount) || amount < this.priceLimits.min || amount > this.priceLimits.max) {
      this.snack.error(`Amount must be between ₹${this.priceLimits.min} and ₹${this.priceLimits.max}`);
      return;
    }
    this.priceSaving = true;
    this.cdr.markForCheck();
    this.evService.adminSetPricing(amount, this.priceUnit).subscribe({
      next: (res) => {
        this.priceSaving = false;
        this.pricing = res.data;
        this.snack.success(res.message || 'Price saved');
        // points ke price labels refresh
        this.load();
      },
      error: (err) => {
        this.priceSaving = false;
        this.snack.error(err?.error?.message || 'Could not save price');
        this.cdr.markForCheck();
      },
    });
  }

  // ── points ──
  setTab(tab: EvStatus | 'all'): void {
    if (this.tab === tab) return;
    this.tab = tab;
    this.load();
  }

  load(): void {
    this.loading = true;
    this.cdr.markForCheck();
    this.evService.adminList(this.tab).subscribe({
      next: (res) => {
        this.counts = res.counts;
        this.points = res.points;
        if (res.pricing) this.pricing = res.pricing;
        for (const p of this.points) {
          this.latlng[p._id] = { lat: p.lat != null ? String(p.lat) : '', lng: p.lng != null ? String(p.lng) : '' };
        }
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.snack.error(err?.error?.message || 'Failed to load charging points');
        this.cdr.markForCheck();
      },
    });
  }

  approve(p: EvPoint): void {
    const ll = this.latlng[p._id];
    const patch: any = { status: 'approved' };
    if (ll?.lat && ll?.lng) {
      patch.lat = Number(ll.lat);
      patch.lng = Number(ll.lng);
    }
    this.update(p, patch, 'Approved — now visible to drivers');
  }

  startReject(p: EvPoint): void {
    this.rejecting[p._id] = true;
    this.cdr.markForCheck();
  }

  cancelReject(p: EvPoint): void {
    this.rejecting[p._id] = false;
    this.cdr.markForCheck();
  }

  reject(p: EvPoint): void {
    const reason = (this.rejectReason[p._id] ?? '').trim();
    if (!reason) {
      this.snack.error('Enter a reason for rejection');
      return;
    }
    this.update(p, { status: 'rejected', rejection_reason: reason }, 'Rejected');
  }

  backToPending(p: EvPoint): void {
    this.update(p, { status: 'pending' }, 'Moved back to pending');
  }

  saveLocation(p: EvPoint): void {
    const ll = this.latlng[p._id];
    if (!ll?.lat || !ll?.lng) {
      this.snack.error('Enter both lat and lng');
      return;
    }
    this.update(p, { lat: Number(ll.lat), lng: Number(ll.lng) }, 'Location saved');
  }

  detectLocation(p: EvPoint): void {
    this.busyId = p._id;
    this.cdr.markForCheck();
    this.evService.adminRelocate(p._id).subscribe({
      next: (res) => {
        this.busyId = null;
        if (res.success && res.lat != null && res.lng != null) {
          p.lat = res.lat;
          p.lng = res.lng;
          p.location_detected = true;
          this.latlng[p._id] = { lat: String(res.lat), lng: String(res.lng) };
          this.snack.success('Location detected from the link');
        } else {
          this.snack.error(res.message || 'Could not detect location');
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.busyId = null;
        this.snack.error(err?.error?.message || 'Could not detect location');
        this.cdr.markForCheck();
      },
    });
  }

  remove(p: EvPoint): void {
    if (!confirm(`Delete "${p.name}" (${p.city}) permanently?`)) return;
    this.busyId = p._id;
    this.cdr.markForCheck();
    this.evService.adminDelete(p._id).subscribe({
      next: () => {
        this.busyId = null;
        this.snack.success('Deleted');
        this.load();
      },
      error: (err) => {
        this.busyId = null;
        this.snack.error(err?.error?.message || 'Delete failed');
        this.cdr.markForCheck();
      },
    });
  }

  private update(p: EvPoint, patch: any, okMessage: string): void {
    this.busyId = p._id;
    this.cdr.markForCheck();
    this.evService.adminUpdate(p._id, patch).subscribe({
      next: () => {
        this.busyId = null;
        this.rejecting[p._id] = false;
        this.snack.success(okMessage);
        this.load();
      },
      error: (err) => {
        this.busyId = null;
        this.snack.error(err?.error?.message || 'Update failed');
        this.cdr.markForCheck();
      },
    });
  }

  formatDate(d?: string | null): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  }
}
