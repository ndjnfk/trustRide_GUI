import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';

@Component({
  selector: 'app-marketplace-categories',
  imports: [CommonModule, FormsModule],
  templateUrl: './categories.html',
  styleUrl: './categories.css',
})
export class MarketplaceCategories {
  categories: any[] = [];
  loading = false;
  error = '';
  searchQuery = '';

  get filteredCategories(): any[] {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return this.categories;
    return this.categories.filter(c =>
      (c.category_name || '').toLowerCase().includes(q)
    );
  }

  // The Medical Store is a permanent, stock-less category. It always shows
  // (pinned first), and stays visible while searching for medical keywords.
  get showMedicalStore(): boolean {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) return true;
    return ['medical', 'medicine', 'pharmacy', 'store', 'prescription', 'health']
      .some(k => k.includes(q) || q.includes(k));
  }

  imageBase = inject(MarketplaceService).imageBase;

  constructor(
    private marketplace: MarketplaceService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.fetchCategories();
  }

  fetchCategories() {
    this.loading = true;
    this.error = '';

    this.marketplace.getCategories().subscribe({
      next: (res: any) => {
        this.categories = res.categories || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.error = 'Failed to load categories. Please try again.';
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  openCategory(category: any) {
    this.router.navigate(['/marketplace/category', category._id]);
  }

  openMedicalStore() {
    this.router.navigate(['/marketplace/medical-store']);
  }
}
