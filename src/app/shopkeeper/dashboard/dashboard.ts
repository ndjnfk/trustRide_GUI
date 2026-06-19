import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { ShopkeeperService } from '../../services/shopkeeper-service';

interface ShopFeature {
  icon: string;
  title: string;
  desc: string;
  route?: string;   // set when the feature page exists
  soon?: boolean;   // true = "Coming soon" badge
}

interface TypeBlock {
  label: string;
  features: ShopFeature[];
}

@Component({
  selector: 'app-shop-dashboard',
  imports: [CommonModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class ShopDashboard {
  shop: any = null;

  constructor(private shopkeeper: ShopkeeperService, private router: Router) {}

  // ── Shared features — every shop type gets these ──
  readonly sharedFeatures: ShopFeature[] = [
    { icon: '🏪', title: 'Shop Profile & KYC', desc: 'Name, address, banner/logo & documents', route: '/shop/settings' },
    
    { icon: '🔔', title: 'Notifications', desc: 'New / cancelled order alerts on email', soon: true },
    { icon: '⭐', title: 'Ratings & Reviews', desc: 'See what your customers say', soon: true },
    { icon: '📈', title: 'Analytics', desc: 'Revenue, footfall, repeat customers', soon: true },
    { icon: '🆘', title: 'Support / Helpdesk', desc: 'Get help from the TrustRide team', soon: true },
  ];

  // ── Type-specific feature sets ──
  readonly featuresByType: Record<string, TypeBlock> = {
    product: {
      label: 'Product Tools',
      features: [
        { icon: '📦', title: 'Product Catalog', desc: 'Add/edit items, price, discount & stock', route: '/shop/products' },
        { icon: '🏷️', title: 'Categories', desc: 'Create & manage product categories', route: '/shop/categories' },
        { icon: '🚚', title: 'Product Orders', desc: 'Customer orders with address & phone — update status', route: '/shop/orders' },
        { icon: '📍', title: 'Delivery Settings', desc: 'Self vs platform delivery, delivery radius', soon: true },
      ],
    },
    service: {
      label: 'Service Tools',
      features: [
        { icon: '🛠️', title: 'Service Catalog', desc: 'Name, duration, price, category', route: '/shop/services' },
        { icon: '👥', title: 'Staff Management', desc: 'Assign services to staff / therapists', soon: true },
        { icon: '📅', title: 'Slots & Calendar', desc: 'Manage booking slots', soon: true },
        { icon: '✅', title: 'Booking Requests', desc: 'See customer requests, accept / reject', route: '/shop/service-bookings' },
        { icon: '🎯', title: 'Leads / Interested', desc: 'Customers who showed interest but haven’t booked', soon: true },
        { icon: '🏠', title: 'Service Area', desc: 'Coverage for home-visit services', soon: true },
      ],
    },
    prescription: {
      label: 'Pharmacy Tools',
      features: [
        { icon: '📝', title: 'Prescriptions', desc: 'Verify, mark valid / needs clarification', soon: true },
        { icon: '💊', title: 'Medicine Mapping', desc: 'Match items to stock, suggest substitutes', soon: true },
        { icon: '🧾', title: 'Order Status', desc: 'Pending verification → approved → dispensed', soon: true },
        { icon: '📦', title: 'Inventory (Batch/Expiry)', desc: 'Track batches and expiry dates', soon: true },
        { icon: '📄', title: 'Compliance', desc: 'Drug license & pharmacist registration', soon: true },
      ],
    },
    opd: {
      label: 'OPD / Hospital Tools',
      features: [
        { icon: '👨‍⚕️', title: 'Doctor Profiles', desc: 'Specialization, qualification, registration no.', soon: true },
        { icon: '📅', title: 'OPD Scheduling', desc: 'Slot scheduling per doctor', soon: true },
        { icon: '🧑‍🤝‍🧑', title: 'Appointments', desc: 'Patient appointment list & history', soon: true },
        { icon: '💵', title: 'Consultation & Tele', desc: 'Fees + teleconsultation toggle', soon: true },
        { icon: '🏥', title: 'Departments', desc: 'Manage departments for multi-doctor setups', soon: true },
        { icon: '📃', title: 'e-Prescription', desc: 'Generate after consultation', soon: true },
      ],
    },
  };

  ngOnInit() {
    if (!this.shopkeeper.isLoggedIn()) {
      this.router.navigate(['/shop/login']);
      return;
    }
    const raw = typeof window !== 'undefined' ? localStorage.getItem('shop_user') : null;
    this.shop = raw ? JSON.parse(raw) : null;
  }

  /** Feature block for the logged-in shop's type */
  get typeBlock(): TypeBlock | null {
    const type = this.shop?.shop_type;
    return type ? this.featuresByType[type] ?? null : null;
  }

  typeLabel(t: string): string {
    return (
      { product: 'Product Based', service: 'Service Based', prescription: 'Prescription Based', opd: 'OPD / Hospitals' } as any
    )[t] || t;
  }

  open(feature: ShopFeature): void {
    if (feature.soon || !feature.route) return;
    this.router.navigate([feature.route]);
  }

  logout() {
    this.shopkeeper.logout();
    this.router.navigate(['/shop/login']);
  }
}
