import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { EvCitySuggestion, EvPointsService, EvPricing, EvSubmitPayload } from '../../services/ev-points';
import { Snackbar } from '../../services/snackbar';

/*
 * Public form — koi bhi EV charger owner apna charger list kare (bina login).
 * Address + Google Maps link + timings; city autocomplete. Admin verify kare tab live.
 * Price host nahi likhta — TrustRide ka fixed rate dikhta hai (admin panel se).
 */
@Component({
  selector: 'app-ev-point-form',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ev-point-form.html',
  styleUrl: './ev-point-form.css',
})
export class EvPointForm implements OnInit, OnDestroy {
  private evService = inject(EvPointsService);
  private snack = inject(Snackbar);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  form: EvSubmitPayload = this.emptyForm();

  pricing: EvPricing | null = null;
  submitting = false;
  submitted = false;
  locationDetected = false;
  errors: Record<string, string> = {};

  // ── city autocomplete ──
  suggestions: EvCitySuggestion[] = [];
  showSuggestions = false;
  activeIndex = -1;
  private cityTimer: any = null;
  private citySub: Subscription | null = null;

  ngOnInit(): void {
    this.evService.pricing().subscribe({
      next: (res) => {
        this.pricing = res.pricing;
        this.cdr.markForCheck();
      },
      error: () => {
        /* price info optional */
      },
    });
  }

  ngOnDestroy(): void {
    if (this.cityTimer) clearTimeout(this.cityTimer);
    this.citySub?.unsubscribe();
  }

  private emptyForm(keep?: Partial<EvSubmitPayload>): EvSubmitPayload {
    return {
      name: keep?.name ?? '',
      phone: keep?.phone ?? '',
      address: '',
      city: '',
      maps_link: '',
      open_from: '08:00',
      open_to: '22:00',
      open_24h: false,
      notes: '',
    };
  }

  onCityInput(value: string): void {
    this.form.city = value;
    this.activeIndex = -1;
    if (this.cityTimer) clearTimeout(this.cityTimer);
    const q = value.trim();
    if (q.length < 2) {
      this.suggestions = [];
      this.showSuggestions = false;
      this.cdr.markForCheck();
      return;
    }
    this.cityTimer = setTimeout(() => {
      this.citySub?.unsubscribe();
      this.citySub = this.evService.cities(q).subscribe({
        next: (res) => {
          // user ne type karna jaari rakha ho to purana result mat dikhao
          if (this.form.city.trim() !== q) return;
          this.suggestions = res.cities ?? [];
          this.showSuggestions = this.suggestions.length > 0;
          this.cdr.markForCheck();
        },
        error: () => {
          this.suggestions = [];
          this.showSuggestions = false;
          this.cdr.markForCheck();
        },
      });
    }, 300);
  }

  pickCity(s: EvCitySuggestion): void {
    this.form.city = s.name;
    this.suggestions = [];
    this.showSuggestions = false;
    this.activeIndex = -1;
    this.cdr.markForCheck();
  }

  onCityKeydown(e: KeyboardEvent): void {
    if (!this.showSuggestions || !this.suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIndex = (this.activeIndex + 1) % this.suggestions.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIndex = (this.activeIndex - 1 + this.suggestions.length) % this.suggestions.length;
    } else if (e.key === 'Enter' && this.activeIndex >= 0) {
      e.preventDefault();
      this.pickCity(this.suggestions[this.activeIndex]);
      return;
    } else if (e.key === 'Escape') {
      this.showSuggestions = false;
    }
    this.cdr.markForCheck();
  }

  hideSuggestionsSoon(): void {
    // click on a suggestion should fire before we hide
    setTimeout(() => {
      this.showSuggestions = false;
      this.cdr.markForCheck();
    }, 150);
  }

  sourceLabel(s: EvCitySuggestion): string {
    if (s.source === 'trustride') return 'TrustRide city';
    if (s.source === 'listed') return 'has chargers';
    return s.state ? s.state : 'India';
  }

  // ── validation + submit ──
  private validate(): boolean {
    const f = this.form;
    const e: Record<string, string> = {};
    const phone = String(f.phone ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '');
    if (f.name.trim().length < 2) e['name'] = 'Enter your name';
    if (!/^\d{10}$/.test(phone)) e['phone'] = 'Enter a valid 10-digit mobile number';
    if (f.address.trim().length < 5) e['address'] = 'Enter the full address (house no., street, landmark)';
    if (f.city.trim().length < 2) e['city'] = 'Enter the city';
    if (!/(google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/|maps\.google|share\.google)/i.test(f.maps_link.trim())) {
      e['maps_link'] = 'Paste the Google Maps share link of your charger location';
    }
    if (!f.open_24h) {
      if (!f.open_from || !f.open_to) e['open_from'] = 'Enter the timings or tick “Open 24 hours”';
      else if (f.open_from === f.open_to) e['open_from'] = 'Open from and open till cannot be the same (tick 24 hours instead)';
    }
    this.errors = e;
    return Object.keys(e).length === 0;
  }

  submit(): void {
    if (this.submitting) return;
    if (!this.validate()) {
      this.snack.error(Object.values(this.errors)[0]);
      this.cdr.markForCheck();
      return;
    }
    this.submitting = true;
    this.cdr.markForCheck();

    const payload: EvSubmitPayload = {
      name: this.form.name.trim(),
      phone: String(this.form.phone).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, ''),
      address: this.form.address.trim(),
      city: this.form.city.trim(),
      maps_link: this.form.maps_link.trim(),
      open_24h: !!this.form.open_24h,
      open_from: this.form.open_24h ? '' : this.form.open_from,
      open_to: this.form.open_24h ? '' : this.form.open_to,
      notes: (this.form.notes ?? '').trim(),
    };

    this.evService.submit(payload).subscribe({
      next: (res) => {
        this.submitting = false;
        this.submitted = true;
        this.locationDetected = !!res.location_detected;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.submitting = false;
        if (err?.error?.errors) this.errors = err.error.errors;
        this.snack.error(err?.error?.message || 'Could not submit. Please try again.');
        this.cdr.markForCheck();
      },
    });
  }

  listAnother(): void {
    this.form = this.emptyForm({ name: this.form.name, phone: this.form.phone });
    this.errors = {};
    this.submitted = false;
    this.cdr.markForCheck();
  }

  goToPoints(): void {
    this.router.navigate(['/ev-points']);
  }
}
