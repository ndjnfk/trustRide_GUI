import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Adminservice, TiffinServicePayload } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { LoaderServices } from '../../services/loader-services';

@Component({
  selector: 'app-admin-tiffin-service',
  imports: [CommonModule, FormsModule, SideBar],
  templateUrl: './tiffin-service.html',
  styleUrl: './tiffin-service.css',
})
export class AdminTiffinService {
  // API ki TIFFIN_SERVICE_CITIES ke saath match karti hai — sirf base cities,
  // baaki sab inke areas hain aur address me chali jaati hain.
  readonly cities: string[] = ['Gurgaon', 'Saharanpur'];

  tiffins: any[] = [];
  total = 0;
  loading = false;
  error = '';

  // create form
  form: TiffinServicePayload = this.emptyForm();
  creating = false;

  // inline edit
  editingId: string | null = null;
  editForm: TiffinServicePayload = this.emptyForm();
  savingId: string | null = null;

  deletingId: string | null = null;
  togglingId: string | null = null;

  // Client-side filters — index poori list ek saath deta hai.
  filterSearch = '';
  filterCity = '';

  // Pagination bhi client-side hi hai (poori list already memory me hai).
  readonly pageSize = 20;
  page = 1;

  // Phone par form khula rehne se list neeche dhakel jaati hai.
  showCreate = false;

  private loader = inject(LoaderServices);

  constructor(
    private adminService: Adminservice,
    private cdr: ChangeDetectorRef,
    private snackbar: Snackbar
  ) {}

  ngOnInit() {
    this.fetchTiffins();
  }

  /** Form rows aur card rows dono isi order me chalti hain. */
  readonly meals = [
    { key: 'breakfast', label: 'Breakfast' },
    { key: 'lunch', label: 'Lunch' },
    { key: 'dinner', label: 'Dinner' },
  ] as const;

  private emptyForm(): TiffinServicePayload {
    return {
      shop_name: '',
      city: this.cities[0],
      whatsapp_number: '',
      address: '',
      price_per_tiffin: null,
      breakfast_start: '',
      breakfast_end: '',
      lunch_start: '',
      lunch_end: '',
      dinner_start: '',
      dinner_end: '',
      is_active: true,
    };
  }

  fetchTiffins() {
    this.loading = true;
    this.loader.show();
    this.error = '';

    this.adminService.getTiffinServices().subscribe({
      next: (res: any) => {
        this.tiffins = res.tiffins || [];
        this.total = res.total ?? this.tiffins.length;
        // Aakhri page ki aakhri entry delete karne ke baad wo page khaali reh
        // jaata hai — wapas valid range me le aao.
        this.clampPage();
        this.loading = false;
        this.loader.hide();
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Failed to load tiffin services. Please try again.';
        this.loading = false;
        this.loader.hide();
        this.cdr.detectChanges();
      },
    });
  }

