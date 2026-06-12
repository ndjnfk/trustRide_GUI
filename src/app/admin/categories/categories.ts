import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Adminservice } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { LoaderServices } from '../../services/loader-services';
import { environment } from '../../../../environment';

@Component({
  selector: 'app-categories',
  imports: [CommonModule, FormsModule, SideBar],
  templateUrl: './categories.html',
  styleUrl: './categories.css',
})
export class Categories {
  categories: any[] = [];
  total = 0;
  loading = false;
  error = '';

  // create form
  newCategoryName = '';
  newImage: File | null = null;
  creating = false;

  // inline edit
  editingId: string | null = null;
  editName = '';
  editImage: File | null = null;
  savingId: string | null = null;

  deletingId: string | null = null;

  // base URL so saved images render correctly
  imageBase = environment.apiUrl;

  private loader = inject(LoaderServices);

  constructor(
    private adminService: Adminservice,
    private cdr: ChangeDetectorRef,
    private snackbar: Snackbar
  ) {}

  ngOnInit() {
    this.fetchCategories();
  }

  fetchCategories() {
    this.loading = true;
    this.loader.show();
    this.error = '';

    this.adminService.getCategories().subscribe({
      next: (res: any) => {
        this.categories = res.categories || [];
        this.total = res.total || this.categories.length;
        this.loading = false;
        this.loader.hide();
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Failed to load categories. Please try again.';
        this.loading = false;
        this.loader.hide();
        this.cdr.detectChanges();
      },
    });
  }

  onNewImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.newImage = input.files?.[0] ?? null;
  }

  onEditImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.editImage = input.files?.[0] ?? null;
  }

  createCategory() {
    const name = this.newCategoryName.trim();
    if (!name) {
      this.snackbar.error('Category name is required');
      return;
    }

    this.creating = true;
    this.adminService.createCategory(name, this.newImage).subscribe({
      next: (res: any) => {
        this.creating = false;
        this.newCategoryName = '';
        this.newImage = null;
        this.snackbar.success(res.message || 'Category created');
        this.fetchCategories();
      },
      error: (err: any) => {
        this.creating = false;
        this.snackbar.error(err?.error?.message || 'Failed to create category');
        this.cdr.detectChanges();
      },
    });
  }

  startEdit(category: any) {
    this.editingId = category._id;
    this.editName = category.category_name;
    this.editImage = null;
  }

  cancelEdit() {
    this.editingId = null;
    this.editName = '';
    this.editImage = null;
  }

  saveEdit(category: any) {
    const name = this.editName.trim();
    if (!name) {
      this.snackbar.error('Category name is required');
      return;
    }

    this.savingId = category._id;
    this.adminService.updateCategory(category._id, name, this.editImage).subscribe({
      next: (res: any) => {
        this.savingId = null;
        this.editingId = null;
        this.editImage = null;
        this.snackbar.success(res.message || 'Category updated');
        this.fetchCategories();
      },
      error: (err: any) => {
        this.savingId = null;
        this.snackbar.error(err?.error?.message || 'Failed to update category');
        this.cdr.detectChanges();
      },
    });
  }

  deleteCategory(category: any) {
    const confirmDelete = window.confirm(
      `Do you want to delete the category "${category.category_name}"?`
    );
    if (!confirmDelete) return;

    this.deletingId = category._id;
    this.adminService.deleteCategory(category._id).subscribe({
      next: (res: any) => {
        this.deletingId = null;
        this.snackbar.success(res.message || 'Category deleted');
        this.fetchCategories();
      },
      error: (err: any) => {
        this.deletingId = null;
        this.snackbar.error(err?.error?.message || 'Failed to delete category');
        this.cdr.detectChanges();
      },
    });
  }
}
