import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeStyle } from '@angular/platform-browser';
import { Adminservice } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { LoaderServices } from '../../services/loader-services';
import { environment } from '../../../../environment';

interface BannerTheme {
  key: string;
  label: string;
  background: string;
  text: string;
}

interface BannerForm {
  title: string;
  subtitle: string;
  button_label: string;
  button_link: string;
  theme: string;
  image_side: string;
  // Desktop placement
  image_scale: number;
  image_offset_x: number;
  image_offset_y: number;
  // Mobile placement — alag isliye ki chhote banner me wahi scale bahut
  // bada nikalta hai jo desktop par theek lagta hai.
  image_scale_mobile: number;
  image_offset_x_mobile: number;
  image_offset_y_mobile: number;
  show_glow: boolean;
  is_active: boolean;
}

type Device = 'desktop' | 'mobile';

/**
 * Home page banners — admin yahin se banata, edit karta aur hide/show karta hai.
 *
 * Image background-less (transparent) PNG honi chahiye: banner ka rang theme
 * se aata hai, isliye apne background wali image theme ke upar chipki dikhegi.
 */
@Component({
  selector: 'app-admin-banners',
  standalone: true,
  imports: [CommonModule, FormsModule, SideBar],
  templateUrl: './banners.html',
  styleUrl: './banners.css',
})
export class AdminBanners implements OnInit {
  banners: any[] = [];
  themes: BannerTheme[] = [];
  /** Slider ki min/max backend se aati hain — dono jagah alag hone se bachne ke liye. */
  imageLimits: any = {
    scale: { min: 50, max: 180, default: 100 },
    offsetX: { min: -80, max: 80, default: 0 },
    offsetY: { min: -60, max: 60, default: 0 },
  };

  imageLimitsMobile: any = {
    scale: { min: 50, max: 180, default: 100 },
    offsetX: { min: -40, max: 40, default: 0 },
    offsetY: { min: -40, max: 40, default: 0 },
  };

  /**
   * Preview aur placement sliders dono isi se chalte hain — ek hi toggle se
   * "kaunsa device dekh raha hoon" aur "kiske values edit kar raha hoon"
   * dono tay ho jaate hain, isliye galat device ki setting badalne ka
   * mauka hi nahi milta.
   */
  device: Device = 'desktop';

  form: BannerForm = this.emptyForm();
  editingId: string | null = null;
  showForm = false;

  /** Nayi chuni gayi file (abhi upload nahi hui) */
  newImage: File | null = null;
  /** Nayi file ka local preview — object URL */
  newImagePreview: string | null = null;
  /** Edit ke waqt server par pehle se pada image path */
  existingImage: string | null = null;

  loading = false;
  saving = false;
  error = '';

  readonly imageBase = environment.apiUrl;
  private loader = inject(LoaderServices);

  constructor(
    private adminService: Adminservice,
    private cdr: ChangeDetectorRef,
    private snackbar: Snackbar,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit(): void {
    this.fetchBanners();
  }

  emptyForm(): BannerForm {
    return {
      title: '',
      subtitle: '',
      button_label: '',
      button_link: '',
      theme: 'ocean',
      image_side: 'right',
      image_scale: 100,
      image_offset_x: 0,
      image_offset_y: 0,
      image_scale_mobile: 100,
      image_offset_x_mobile: 0,
      image_offset_y_mobile: 0,
      show_glow: true,
      is_active: true,
    };
  }

  fetchBanners(): void {
    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();

    this.adminService.getBanners().subscribe({
      next: (res: any) => {
        this.banners = res?.banners || [];
        this.themes = res?.themes || [];
        if (res?.image_limits) this.imageLimits = res.image_limits;
        if (res?.image_limits_mobile) this.imageLimitsMobile = res.image_limits_mobile;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load banners.';
        this.cdr.detectChanges();
      },
    });
  }

  // ── Form ──────────────────────────────────────────────
  openCreate(): void {
    this.editingId = null;
    this.form = this.emptyForm();
    this.device = 'desktop';
    this.clearPickedImage();
    this.existingImage = null;
    this.showForm = true;
    this.error = '';
    this.cdr.detectChanges();
  }

  openEdit(banner: any): void {
    this.editingId = banner._id;
    this.form = {
      title: banner.title ?? '',
      subtitle: banner.subtitle ?? '',
      button_label: banner.button_label ?? '',
      button_link: banner.button_link ?? '',
      theme: banner.theme ?? 'ocean',
      image_side: banner.image_side ?? 'right',
      image_scale: banner.image_scale ?? 100,
      image_offset_x: banner.image_offset_x ?? 0,
      image_offset_y: banner.image_offset_y ?? 0,
      image_scale_mobile: banner.image_scale_mobile ?? 100,
      image_offset_x_mobile: banner.image_offset_x_mobile ?? 0,
      image_offset_y_mobile: banner.image_offset_y_mobile ?? 0,
      show_glow: banner.show_glow !== false,
      is_active: banner.is_active !== false,
    };
    this.clearPickedImage();
    this.existingImage = banner.image_url ?? null;
    this.showForm = true;
    this.error = '';
    this.cdr.detectChanges();
  }

  closeForm(): void {
    this.showForm = false;
    this.clearPickedImage();
    this.error = '';
    this.cdr.detectChanges();
  }

  onImagePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    if (!file) return;

    this.clearPickedImage();
    this.newImage = file;
    this.newImagePreview = URL.createObjectURL(file);
    this.cdr.detectChanges();
  }

