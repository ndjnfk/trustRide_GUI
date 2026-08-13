import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Adminservice, BlablaRidePayload } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { LoaderServices } from '../../services/loader-services';

@Component({
  selector: 'app-admin-blabla-rides',
  imports: [CommonModule, FormsModule, SideBar],
  templateUrl: './blabla-rides.html',
  styleUrl: './blabla-rides.css',
})
export class BlablaRides {
  // Sirf ye do base cities — baaki sab inhi ke areas hain.
  readonly cities: string[] = ['Gurgaon', 'Saharanpur'];

  rides: any[] = [];
  total = 0;
  loading = false;
  error = '';

  // create form
  form: BlablaRidePayload = this.emptyForm();
  creating = false;

  // inline edit
  editingId: string | null = null;
  editForm: BlablaRidePayload = this.emptyForm();
  savingId: string | null = null;

  deletingId: string | null = null;

  // ── Filters (sab client-side — index poori list ek saath deta hai) ──
  filterSearch = '';                                 // rider name / URL / route
  filterSource = '';
  filterDestination = '';
  filterFromDate = '';                               // YYYY-MM-DD
  filterToDate = '';                                 // YYYY-MM-DD
  filterScope: 'all' | 'past' | 'upcoming' = 'all';

  // ── Bulk selection ──
  selectedIds = new Set<string>();
  bulkDeleting = false;

  // Dono panels default band — phone par khule rehne se list neeche dhakel jaati hai.
  showCreate = false;
  showFilters = false;

  private loader = inject(LoaderServices);

  constructor(
    private adminService: Adminservice,
    private cdr: ChangeDetectorRef,
    private snackbar: Snackbar
  ) {}

  ngOnInit() {
    this.fetchRides();
  }

  private emptyForm(): BlablaRidePayload {
    return {
      source: 'Gurgaon',
      destination: 'Saharanpur',
      ride_date: '',
      ride_time: '',
      url: '',
      rider_name: '',
    };
  }

  fetchRides() {
    this.loading = true;
    this.loader.show();
    this.error = '';

    this.adminService.getBlablaRides().subscribe({
      next: (res: any) => {
        this.rides = res.rides || [];
        this.total = res.total ?? this.rides.length;
        // Jo rides ab list me hain hi nahi, unka selection rakhne ka matlab nahi.
        this.pruneSelection();
        this.loading = false;
        this.loader.hide();
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Failed to load BlaBla rides. Please try again.';
        this.loading = false;
        this.loader.hide();
        this.cdr.detectChanges();
      },
    });
  }

