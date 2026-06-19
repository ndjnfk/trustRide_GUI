import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ShopkeeperService } from '../../services/shopkeeper-service';
import { environment } from '../../../../environment';

@Component({
  selector: 'app-shop-products',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './products.html',
  styleUrl: './products.css',
})
export class ShopProducts {
  readonly LOW_STOCK = 5;
  imageBaseUrl = environment.apiUrl;

  loading = true;
  error = '';
  products: any[] = [];
  categories: any[] = [];

  // form state
  showForm = false;
  editingId: string | null = null;
  saving = false;
  form = { name: '', category: '', description: '', price: 0, stock: 0, discount: 0 };
  imageFiles: File[] = [];
  imagePreviews: string[] = [];
  existingImages: string[] = [];

  // Quantity / weight variants — each is a label (e.g. "12g", "50g") with its own price & stock
  hasVariants = false;
  variants: { label: string; price: number; stock: number }[] = [];

  // Size / colour variants — kept separate so a shop opens only what it needs
  hasSizeColor = false;
  colorVariants: { color: string; size: string; price: number; stock: number }[] = [];

  /** any variant scheme enabled? */
  get anyVariants(): boolean {
    return this.hasVariants || this.hasSizeColor;
  }

  get variantStock(): number {
    let s = 0;
    if (this.hasVariants) s += this.variants.reduce((t, v) => t + (Number(v.stock) || 0), 0);
    if (this.hasSizeColor) s += this.colorVariants.reduce((t, v) => t + (Number(v.stock) || 0), 0);
    return s;
  }

  /** live final price after applying the discount % */
  get finalPrice(): number {
    const d = Math.min(Math.max(this.form.discount || 0, 0), 100);
    const p = this.form.price || 0;
    return Math.round((p - (p * d) / 100) * 100) / 100;
  }

  // delete state
  deletingId: string | null = null;

  constructor(private shopkeeper: ShopkeeperService, private router: Router) {}

  ngOnInit(): void {
    if (!this.shopkeeper.isLoggedIn()) {
      this.router.navigate(['/shop/login']);
      return;
    }
    this.load();
    this.loadCategories();
  }

  loadCategories(): void {
    this.shopkeeper.getCategories().subscribe({
      next: (res: any) => (this.categories = res?.data ?? []),
      error: () => { /* dropdown just stays empty */ },
    });
  }