  /** Chuni hui file hatao — object URL revoke karna zaroori hai warna leak hota hai. */
  private clearPickedImage(): void {
    if (this.newImagePreview) URL.revokeObjectURL(this.newImagePreview);
    this.newImage = null;
    this.newImagePreview = null;
  }

  /** Edit me lagi hui image hatana — save par backend ko remove_image jaata hai. */
  removeImage(): void {
    this.clearPickedImage();
    this.existingImage = null;
    this.cdr.detectChanges();
  }

  /** Preview aur cards ke liye — nayi file ho to wahi, warna server wali. */
  previewImage(): string | null {
    if (this.newImagePreview) return this.newImagePreview;
    if (this.existingImage) return this.imageBase + this.existingImage;
    return null;
  }

  activeTheme(): BannerTheme | null {
    return this.themes.find((t) => t.key === this.form.theme) ?? null;
  }

  // ── Image placement ───────────────────────────────────
  get isMobile(): boolean {
    return this.device === 'mobile';
  }

  /** Chune hue device ki limits — sliders ki min/max isse aati hain. */
  get limits(): any {
    return this.isMobile ? this.imageLimitsMobile : this.imageLimits;
  }

  // Sliders seedhe chune hue device ke fields par kaam karte hain, isliye
  // template me har jagah desktop/mobile ka if-else nahi likhna padta.
  get scale(): number {
    return this.isMobile ? this.form.image_scale_mobile : this.form.image_scale;
  }

  get offsetX(): number {
    return this.isMobile ? this.form.image_offset_x_mobile : this.form.image_offset_x;
  }

  get offsetY(): number {
    return this.isMobile ? this.form.image_offset_y_mobile : this.form.image_offset_y;
  }

  /** Range input string deta hai — number me badalna zaroori hai. */
  onScale(value: string): void {
    const n = Number(value);
    if (this.isMobile) this.form.image_scale_mobile = n;
    else this.form.image_scale = n;
  }

  onOffsetX(value: string): void {
    const n = Number(value);
    if (this.isMobile) this.form.image_offset_x_mobile = n;
    else this.form.image_offset_x = n;
  }

  onOffsetY(value: string): void {
    const n = Number(value);
    if (this.isMobile) this.form.image_offset_y_mobile = n;
    else this.form.image_offset_y = n;
  }

  /**
   * Preview ki image par wahi transform lagta hai jo us device par lagega,
   * isliye slider hilate hi asli natija dikh jaata hai — save karke phone par
   * kholna nahi padta.
   */
  previewImageStyle(): SafeStyle {
    return this.sanitizer.bypassSecurityTrustStyle(
      `transform: translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale / 100});`
    );
  }

  /** Slider ghumate-ghumate image kho jaaye to ek click me wapas — sirf isi device ka. */
  resetPlacement(): void {
    if (this.isMobile) {
      this.form.image_scale_mobile = 100;
      this.form.image_offset_x_mobile = 0;
      this.form.image_offset_y_mobile = 0;
    } else {
      this.form.image_scale = 100;
      this.form.image_offset_x = 0;
      this.form.image_offset_y = 0;
    }
    this.cdr.detectChanges();
  }

