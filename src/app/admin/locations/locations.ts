import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdminLocationArea,
  AdminLocationCity,
  Adminservice,
} from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { LoaderServices } from '../../services/loader-services';
import { LocationService } from '../../services/location-service';

/**
 * Admin page: pickup/drop locations.
 *
 * Admin nayi master city jodta hai, aur har city ke card me uske areas
 * add / rename / show-hide / delete karta hai. Hidden city ya area turant
 * search aur publish ke dropdown se hat jaata hai. City delete tabhi hoti hai
 * jab uski koi ride na ho (server check karta hai) — warna hide karna hai.
 */
@Component({
  selector: 'app-admin-locations',
  imports: [CommonModule, FormsModule, SideBar],
  templateUrl: './locations.html',
  styleUrl: './locations.css',
})
export class AdminLocations implements OnInit {
  cities: AdminLocationCity[] = [];
  loading = true;
  error = '';
  search = '';

  // Kaunse city cards khule hain — default sab band, list lambi na ho
  private expanded = new Set<string>();

  // Nayi master city
  newCityName = '';
  addingCity = false;
  // Hide/delete chal raha ho to us city ke buttons band
  busyCity = '';

  // City key → naye area ka input (city prefix ke baad wala hissa)
  newArea: Record<string, string> = {};
  adding: Record<string, boolean> = {};

  // Inline rename — ek waqt me ek hi area edit hota hai
  editingId = '';
  editingName = '';
  // "lat, lng" — khaali = map point hatao
  editingCoords = '';

  // Master city ka map point edit (ek waqt me ek city)
  editingCityCoordsId = '';
  cityCoords = '';
  // Toggle/rename/delete chal raha ho to us area ke buttons band
  busyId = '';

  private loader = inject(LoaderServices);
  private locationService = inject(LocationService);

  constructor(
    private adminService: Adminservice,
    private cdr: ChangeDetectorRef,
    private snackbar: Snackbar
  ) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.cdr.detectChanges();

