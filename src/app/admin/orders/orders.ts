import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Adminservice } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { LoaderServices } from '../../services/loader-services';

@Component({
  selector: 'app-admin-orders',
  imports: [CommonModule, FormsModule, DatePipe, SideBar],
  templateUrl: './orders.html',
  styleUrl: './orders.css',
})
export class Orders {
  orders: any[] = [];
  total = 0;
  statuses: string[] = ['placed', 'processing', 'shipped', 'delivered', 'cancelled'];
  loading = false;
  error = '';

  // filters
  filterStatus = '';
  search = '';
  fromDate = '';
  toDate = '';

  // row expansion + per-row busy state
  expandedId: string | null = null;
  updatingId: string | null = null;
  deletingId: string | null = null;

  private loader = inject(LoaderServices);

  constructor(
    private adminService: Adminservice,
    private cdr: ChangeDetectorRef,
    private snackbar: Snackbar
  ) {}

  ngOnInit() {
    this.fetchOrders();
  }

  fetchOrders() {
    this.loading = true;
    this.loader.show();
    this.error = '';

    this.adminService
      .getOrders({
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
          this.error = 'Failed to load orders. Please try again.';
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
    this.fetchOrders();
  }

  toggleExpand(order: any) {
    this.expandedId = this.expandedId === order._id ? null : order._id;
  }

  updateStatus(order: any, status: string) {
    if (status === order.status) return;

    this.updatingId = order._id;
    this.adminService.updateOrderStatus(order._id, status).subscribe({
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

  deleteOrder(order: any) {
    if (!window.confirm(`Delete this order by ${order.user_name || 'user'}?`)) return;

    this.deletingId = order._id;
    this.adminService.deleteOrder(order._id).subscribe({
      next: (res: any) => {
        this.deletingId = null;
        this.snackbar.success(res.message || 'Order deleted');
        this.fetchOrders();
      },
      error: (err: any) => {
        this.deletingId = null;
        this.snackbar.error(err?.error?.message || 'Failed to delete order');
        this.cdr.detectChanges();
      },
    });
  }

  clearHistory() {
    if (!window.confirm('Delete ALL order history? This cannot be undone.')) return;

    this.adminService.clearOrders().subscribe({
      next: (res: any) => {
        this.snackbar.success(res.message || 'Order history cleared');
        this.fetchOrders();
      },
      error: (err: any) => {
        this.snackbar.error(err?.error?.message || 'Failed to clear history');
        this.cdr.detectChanges();
      },
    });
  }

  // Stored order_id, with a fallback for orders created before it existed
  orderId(order: any): string {
    return order.order_id || String(order._id).slice(-6).toUpperCase();
  }

  itemsSummary(order: any): string {
    return (order.items || [])
      .map((i: any) => `${i.name} x${i.quantity}`)
      .join('; ');
  }

  addressSummary(order: any): string {
    const a = order.shipping_address;
    if (!a) return '';
    return [a.full_name, a.line1, a.line2, a.city, a.state, a.pincode]
      .filter((v) => v)
      .join(', ');
  }

  // ── Export to Excel-compatible CSV (no external dependency) ──
  exportExcel() {
    if (this.orders.length === 0) {
      this.snackbar.info('No orders to export');
      return;
    }

    const headers = [
      'Order ID',
      'Customer',
      'Phone',
      'Items',
      'Total (₹)',
      'Payment',
      'Status',
      'Address',
      'Date',
    ];

    const rows = this.orders.map((o) => [
      this.orderId(o),
      o.user_name || '',
      o.phone || '',
      this.itemsSummary(o),
      o.total_amount ?? '',
      o.payment_method || '',
      o.status || '',
      this.addressSummary(o),
      o.created_at ? new Date(o.created_at).toLocaleString() : '',
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => this.csvCell(cell)).join(','))
      .join('\r\n');

    // BOM so Excel reads UTF-8 (₹ and names) correctly
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  private csvCell(value: any): string {
    const s = value == null ? '' : String(value);
    // Escape quotes and wrap fields that contain commas/quotes/newlines
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  }
}
