import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ShopkeeperService } from '../../services/shopkeeper-service';

@Component({
  selector: 'app-shop-categories',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './categories.html',
  styleUrl: './categories.css',
})
export class ShopCategories {
  loading = true;
  error = '';
  categories: any[] = [];

  newName = '';
  adding = false;

  editingId: string | null = null;
  editName = '';
  savingEdit = false;
  deletingId: string | null = null;

  constructor(private shopkeeper: ShopkeeperService, private router: Router) {}

  ngOnInit(): void {
    if (!this.shopkeeper.isLoggedIn()) {
      this.router.navigate(['/shop/login']);
      return;
    }
    this.load();
  }

  load(): void {
    this.loading = true;
    this.shopkeeper.getCategories().subscribe({
      next: (res: any) => {
        this.categories = res?.data ?? [];
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        if (err?.status === 401) {
          this.shopkeeper.logout();
          this.router.navigate(['/shop/login']);
          return;
        }
        this.error = err?.error?.message || 'Failed to load categories.';
      },
    });
  }

  add(): void {
    const name = this.newName.trim();
    if (!name) return;
    this.adding = true;
    this.error = '';
    this.shopkeeper.createCategory(name).subscribe({
      next: () => {
        this.adding = false;
        this.newName = '';
        this.load();
      },
      error: (err) => {
        this.adding = false;
        this.error = err?.error?.message || 'Failed to add category.';
      },
    });
  }

  startEdit(c: any): void {
    this.editingId = c._id;
    this.editName = c.name;
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editName = '';
  }

  saveEdit(c: any): void {
    const name = this.editName.trim();
    if (!name) return;
    this.savingEdit = true;
    this.shopkeeper.updateCategory(c._id, name).subscribe({
      next: () => {
        this.savingEdit = false;
        this.editingId = null;
        this.load();
      },
      error: (err) => {
        this.savingEdit = false;
        this.error = err?.error?.message || 'Failed to rename category.';
      },
    });
  }

  remove(c: any): void {
    if (this.deletingId) return;
    if (!confirm(`Delete category "${c.name}"?`)) return;
    this.deletingId = c._id;
    this.shopkeeper.deleteCategory(c._id).subscribe({
      next: () => {
        this.deletingId = null;
        this.categories = this.categories.filter((x) => x._id !== c._id);
      },
      error: (err) => {
        this.deletingId = null;
        this.error = err?.error?.message || 'Failed to delete category.';
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/shop/dashboard']);
  }
}