    this.adminService.getAdminLocations().subscribe({
      next: (res) => {
        this.cities = res.cities || [];
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || err?.error?.error || 'Failed to load locations.';
        this.cdr.detectChanges();
      },
    });
  }

  // ── Expand / collapse ──

  /** Search chal raha ho to jin cities me match hai wo apne aap khulti hain. */
  isOpen(city: AdminLocationCity): boolean {
    if (this.search.trim()) return this.filteredAreas(city).length > 0;
    return this.expanded.has(city._id);
  }

  toggleExpand(city: AdminLocationCity): void {
    if (this.search.trim()) this.search = '';   // search band karke normal mode me aao
    if (this.expanded.has(city._id)) this.expanded.delete(city._id);
    else this.expanded.add(city._id);
  }

  expandAll(): void {
    this.search = '';
    this.expanded = new Set(this.cities.map((c) => c._id));
  }

  collapseAll(): void {
    this.search = '';
    this.expanded.clear();
  }

  // ── View helpers ──

  filteredAreas(city: AdminLocationCity): AdminLocationArea[] {
    const q = this.search.trim().toLowerCase();
    if (!q) return city.areas;
    return city.areas.filter((a) => a.name.toLowerCase().includes(q));
  }

  visibleCount(city: AdminLocationCity): number {
    return city.areas.filter((a) => a.is_active).length;
  }

  /** "Saharanpur Court Road" → "Court Road" — prefix alag dikhta hai. */
  areaSuffix(city: AdminLocationCity, name: string): string {
    return name.toLowerCase().startsWith(city.name.toLowerCase())
      ? name.slice(city.name.length).trim()
      : name;
  }

  // ── Master cities ──

  addCity(): void {
    const name = this.newCityName.replace(/\s+/g, ' ').trim();
    if (!name) {
      this.snackbar.error('Please enter a city name.');
      return;
    }

    this.addingCity = true;
    this.loader.show();
    this.cdr.detectChanges();

    this.adminService.createLocationCity(name).subscribe({
      next: (res) => {
        this.addingCity = false;
        this.loader.hide();
        this.cities = [...this.cities, { ...res.city, areas: res.city.areas || [] }];
        this.expanded.add(res.city._id);   // nayi city me turant areas daalne ke liye khuli
        this.newCityName = '';
        this.locationService.refresh();
        this.snackbar.success(res?.message || `${res.city.name} added.`);
        this.cdr.detectChanges();
      },
      error: (err) => this.fail(err, 'Failed to add the city.', () => (this.addingCity = false)),
    });
  }

  toggleCity(city: AdminLocationCity): void {
    this.busyCity = city._id;
    this.cdr.detectChanges();

    this.adminService.toggleLocationCity(city._id).subscribe({
      next: (res) => {
        this.busyCity = '';
        city.is_active = res.is_active;
        this.locationService.refresh();
        this.snackbar.success(res.message);
        this.cdr.detectChanges();
      },
      error: (err) => this.fail(err, 'Failed to update the city.', () => (this.busyCity = '')),
    });
  }

  removeCity(city: AdminLocationCity): void {
    const ok = confirm(
      `Delete master city "${city.name}" and all ${city.areas.length} of its areas?

This is only allowed when no ride uses this city. If rides exist, hide the city instead.`
    );
    if (!ok) return;

    this.busyCity = city._id;
    this.loader.show();
    this.cdr.detectChanges();

    this.adminService.deleteLocationCity(city._id).subscribe({
      next: (res) => {
        this.busyCity = '';
        this.loader.hide();
        this.cities = this.cities.filter((c) => c._id !== city._id);
        this.locationService.refresh();
        this.snackbar.success(res?.message || `${city.name} deleted.`);
        this.cdr.detectChanges();
      },
      error: (err) => this.fail(err, 'Failed to delete the city.', () => (this.busyCity = '')),
    });
  }

  // ── Add area ──

  addArea(city: AdminLocationCity): void {
    const suffix = (this.newArea[city._id] || '').replace(/\s+/g, ' ').trim();
    if (!suffix) {
      this.snackbar.error('Please enter an area name.');
      return;
    }

    this.adding[city._id] = true;
    this.loader.show();
    this.cdr.detectChanges();

    // Server khud city prefix lagata hai; poora naam bhejna bhi safe hai.
    this.adminService.createLocationArea(city._id, { name: suffix }).subscribe({
      next: (res) => {
        this.adding[city._id] = false;
        this.loader.hide();
        city.areas = [...city.areas, res.area];
        this.newArea[city._id] = '';
        this.locationService.refresh();
        this.snackbar.success(`${res.area.name} added.`);
        this.cdr.detectChanges();
      },
      error: (err) => this.fail(err, 'Failed to add the area.', () => (this.adding[city._id] = false)),
    });
  }

  // ── Show / hide ──

  toggle(city: AdminLocationCity, area: AdminLocationArea): void {
    this.busyId = area.id;
    this.cdr.detectChanges();

    this.adminService.toggleLocationArea(city._id, area.id).subscribe({
      next: (res) => {
        this.busyId = '';
        area.is_active = res.is_active;
        this.locationService.refresh();
        this.snackbar.success(res.message);
        this.cdr.detectChanges();
      },
      error: (err) => this.fail(err, 'Failed to update visibility.', () => (this.busyId = '')),
    });
  }

  // ── Rename ──

  startEdit(city: AdminLocationCity, area: AdminLocationArea): void {
    this.editingId = area.id;
    this.editingName = this.areaSuffix(city, area.name);
    this.editingCoords = coordsText(area);
    this.cdr.detectChanges();
  }

  cancelEdit(): void {
    this.editingId = '';
    this.editingName = '';
    this.editingCoords = '';
    this.cdr.detectChanges();
  }

  saveEdit(city: AdminLocationCity, area: AdminLocationArea): void {
    const suffix = this.editingName.replace(/\s+/g, ' ').trim();
    if (!suffix) {
      this.snackbar.error('Area name cannot be empty.');
      return;
    }

    const payload: { name: string; lat?: number | null; lng?: number | null } = { name: suffix };
    // Map point sirf tab bhejo jab badla ho — warna naam badalne par
    // naam se dhoondha gaya point server khud reset karta hai
    if (this.editingCoords.trim() !== coordsText(area)) {
      const coords = parseCoords(this.editingCoords);
      if (coords === 'invalid') {
        this.snackbar.error('Map point must look like: 29.9680, 77.5510');
        return;
      }
      payload.lat = coords?.lat ?? null;
      payload.lng = coords?.lng ?? null;
    }

    this.busyId = area.id;
    this.loader.show();
    this.cdr.detectChanges();

    this.adminService.updateLocationArea(city._id, area.id, payload).subscribe({
      next: (res) => {
        this.busyId = '';
        this.loader.hide();
        Object.assign(area, {
          name: res.area.name,
          lat: res.area.lat,
          lng: res.area.lng,
          coords_source: res.area.coords_source,
        });
        this.editingId = '';
        this.editingName = '';
        this.editingCoords = '';
        this.locationService.refresh();
        this.snackbar.success('Area updated.');
        this.cdr.detectChanges();
      },
      error: (err) => this.fail(err, 'Failed to update the area.', () => (this.busyId = '')),
    });
  }

  // ── City map point ──

  startCityCoords(city: AdminLocationCity): void {
    this.editingCityCoordsId = city._id;
    this.cityCoords = coordsText(city);
    this.cdr.detectChanges();
  }

  saveCityCoords(city: AdminLocationCity): void {
    const coords = parseCoords(this.cityCoords);
    if (coords === 'invalid') {
      this.snackbar.error('Map point must look like: 29.9680, 77.5510');
      return;
    }

    this.busyCity = city._id;
    this.cdr.detectChanges();

    this.adminService
      .updateLocationCityCoords(city._id, { lat: coords?.lat ?? null, lng: coords?.lng ?? null })
      .subscribe({
        next: (res) => {
          this.busyCity = '';
          Object.assign(city, { lat: res.lat, lng: res.lng, coords_source: res.coords_source });
          this.editingCityCoordsId = '';
          this.snackbar.success(res?.message || 'Map point saved.');
          this.cdr.detectChanges();
        },
        error: (err) => this.fail(err, 'Failed to save the map point.', () => (this.busyCity = '')),
      });
  }

  /** Badge text: admin ne set kiya / naam se mila / abhi nahi */
  coordsLabel(item: { lat?: number | null; coords_source?: string | null }): string {
    if (item.lat == null) return 'No map point yet';
    return item.coords_source === 'admin' ? 'Map point set' : 'Map point (auto)';
  }

  // ── Delete ──

  remove(city: AdminLocationCity, area: AdminLocationArea): void {
    const ok = confirm(
      `Delete "${area.name}"?\n\nIt will disappear from search and publish. Rides already published with this location are not changed.\n\nTip: use Hide instead if you may need it again.`
    );
    if (!ok) return;

    this.busyId = area.id;
    this.loader.show();
    this.cdr.detectChanges();

    this.adminService.deleteLocationArea(city._id, area.id).subscribe({
      next: (res) => {
        this.busyId = '';
        this.loader.hide();
        city.areas = city.areas.filter((a) => a.id !== area.id);
        this.locationService.refresh();
        this.snackbar.success(res?.message || 'Area deleted.');
        this.cdr.detectChanges();
      },
      error: (err) => this.fail(err, 'Failed to delete the area.', () => (this.busyId = '')),
    });
  }

  private fail(err: any, fallback: string, reset: () => void): void {
    reset();
    this.loader.hide();
    this.snackbar.error(err?.error?.message || err?.error?.error || fallback);
    this.cdr.detectChanges();
  }
}

/** { lat, lng } → "29.968, 77.551" (khaali agar point nahi) */
function coordsText(item: { lat?: number | null; lng?: number | null }): string {
  return item.lat != null && item.lng != null ? `${item.lat}, ${item.lng}` : '';
}

/**
 * "29.968, 77.551" → { lat, lng }. Khaali → null (point hatao).
 * Google Maps se copy kiya "29.968,77.551" bhi chalta hai.
 */
function parseCoords(text: string): { lat: number; lng: number } | null | 'invalid' {
  const t = text.trim();
  if (!t) return null;
  const parts = t.split(/[,\s]+/).filter(Boolean).map(Number);
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return 'invalid';
  return { lat: parts[0], lng: parts[1] };
}
