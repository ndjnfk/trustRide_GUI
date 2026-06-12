import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MarketplaceService } from '../../services/marketplace-service';

@Component({
  selector: 'app-marketplace-categories',
  imports: [CommonModule],
  templateUrl: './categories.html',
  styleUrl: './categories.css',
})
export class MarketplaceCategories {
  categories: any[] = [];
  loading = false;
  error = '';

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
}