  // ── Filtering ─────────────────────────────────────────────
  /** IST today (YYYY-MM-DD) — ride_date IST convention me hi store hoti hai. */
  private get istToday(): string {
    return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  /** Loaded rides me se unique sources (dropdown ke liye). */
  get sourceOptions(): string[] {
    return Array.from(new Set(this.rides.map((r) => r.source).filter(Boolean))).sort();
  }

  get destinationOptions(): string[] {
    return Array.from(new Set(this.rides.map((r) => r.destination).filter(Boolean))).sort();
  }

  get filteredRides(): any[] {
    const q = this.filterSearch.trim().toLowerCase();
    const today = this.istToday;

    return this.rides.filter((r) => {
      const date: string = r.ride_date ?? '';

      // Text search — rider, URL ya route me se kahin bhi.
      if (q) {
        const haystack = [r.rider_name, r.url, r.source, r.destination, `${r.source} → ${r.destination}`]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (this.filterSource && r.source !== this.filterSource) return false;
      if (this.filterDestination && r.destination !== this.filterDestination) return false;

      if (this.filterFromDate && date < this.filterFromDate) return false;
      if (this.filterToDate && date > this.filterToDate) return false;

      if (this.filterScope === 'past' && !(date < today)) return false;
      if (this.filterScope === 'upcoming' && !(date >= today)) return false;

      return true;
    });
  }

  /** Kitne filters lage hain — button ke badge me dikhta hai (panel band ho tab bhi pata rahe). */
  get activeFilterCount(): number {
    return [
      this.filterSearch.trim(),
      this.filterSource,
      this.filterDestination,
      this.filterFromDate,
      this.filterToDate,
      this.filterScope !== 'all' ? this.filterScope : '',
    ].filter(Boolean).length;
  }

  get hasActiveFilters(): boolean {
    return this.activeFilterCount > 0;
  }

  /**
   * Filter badalne par chhupi hui rows ka selection hata do — warna
   * "Delete selected" wo rides bhi uda deta jo screen par dikh hi nahi rahi.
   */
  onFilterChange() {
    this.pruneSelection();
  }

  clearFilters() {
    this.filterSearch = '';
    this.filterSource = '';
    this.filterDestination = '';
    this.filterFromDate = '';
    this.filterToDate = '';
    this.filterScope = 'all';
  }

  // ── Bulk selection ────────────────────────────────────────
  private pruneSelection() {
    const visible = new Set(this.filteredRides.map((r) => r._id));
    for (const id of Array.from(this.selectedIds)) {
      if (!visible.has(id)) this.selectedIds.delete(id);
    }
  }

  isSelected(ride: any): boolean {
    return this.selectedIds.has(ride._id);
  }

  toggleOne(ride: any, checked: boolean) {
    if (checked) this.selectedIds.add(ride._id);
    else this.selectedIds.delete(ride._id);
  }

  /** Header checkbox — sirf filtered (visible) rows par kaam karta hai. */
  toggleAllVisible(checked: boolean) {
    for (const ride of this.filteredRides) {
      if (checked) this.selectedIds.add(ride._id);
      else this.selectedIds.delete(ride._id);
    }
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  get allVisibleSelected(): boolean {
    const list = this.filteredRides;
    return list.length > 0 && list.every((r) => this.selectedIds.has(r._id));
  }

  get someVisibleSelected(): boolean {
    const list = this.filteredRides;
    return list.some((r) => this.selectedIds.has(r._id)) && !this.allVisibleSelected;
  }

  clearSelection() {
    this.selectedIds.clear();
  }

  bulkDelete() {
    const ids = this.filteredRides.filter((r) => this.selectedIds.has(r._id)).map((r) => r._id);
    if (!ids.length || this.bulkDeleting) return;

    const confirmDelete = window.confirm(
      `Delete ${ids.length} BlaBla ride${ids.length === 1 ? '' : 's'}? This cannot be undone.`
    );
    if (!confirmDelete) return;

    this.bulkDeleting = true;
    this.adminService.bulkDeleteBlablaRides(ids).subscribe({
      next: (res: any) => {
        this.bulkDeleting = false;
        this.selectedIds.clear();
        // Jo ride edit ho rahi thi wo shayad ab hai hi nahi — form band kar do.
        this.cancelEdit();
        this.snackbar.success(res.message || `${ids.length} BlaBla rides deleted`);
        this.fetchRides();
      },
      error: (err: any) => {
        this.bulkDeleting = false;
        this.snackbar.error(this.readError(err, 'Failed to delete selected rides'));
        this.cdr.detectChanges();
      },
    });
  }

  // Source badalte hi doosri city destination me daal do — sirf do hi routes hain.
  onSourceChange(form: BlablaRidePayload) {
    form.destination = form.source === 'Gurgaon' ? 'Saharanpur' : 'Gurgaon';
  }

  onDestinationChange(form: BlablaRidePayload) {
    form.source = form.destination === 'Gurgaon' ? 'Saharanpur' : 'Gurgaon';
  }

  /** Returns an error message, or '' when the form is good to send. */
  private validate(form: BlablaRidePayload): string {
    if (!form.source || !form.destination) return 'Source and destination are required';
    if (form.source === form.destination) return 'Source and destination cannot be the same city';
    if (!form.ride_date) return 'Date is required';
    if (!form.ride_time) return 'Time is required';
    if (!form.rider_name.trim()) return 'Rider name is required';
    if (!form.url.trim()) return 'URL is required';
    if (!/^https?:\/\/.+/i.test(form.url.trim())) return 'URL must start with http:// or https://';
    return '';
  }

  private clean(form: BlablaRidePayload): BlablaRidePayload {
    return {
      source: form.source,
      destination: form.destination,
      ride_date: form.ride_date,
      // <input type="time"> kabhi "HH:mm:ss" deta hai — API ko HH:mm hi chahiye.
      ride_time: form.ride_time.slice(0, 5),
      url: form.url.trim(),
      rider_name: form.rider_name.trim(),
    };
  }

  createRide() {
    const problem = this.validate(this.form);
    if (problem) {
      this.snackbar.error(problem);
      return;
    }

    this.creating = true;
    this.adminService.createBlablaRide(this.clean(this.form)).subscribe({
      next: (res: any) => {
        this.creating = false;
        this.form = this.emptyForm();
        this.snackbar.success(res.message || 'BlaBla ride added');
        this.fetchRides();
      },
      error: (err: any) => {
        this.creating = false;
        this.snackbar.error(this.readError(err, 'Failed to add BlaBla ride'));
        this.cdr.detectChanges();
      },
    });
  }

  startEdit(ride: any) {
    this.editingId = ride._id;
    this.editForm = {
      source: ride.source,
      destination: ride.destination,
      ride_date: ride.ride_date,
      ride_time: ride.ride_time,
      url: ride.url,
      rider_name: ride.rider_name,
    };
  }

  cancelEdit() {
    this.editingId = null;
    this.editForm = this.emptyForm();
  }

  saveEdit(ride: any) {
    const problem = this.validate(this.editForm);
    if (problem) {
      this.snackbar.error(problem);
      return;
    }

    this.savingId = ride._id;
    this.adminService.updateBlablaRide(ride._id, this.clean(this.editForm)).subscribe({
      next: (res: any) => {
        this.savingId = null;
        this.editingId = null;
        this.snackbar.success(res.message || 'BlaBla ride updated');
        this.fetchRides();
      },
      error: (err: any) => {
        this.savingId = null;
        this.snackbar.error(this.readError(err, 'Failed to update BlaBla ride'));
        this.cdr.detectChanges();
      },
    });
  }

  deleteRide(ride: any) {
    const confirmDelete = window.confirm(
      `Delete the BlaBla ride "${ride.source} → ${ride.destination}" on ${ride.ride_date}?`
    );
    if (!confirmDelete) return;

    this.deletingId = ride._id;
    this.adminService.deleteBlablaRide(ride._id).subscribe({
      next: (res: any) => {
        this.deletingId = null;
        this.selectedIds.delete(ride._id);
        this.snackbar.success(res.message || 'BlaBla ride deleted');
        this.fetchRides();
      },
      error: (err: any) => {
        this.deletingId = null;
        this.snackbar.error(this.readError(err, 'Failed to delete BlaBla ride'));
        this.cdr.detectChanges();
      },
    });
  }

  // AdonisJS validator 422 par { errors: [{ message }] } bhejta hai, baaki jagah { message }.
  private readError(err: any, fallback: string): string {
    return err?.error?.errors?.[0]?.message || err?.error?.message || fallback;
  }

  formatDateTime(ride: any): string {
    if (!ride.ride_date || !ride.ride_time) return '—';
    const d = new Date(`${ride.ride_date}T${ride.ride_time}:00.000Z`);
    return d.toLocaleString('en-IN', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'UTC',
    });
  }
}
