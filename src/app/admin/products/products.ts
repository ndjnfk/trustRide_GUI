import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Adminservice } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { LoaderServices } from '../../services/loader-services';
import { environment } from '../../../../environment';

interface ProductForm {
  name: string;
  description: string;
  price: number | null;
  discount: number | null;
  stock: number | null;
  categoryId: string;
}

@Component({
  selector: 'app-products',
  imports: [CommonModule, FormsModule, SideBar],
  templateUrl: './products.html',
  styleUrl: './products.css',
})
export class Products {
  products: any[] = [];
  categories: any[] = [];
  total = 0;
  loading = false;
  error = '';

  // create / edit form
  showForm = false;
  editingId: string | null = null;
  saving = false;
  form: ProductForm = this.emptyForm();

  // images: newly picked files + already-saved URLs (edit mode)
  newImages: File[] = [];
  existingImages: string[] = [];

  // base URL so saved images render correctly
  imageBase = environment.apiUrl;

  // filters
  searchTerm = '';
  filterCategoryId = '';

  deletingId: string | null = null;

  private loader = inject(LoaderServices);

  constructor(
    private adminService: Adminservice,
    private cdr: ChangeDetectorRef,
    private snackbar: Snackbar
  ) {}

  ngOnInit() {
    this.fetchCategories();
    this.fetchProducts();
  }

  emptyForm(): ProductForm {
    return {
      name: '',
      description: '',
      price: null,
      discount: null,
      stock: null,
      categoryId: '',
    };
  }

  fetchCategories() {
    this.adminService.getCategories().subscribe({
      next: (res: any) => {
        this.categories = res.categories || [];
        this.cdr.detectChanges();
      },
      error: () => {
        // Non-fatal: product list still works, dropdown just stays empty
      },
    });
  }

  fetchProducts() {
    this.loading = true;
    this.loader.show();
    this.error = '';

    this.adminService
      .getProducts({ search: this.searchTerm, categoryId: this.filterCategoryId })
      .subscribe({
        next: (res: any) => {
          this.products = res.products || [];
          this.total = res.total || this.products.length;
          this.loading = false;
          this.loader.hide();
          this.cdr.detectChanges();
        },
        error: () => {
          this.error = 'Failed to load products. Please try again.';
          this.loading = false;
          this.loader.hide();
          this.cdr.detectChanges();
        },
      });
  }

  // ── Form open/close ──────────────────────────────────────
  openCreate() {
    this.editingId = null;
    this.form = this.emptyForm();
    this.newImages = [];
    this.existingImages = [];
    this.showForm = true;
  }

  openEdit(product: any) {
    this.editingId = product._id;
    this.form = {
      name: product.name ?? '',
      description: product.description ?? '',
      price: product.price ?? null,
      discount: product.discount ?? null,
      stock: product.stock ?? null,
      categoryId: product.categoryId ?? '',
    };
    this.newImages = [];
    this.existingImages = [...(product.images || [])];
    this.showForm = true;
  }

  closeForm() {
    this.showForm = false;
    this.editingId = null;
    this.form = this.emptyForm();
    this.newImages = [];
    this.existingImages = [];
  }

  // ── Image picker (single input, multiple files) ──────────
  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    // Append so the user can pick in more than one go
    this.newImages.push(...Array.from(input.files));
    input.value = ''; // allow re-selecting the same file
  }

  removeNewImage(index: number) {
    this.newImages.splice(index, 1);
  }

  removeExistingImage(index: number) {
    this.existingImages.splice(index, 1);
  }

  // ── Build multipart payload from form ────────────────────
  private buildPayload(): FormData {
    const fd = new FormData();
    fd.append('name', this.form.name.trim());
    fd.append('description', this.form.description.trim());
    fd.append('price', String(Number(this.form.price)));
    fd.append('stock', String(Number(this.form.stock)));
    fd.append('categoryId', this.form.categoryId);
    if (this.form.discount !== null && this.form.discount !== undefined) {
      fd.append('discount', String(Number(this.form.discount)));
    }
    // Already-saved images the user chose to keep (edit mode)
    if (this.editingId) {
      fd.append('existing_images', JSON.stringify(this.existingImages));
    }
    // Newly picked files — all under the same "images" field
    this.newImages.forEach((file) => fd.append('images', file, file.name));
    return fd;
  }

  private validForm(): boolean {
    if (!this.form.name.trim()) {
      this.snackbar.error('Product name is required');
      return false;
    }
    if (this.form.price === null || Number(this.form.price) < 0) {
      this.snackbar.error('Valid price is required');
      return false;
    }
    if (this.form.stock === null || Number(this.form.stock) < 0) {
      this.snackbar.error('Valid stock is required');
      return false;
    }
    if (!this.form.categoryId) {
      this.snackbar.error('Please select a category');
      return false;
    }
    if (this.form.discount !== null && Number(this.form.discount) > 100) {
      this.snackbar.error('Discount must be between 0 and 100');
      return false;
    }
    return true;
  }

  saveProduct() {
    if (!this.validForm()) return;

    const payload = this.buildPayload();
    this.saving = true;

    const request$ = this.editingId
      ? this.adminService.updateProduct(this.editingId, payload)
      : this.adminService.createProduct(payload);

    request$.subscribe({
      next: (res: any) => {
        this.saving = false;
        this.snackbar.success(
          res.message || (this.editingId ? 'Product updated' : 'Product created')
        );
        this.closeForm();
        this.fetchProducts();
      },
      error: (err: any) => {
        this.saving = false;
        this.snackbar.error(err?.error?.message || 'Failed to save product');
        this.cdr.detectChanges();
      },
    });
  }

  deleteProduct(product: any) {
    const confirmDelete = window.confirm(`Do you want to delete the product "${product.name}"?`);
    if (!confirmDelete) return;

    this.deletingId = product._id;
    this.adminService.deleteProduct(product._id).subscribe({
      next: (res: any) => {
        this.deletingId = null;
        this.snackbar.success(res.message || 'Product deleted');
        this.fetchProducts();
      },
      error: (err: any) => {
        this.deletingId = null;
        this.snackbar.error(err?.error?.message || 'Failed to delete product');
        this.cdr.detectChanges();
      },
    });
  }

  resetFilters() {
    this.searchTerm = '';
    this.filterCategoryId = '';
    this.fetchProducts();
  }
}