  load(): void {
    this.loading = true;
    this.shopkeeper.getProducts().subscribe({
      next: (res: any) => {
        this.products = res?.data ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 401) {
          this.shopkeeper.logout();
          this.router.navigate(['/shop/login']);
          return;
        }
        this.error = err?.error?.message || 'Failed to load products.';
      },
    });
  }

  openAdd(): void {
    this.editingId = null;
    this.form = { name: '', category: '', description: '', price: 0, stock: 0, discount: 0 };
    this.imageFiles = [];
    this.imagePreviews = [];
    this.existingImages = [];
    this.hasVariants = false;
    this.variants = [];
    this.hasSizeColor = false;
    this.colorVariants = [];
    this.error = '';
    this.showForm = true;
  }

  openEdit(p: any): void {
    this.editingId = p._id;
    this.form = {
      name: p.name ?? '',
      category: p.category ?? '',
      description: p.description ?? '',
      price: p.price ?? 0,
      stock: p.stock ?? 0,
      discount: p.discount ?? 0,
    };
    this.imageFiles = [];
    this.imagePreviews = [];
    this.existingImages = Array.isArray(p.images) ? [...p.images] : (p.image_url ? [p.image_url] : []);

    const rows: any[] = Array.isArray(p.variants) ? p.variants : [];
    // rows carrying a colour/size belong to the size-colour scheme, the rest are quantity/weight
    const colorRows = rows.filter((v) => v.color || v.size);
    const labelRows = rows.filter((v) => !v.color && !v.size);

    this.colorVariants = colorRows.map((v: any) => ({
      color: v.color ?? '',
      size: v.size ?? '',
      price: v.price ?? 0,
      stock: v.stock ?? 0,
    }));
    this.variants = labelRows.map((v: any) => ({
      label: v.label ?? '',
      price: v.price ?? 0,
      stock: v.stock ?? 0,
    }));

    this.hasSizeColor = this.colorVariants.length > 0;
    // quantity/weight is on when the product has variants but no colour/size rows
    this.hasVariants = !!p.has_variants && this.variants.length > 0;
    this.error = '';
    this.showForm = true;
  }

  // ── Quantity / weight variants ──
  toggleVariants(): void {
    this.hasVariants = !this.hasVariants;
    if (this.hasVariants && this.variants.length === 0) this.addVariant();
  }

  addVariant(): void {
    this.variants.push({ label: '', price: this.form.price || 0, stock: 0 });
  }

  removeVariant(i: number): void {
    this.variants.splice(i, 1);
  }

  // ── Size / colour variants ──
  toggleSizeColor(): void {
    this.hasSizeColor = !this.hasSizeColor;
    if (this.hasSizeColor && this.colorVariants.length === 0) this.addColorVariant();
  }

  addColorVariant(): void {
    this.colorVariants.push({ color: '', size: '', price: this.form.price || 0, stock: 0 });
  }

  removeColorVariant(i: number): void {
    this.colorVariants.splice(i, 1);
  }

  cancelForm(): void {
    this.showForm = false;
  }

  onImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!files.length) return;

    for (const file of files) {
      // accept any image the device offers; the API enforces jpg/png/webp on save
      if (file.type && !file.type.startsWith('image/')) {
        this.error = 'Please upload image files only.';
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        this.error = `"${file.name}" is larger than 5MB and was skipped.`;
        continue;
      }
      this.imageFiles.push(file);
      const reader = new FileReader();
      reader.onload = () => this.imagePreviews.push(reader.result as string);
      reader.readAsDataURL(file);
    }
    input.value = ''; // allow re-selecting the same file
  }

  removeNewImage(i: number): void {
    this.imageFiles.splice(i, 1);
    this.imagePreviews.splice(i, 1);
  }

  removeExistingImage(i: number): void {
    this.existingImages.splice(i, 1);
  }

  save(): void {
    this.error = '';
    if (!this.form.name.trim()) { this.error = 'Product name is required.'; return; }
    if (this.form.price < 0 || this.form.price == null) { this.error = 'Enter a valid price.'; return; }
    if (!this.anyVariants && (this.form.stock < 0 || this.form.stock == null)) { this.error = 'Enter a valid stock.'; return; }

    // Build one variants payload from whichever scheme(s) are enabled
    const merged: any[] = [];
    if (this.hasVariants) {
      const weight = this.variants.filter((v) => v.label?.trim());
      if (weight.length === 0) { this.error = 'Add at least one quantity/weight variant (e.g. 12g, 50g).'; return; }
      for (const v of weight) {
        merged.push({ label: v.label.trim(), price: Number(v.price) || 0, stock: Number(v.stock) || 0 });
      }
    }
    if (this.hasSizeColor) {
      const cs = this.colorVariants.filter((v) => v.color?.trim() || v.size?.trim());
      if (cs.length === 0) { this.error = 'Add at least one size/colour variant.'; return; }
      for (const v of cs) {
        const color = v.color?.trim() || '';
        const size = v.size?.trim() || '';
        merged.push({
          label: [color, size].filter(Boolean).join(' / '),
          color,
          size,
          price: Number(v.price) || 0,
          stock: Number(v.stock) || 0,
        });
      }
    }

    const fd = new FormData();
    fd.append('name', this.form.name.trim());
    fd.append('category', this.form.category.trim());
    fd.append('description', this.form.description.trim());
    fd.append('price', String(this.form.price));
    fd.append('stock', String(this.anyVariants ? this.variantStock : this.form.stock));
    fd.append('discount', String(this.form.discount || 0));
    fd.append('has_variants', String(this.anyVariants));
    if (this.anyVariants) fd.append('variants', JSON.stringify(merged));
    // when editing, tell the API which existing images to keep (new files are added on top)
    if (this.editingId) fd.append('existing_images', JSON.stringify(this.existingImages));
    for (const file of this.imageFiles) fd.append('images', file, file.name);

    this.saving = true;
    const req = this.editingId
      ? this.shopkeeper.updateProduct(this.editingId, fd)
      : this.shopkeeper.createProduct(fd);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.showForm = false;
        this.load();
      },
      error: (err) => {
        this.saving = false;
        this.error = err?.error?.message || 'Failed to save product.';
      },
    });
  }

  remove(p: any): void {
    if (this.deletingId) return;
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    this.deletingId = p._id;
    this.shopkeeper.deleteProduct(p._id).subscribe({
      next: () => {
        this.deletingId = null;
        this.products = this.products.filter((x) => x._id !== p._id);
      },
      error: (err) => {
        this.deletingId = null;
        this.error = err?.error?.message || 'Failed to delete product.';
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/shop/dashboard']);
  }
}
