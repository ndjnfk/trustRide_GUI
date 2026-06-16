import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Adminservice } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { LoaderServices } from '../../services/loader-services';
import { environment } from '../../../../environment';

@Component({
  selector: 'app-admin-prescriptions',
  imports: [CommonModule, FormsModule, DatePipe, SideBar],
  templateUrl: './prescriptions.html',
  styleUrl: './prescriptions.css',
})
export class Prescriptions {
  orders: any[] = [];
  total = 0;
  statuses: string[] = ['pending', 'confirmed', 'out_for_delivery', 'delivered', 'cancelled'];
  loading = false;
  error = '';

  // filters
  filterStatus = '';
  search = '';
  fromDate = '';
  toDate = '';

  expandedId: string | null = null;
  updatingId: string | null = null;
  deletingId: string | null = null;

  // base URL so the uploaded prescription file resolves correctly
  imageBase = environment.apiUrl;

  private loader = inject(LoaderServices);

  constructor(
    private adminService: Adminservice,
    private cdr: ChangeDetectorRef,
    private snackbar: Snackbar
  ) {}

  ngOnInit() {
    this.fetchPrescriptions();
  }

  fetchPrescriptions() {
    this.loading = true;
    this.loader.show();
    this.error = '';

    this.adminService
      .getPrescriptions({
        status: this.filterStatus,
        search: this.search,
        from: this.fromDate,
        to: this.toDate,
      })
      .subscribe({
        next: (res: any) => {
          this.orders = res.orders || [];
          this.total = res.total || this.orders.length;
          if (res.statuses?.length) this.statuses = res.statuses;
          this.loading = false;
          this.loader.hide();
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = 'Failed to load prescriptions. Please try again.';
          this.loading = false;
          this.loader.hide();
          this.cdr.detectChanges();
        },
      });
  }

  resetFilters() {
    this.filterStatus = '';
    this.search = '';
    this.fromDate = '';
    this.toDate = '';
    this.fetchPrescriptions();
  }

  toggleExpand(order: any) {
    this.expandedId = this.expandedId === order._id ? null : order._id;
  }

  updateStatus(order: any, status: string) {
    if (status === order.status) return;

    this.updatingId = order._id;
    this.adminService.updatePrescriptionStatus(order._id, status).subscribe({
      next: (res: any) => {
        this.updatingId = null;
        order.status = res.status || status;
        this.snackbar.success(res.message || 'Status updated');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.updatingId = null;
        this.snackbar.error(err?.error?.message || 'Failed to update status');
        this.cdr.detectChanges();
      },
    });
  }

  deletePrescription(order: any) {
    if (!window.confirm(`Delete this prescription order by ${order.full_name || 'user'}?`)) return;

    this.deletingId = order._id;
    this.adminService.deletePrescription(order._id).subscribe({
      next: (res: any) => {
        this.deletingId = null;
        this.snackbar.success(res.message || 'Prescription deleted');
        this.fetchPrescriptions();
      },
      error: (err: any) => {
        this.deletingId = null;
        this.snackbar.error(err?.error?.message || 'Failed to delete prescription');
        this.cdr.detectChanges();
      },
    });
  }

  orderId(order: any): string {
    return order.order_id || String(order._id).slice(-6).toUpperCase();
  }

  addressSummary(order: any): string {
    const a = order.shipping_address;
    if (!a) return '';
    return [a.line1, a.line2, a.city, a.state, a.pincode].filter((v) => v).join(', ');
  }

  isImage(url: string): boolean {
    return /\.(jpg|jpeg|png|webp|gif)$/i.test(url || '');
  }
}
