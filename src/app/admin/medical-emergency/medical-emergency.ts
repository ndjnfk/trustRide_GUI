import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Adminservice, MedicalEmergencyPayload } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { LoaderServices } from '../../services/loader-services';

@Component({
  selector: 'app-admin-medical-emergency',
  imports: [CommonModule, FormsModule, SideBar],
  templateUrl: './medical-emergency.html',
  styleUrl: './medical-emergency.css',
})
export class MedicalEmergency {
  // API ki MEDICAL_EMERGENCY_CITIES ke saath match karti hai — sirf base cities,
  // baaki sab inke areas hain aur address me chali jaati hain.
  readonly cities: string[] = ['Gurgaon', 'Saharanpur', 'Chandigarh', 'Mohali'];

  pharmacies: any[] = [];
  total = 0;
  loading = false;
  error = '';

  // create form
  form: MedicalEmergencyPayload = this.emptyForm();
  creating = false;

  // inline edit
  editingId: string | null = null;
  editForm: MedicalEmergencyPayload = this.emptyForm();
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
    this.fetchPharmacies();
  }

  private emptyForm(): MedicalEmergencyPayload {
    return {
      shop_name: '',
      city: this.cities[0],
      whatsapp_number: '',
      address: '',
      open_time: '',
      close_time: '',
      is_active: true,
    };
  }

  fetchPharmacies() {
    this.loading = true;
    this.loader.show();
    this.error = '';

    this.adminService.getMedicalEmergencyPharmacies().subscribe({
      next: (res: any) => {
        this.pharmacies = res.pharmacies || [];
        this.total = res.total ?? this.pharmacies.length;
        // Aakhri page ki aakhri entry delete karne ke baad wo page khaali reh
        // jaata hai — wapas valid range me le aao.
        this.clampPage();
        this.loading = false;
        this.loader.hide();
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Failed to load pharmacies. Please try again.';
        this.loading = false;
        this.loader.hide();
        this.cdr.detectChanges();
      },
    });
  }

  get filteredPharmacies(): any[] {
    const q = this.filterSearch.trim().toLowerCase();

    return this.pharmacies.filter((p) => {
      if (this.filterCity && p.city !== this.filterCity) return false;
      if (!q) return true;

      return [p.shop_name, p.city, p.whatsapp_number, p.address]
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
    return Math.max(1, Math.ceil(this.filteredPharmacies.length / this.pageSize));
  }

  get pagedPharmacies(): any[] {
    const start = (this.page - 1) * this.pageSize;
    return this.filteredPharmacies.slice(start, start + this.pageSize);
  }

  /** "Showing X–Y" ke liye. */
  get pageStart(): number {
    return this.filteredPharmacies.length ? (this.page - 1) * this.pageSize + 1 : 0;
  }

  get pageEnd(): number {
    return Math.min(this.page * this.pageSize, this.filteredPharmacies.length);
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
  private validate(form: MedicalEmergencyPayload): string {
    if (!form.shop_name.trim()) return 'Pharmacy name is required';
    if (!form.city) return 'City is required';
    if (!form.whatsapp_number.trim()) return 'WhatsApp number is required';
    if (!/^[6-9]\d{9}$/.test(form.whatsapp_number.replace(/\D/g, '')))
      return 'WhatsApp number must be a valid 10-digit mobile number';
    if (!form.address.trim()) return 'Address is required';
    // Dono khaali chalega (timing nahi dikhegi), par aadha bhara hua nahi.
    const open = (form.open_time || '').trim();
    const close = (form.close_time || '').trim();
    if (!!open !== !!close) return 'Enter both opening and closing time, or leave both blank';
    return '';
  }

  private clean(form: MedicalEmergencyPayload): MedicalEmergencyPayload {
    return {
      shop_name: form.shop_name.trim(),
      city: form.city,
      // Admin space/dash/+91 ke saath bhi type kar deta hai — sirf 10 digit bhejo.
      whatsapp_number: form.whatsapp_number.replace(/\D/g, '').slice(-10),
      address: form.address.trim(),
      // <input type="time"> kabhi "HH:mm:ss" deta hai — API ko HH:mm hi chahiye.
      // Khaali string jaan-boojh kar bhejte hain: wahi "timing hata do" hai.
      open_time: (form.open_time || '').slice(0, 5),
      close_time: (form.close_time || '').slice(0, 5),
      is_active: form.is_active ?? true,
    };
  }

  /** "09:00" → "9:00 AM"; dono khaali ho to card par row hi nahi dikhti. */
  formatTiming(p: any): string {
    if (!p.open_time || !p.close_time) return '';
    return `${this.to12Hour(p.open_time)} – ${this.to12Hour(p.close_time)}`;
  }

  private to12Hour(hhmm: string): string {
    const [h, m] = hhmm.split(':').map(Number);
    const suffix = h >= 12 ? 'PM' : 'AM';
    const hour = h % 12 || 12;
    return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
  }

  createPharmacy() {
    const problem = this.validate(this.form);
    if (problem) {
      this.snackbar.error(problem);
      return;
    }

    this.creating = true;
    this.adminService.createMedicalEmergencyPharmacy(this.clean(this.form)).subscribe({
      next: (res: any) => {
        this.creating = false;
        this.form = this.emptyForm();
        this.snackbar.success(res.message || 'Pharmacy added');
        this.fetchPharmacies();
      },
      error: (err: any) => {
        this.creating = false;
        this.snackbar.error(this.readError(err, 'Failed to add pharmacy'));
        this.cdr.detectChanges();
      },
    });
  }

  startEdit(pharmacy: any) {
    this.editingId = pharmacy._id;
    this.editForm = {
      shop_name: pharmacy.shop_name,
      // City feature se pehle bani entries me `city` khaali hoti hai.
      city: pharmacy.city || this.cities[0],
      whatsapp_number: pharmacy.whatsapp_number,
      address: pharmacy.address,
      open_time: pharmacy.open_time || '',
      close_time: pharmacy.close_time || '',
      is_active: pharmacy.is_active !== false,
    };
  }

  cancelEdit() {
    this.editingId = null;
    this.editForm = this.emptyForm();
  }

  saveEdit(pharmacy: any) {
    const problem = this.validate(this.editForm);
    if (problem) {
      this.snackbar.error(problem);
      return;
    }

    this.savingId = pharmacy._id;
    this.adminService
      .updateMedicalEmergencyPharmacy(pharmacy._id, this.clean(this.editForm))
      .subscribe({
        next: (res: any) => {
          this.savingId = null;
          this.editingId = null;
          this.snackbar.success(res.message || 'Pharmacy updated');
          this.fetchPharmacies();
        },
        error: (err: any) => {
          this.savingId = null;
          this.snackbar.error(this.readError(err, 'Failed to update pharmacy'));
          this.cdr.detectChanges();
        },
      });
  }

  /** Hide/show a card on the public page without deleting the entry. */
  toggleActive(pharmacy: any) {
    const next = pharmacy.is_active === false;

    this.togglingId = pharmacy._id;
    this.adminService
      .updateMedicalEmergencyPharmacy(pharmacy._id, { is_active: next })
      .subscribe({
        next: () => {
          this.togglingId = null;
          pharmacy.is_active = next;
          this.snackbar.success(next ? 'Pharmacy is now visible' : 'Pharmacy hidden from users');
          this.cdr.detectChanges();
        },
        error: (err: any) => {
          this.togglingId = null;
          this.snackbar.error(this.readError(err, 'Failed to update pharmacy'));
          this.cdr.detectChanges();
        },
      });
  }

  deletePharmacy(pharmacy: any) {
    const confirmDelete = window.confirm(
      `Delete the pharmacy "${pharmacy.shop_name}"? This cannot be undone.`
    );
    if (!confirmDelete) return;

    this.deletingId = pharmacy._id;
    this.adminService.deleteMedicalEmergencyPharmacy(pharmacy._id).subscribe({
      next: (res: any) => {
        this.deletingId = null;
        this.snackbar.success(res.message || 'Pharmacy deleted');
        this.fetchPharmacies();
      },
      error: (err: any) => {
        this.deletingId = null;
        this.snackbar.error(this.readError(err, 'Failed to delete pharmacy'));
        this.cdr.detectChanges();
      },
    });
  }

  // AdonisJS validator 422 par { errors: [{ message }] } bhejta hai, baaki jagah { message }.
  private readError(err: any, fallback: string): string {
    return err?.error?.errors?.[0]?.message || err?.error?.message || fallback;
  }
}