  get filteredTiffins(): any[] {
    const q = this.filterSearch.trim().toLowerCase();

    return this.tiffins.filter((t) => {
      if (this.filterCity && t.city !== this.filterCity) return false;
      if (!q) return true;

      return [t.shop_name, t.city, t.whatsapp_number, t.address]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }

  get hasActiveFilters(): boolean {
    return !!this.filterSearch.trim() || !!this.filterCity;
  }

  clearFilters() {
    this.filterSearch = '';
    this.filterCity = '';
    this.onFilterChange();
  }

  /** Filter badalne ke baad page 5 par rehna bekaar hai — list hi nayi hai. */
  onFilterChange() {
    this.page = 1;
  }

  /* ── Pagination (20 rows per page) ─────────────────────────
     Poori list ek hi API call me aati hai, isliye slicing yahin hoti hai. */
  get totalPages(): number {
    return Math.max(1, Math.ceil(this.filteredTiffins.length / this.pageSize));
  }

  get pagedTiffins(): any[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredTiffins.slice(start, start + this.pageSize);
  }

  /** "Showing X–Y" ke liye. */
  get pageStart(): number {
    return this.filteredTiffins.length ? (this.page - 1) * this.pageSize + 1 : 0;
  }

  get pageEnd(): number {
    return Math.min(this.page * this.pageSize, this.filteredTiffins.length);
  }

  /** Bahut pages hone par sirf current ke aas-paas ke 5 numbers dikhao. */
  get pageNumbers(): number[] {
    const total = this.totalPages;
    const size = Math.min(5, total);
    let start = Math.max(1, this.page - Math.floor(size / 2));
    start = Math.min(start, total - size + 1);
    return Array.from({ length: size }, (_, i) => start + i);
  }

  get firstShownPage(): number {
    return this.pageNumbers[0];
  }

  get lastShownPage(): number {
    const list = this.pageNumbers;
    return list[list.length - 1];
  }

  goToPage(page: number) {
    const target = Math.min(Math.max(1, page), this.totalPages);
    if (target === this.page) return;

    this.page = target;
    // Edit form doosre page ki row ka khula reh jaata — band kar do.
    this.cancelEdit();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.cdr.detectChanges();
  }

  private clampPage() {
    this.page = Math.min(Math.max(1, this.page), this.totalPages);
  }

  /** Returns an error message, or '' when the form is good to send. */
  private validate(form: TiffinServicePayload): string {
    if (!form.shop_name.trim()) return 'Tiffin service name is required';
    if (!form.city) return 'City is required';
    if (!form.whatsapp_number.trim()) return 'WhatsApp number is required';
    if (!/^[6-9]\d{9}$/.test(form.whatsapp_number.replace(/\D/g, '')))
      return 'WhatsApp number must be a valid 10-digit mobile number';
    if (!form.address.trim()) return 'Address is required';
    // Rate optional hai, par jo bhara hai wo number aur 0 se bada hona chahiye.
    if (form.price_per_tiffin !== null && form.price_per_tiffin !== undefined) {
      const price = Number(form.price_per_tiffin);
      if (Number.isNaN(price) || price < 0) return 'Price per tiffin cannot be negative';
    }
    // Har meal ka window: dono khaali chalega (wo row nahi dikhegi), par aadha
    // bhara hua nahi — card par "7:00 AM – " toota hua dikhta.
    for (const meal of this.meals) {
      const start = ((form as any)[`${meal.key}_start`] || '').trim();
      const end = ((form as any)[`${meal.key}_end`] || '').trim();
      if (!!start !== !!end) {
        return `${meal.label}: enter both start and end time, or leave both blank`;
      }
    }
    return '';
  }

  private clean(form: TiffinServicePayload): TiffinServicePayload {
    // Khaali price input '' deta hai — API ko null hi "rate hata do" hai.
    const rawPrice = form.price_per_tiffin as any;
    const price =
      rawPrice === '' || rawPrice === null || rawPrice === undefined ? null : Number(rawPrice);

    return {
      shop_name: form.shop_name.trim(),
      city: form.city,
      // Admin space/dash/+91 ke saath bhi type kar deta hai — sirf 10 digit bhejo.
      whatsapp_number: form.whatsapp_number.replace(/\D/g, '').slice(-10),
      address: form.address.trim(),
      price_per_tiffin: price,
      // <input type="time"> kabhi "HH:mm:ss" deta hai — API ko HH:mm hi chahiye.
      // Khaali string jaan-boojh kar bhejte hain: wahi "timing hata do" hai.
      ...this.cleanMealTimes(form),
      is_active: form.is_active ?? true,
    };
  }

  /** Teeno meals ke start/end ko HH:mm par trim karta hai. */
  private cleanMealTimes(form: TiffinServicePayload): Record<string, string> {
    const times: Record<string, string> = {};
    for (const meal of this.meals) {
      for (const edge of ['start', 'end'] as const) {
        const field = `${meal.key}_${edge}`;
        times[field] = ((form as any)[field] || '').slice(0, 5);
      }
    }
    return times;
  }

  /** "₹80" — rate na ho to column me "Not set" dikhta hai. */
  formatPrice(t: any): string {
    if (t.price_per_tiffin === null || t.price_per_tiffin === undefined) return '';
    return `₹${t.price_per_tiffin}`;
  }

  /**
   * Table ke Timing column ke liye — sirf wahi meals jinka window bhara hai.
   * Teeno khaali ho to khaali array (column me "Not set" dikhta hai).
   */
  mealTimings(t: any): { label: string; time: string }[] {
    return this.meals
      .map((meal) => ({
        label: meal.label,
        time: this.formatWindow(t?.[`${meal.key}_start`], t?.[`${meal.key}_end`]),
      }))
      .filter((row) => !!row.time);
  }

  /** "09:00"/"11:00" → "9:00 AM – 11:00 AM"; aadha window ho to khaali. */
  private formatWindow(start: any, end: any): string {
    if (!start || !end) return '';
    return `${this.to12Hour(start)} – ${this.to12Hour(end)}`;
  }

  private to12Hour(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
  }

  createTiffin() {
    const problem = this.validate(this.form);
    if (problem) {
      this.snackbar.error(problem);
      return;
    }

    this.creating = true;
    this.adminService.createTiffinService(this.clean(this.form)).subscribe({
      next: (res: any) => {
        this.creating = false;
        this.form = this.emptyForm();
        this.snackbar.success(res.message || 'Tiffin service added');
        this.fetchTiffins();
      },
      error: (err: any) => {
        this.creating = false;
        this.snackbar.error(this.readError(err, 'Failed to add tiffin service'));
        this.cdr.detectChanges();
      },
    });
  }

  startEdit(tiffin: any) {
    this.editingId = tiffin._id;
    this.editForm = {
      shop_name: tiffin.shop_name,
      // Purani entries me `city` khaali ho sakti hai.
      city: tiffin.city || this.cities[0],
      whatsapp_number: tiffin.whatsapp_number,
      address: tiffin.address,
      price_per_tiffin: tiffin.price_per_tiffin ?? null,
      breakfast_start: tiffin.breakfast_start || '',
      breakfast_end: tiffin.breakfast_end || '',
      lunch_start: tiffin.lunch_start || '',
      lunch_end: tiffin.lunch_end || '',
      dinner_start: tiffin.dinner_start || '',
      dinner_end: tiffin.dinner_end || '',
      is_active: tiffin.is_active !== false,
    };
  }

  cancelEdit() {
    this.editingId = null;
    this.editForm = this.emptyForm();
  }

  saveEdit(tiffin: any) {
    const problem = this.validate(this.editForm);
    if (problem) {
      this.snackbar.error(problem);
      return;
    }

    this.savingId = tiffin._id;
    this.adminService.updateTiffinService(tiffin._id, this.clean(this.editForm)).subscribe({
      next: (res: any) => {
        this.savingId = null;
        this.editingId = null;
        this.snackbar.success(res.message || 'Tiffin service updated');
        this.fetchTiffins();
      },
      error: (err: any) => {
        this.savingId = null;
        this.snackbar.error(this.readError(err, 'Failed to update tiffin service'));
        this.cdr.detectChanges();
      },
    });
  }

  /** Hide/show a card on the public page without deleting the entry. */
  toggleActive(tiffin: any) {
    const next = tiffin.is_active === false;

    this.togglingId = tiffin._id;
    this.adminService.updateTiffinService(tiffin._id, { is_active: next }).subscribe({
      next: () => {
        this.togglingId = null;
        tiffin.is_active = next;
        this.snackbar.success(
          next ? 'Tiffin service is now visible' : 'Tiffin service hidden from users'
        );
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.togglingId = null;
        this.snackbar.error(this.readError(err, 'Failed to update tiffin service'));
        this.cdr.detectChanges();
      },
    });
  }

  deleteTiffin(tiffin: any) {
    const confirmDelete = window.confirm(
      `Delete the tiffin service "${tiffin.shop_name}"? This cannot be undone.`
    );
    if (!confirmDelete) return;

    this.deletingId = tiffin._id;
    this.adminService.deleteTiffinService(tiffin._id).subscribe({
      next: (res: any) => {
        this.deletingId = null;
        this.snackbar.success(res.message || 'Tiffin service deleted');
        this.fetchTiffins();
      },
      error: (err: any) => {
        this.deletingId = null;
        this.snackbar.error(this.readError(err, 'Failed to delete tiffin service'));
        this.cdr.detectChanges();
      },
    });
  }

  // AdonisJS validator 422 par { errors: [{ message }] } bhejta hai, baaki jagah { message }.
  private readError(err: any, fallback: string): string {
    return err?.error?.errors?.[0]?.message || err?.error?.message || fallback;
  }
}