  /** Desktop par set kiya hua placement mobile par copy kar do — shuruaat ke liye. */
  copyDesktopToMobile(): void {
    this.form.image_scale_mobile = this.form.image_scale;
    // Offsets clamp karo — mobile ki range chhoti hai, warna server clamp
    // karega aur admin ko lagega slider ne value nigal li.
    const x = this.imageLimitsMobile.offsetX;
    const y = this.imageLimitsMobile.offsetY;
    this.form.image_offset_x_mobile = Math.min(Math.max(this.form.image_offset_x, x.min), x.max);
    this.form.image_offset_y_mobile = Math.min(Math.max(this.form.image_offset_y, y.min), y.max);
    this.cdr.detectChanges();
  }

  themeOf(banner: any): BannerTheme | null {
    return this.themes.find((t) => t.key === (banner.theme ?? 'ocean')) ?? null;
  }

  save(): void {
    this.error = '';

    if (!this.form.title.trim()) {
      this.error = 'Banner title is required.';
      return;
    }
    // Aadha button (sirf label ya sirf link) banner par kuch nahi dikhata —
    // isliye yahin rok dete hain, baad me "button kyun nahi aaya" se behtar hai.
    const label = this.form.button_label.trim();
    const link = this.form.button_link.trim();
    if ((label && !link) || (!label && link)) {
      this.error = 'Button needs both a label and a link — or leave both empty.';
      return;
    }

    const fd = new FormData();
    fd.append('title', this.form.title.trim());
    fd.append('subtitle', this.form.subtitle.trim());
    fd.append('button_label', label);
    fd.append('button_link', link);
    fd.append('theme', this.form.theme);
    fd.append('image_side', this.form.image_side);
    fd.append('image_scale', String(this.form.image_scale));
    fd.append('image_offset_x', String(this.form.image_offset_x));
    fd.append('image_offset_y', String(this.form.image_offset_y));
    fd.append('image_scale_mobile', String(this.form.image_scale_mobile));
    fd.append('image_offset_x_mobile', String(this.form.image_offset_x_mobile));
    fd.append('image_offset_y_mobile', String(this.form.image_offset_y_mobile));
    fd.append('show_glow', String(this.form.show_glow));
    fd.append('is_active', String(this.form.is_active));
    if (this.newImage) fd.append('image', this.newImage, this.newImage.name);
    if (this.editingId && !this.newImage && !this.existingImage) {
      fd.append('remove_image', 'true');
    }

    this.saving = true;
    this.loader.show();
    this.cdr.detectChanges();

    const request$ = this.editingId
      ? this.adminService.updateBanner(this.editingId, fd)
      : this.adminService.createBanner(fd);

    request$.subscribe({
      next: (res: any) => {
        this.saving = false;
        this.loader.hide();
        this.snackbar.success(res?.message || 'Banner saved.');
        this.showForm = false;
        this.clearPickedImage();
        this.fetchBanners();
      },
      error: (err: any) => {
        this.saving = false;
        this.loader.hide();
        this.error =
          err?.error?.message ||
          err?.error?.errors?.[0]?.message ||
          'Failed to save the banner.';
        this.snackbar.error(this.error);
        this.cdr.detectChanges();
      },
    });
  }

  // ── List actions ──────────────────────────────────────
  toggle(banner: any): void {
    this.adminService.toggleBanner(banner._id).subscribe({
      next: (res: any) => {
        banner.is_active = res?.is_active;
        this.snackbar.success(res?.message || 'Updated.');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.snackbar.error(err?.error?.message || 'Could not update the banner.');
      },
    });
  }

  remove(banner: any): void {
    if (!confirm(`Delete the banner "${banner.title}"? This cannot be undone.`)) return;

    this.adminService.deleteBanner(banner._id).subscribe({
      next: (res: any) => {
        this.snackbar.success(res?.message || 'Banner deleted.');
        this.fetchBanners();
      },
      error: (err: any) => {
        this.snackbar.error(err?.error?.message || 'Could not delete the banner.');
      },
    });
  }
}
