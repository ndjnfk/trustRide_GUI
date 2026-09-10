import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Adminservice, RegistrationLimitData } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { LoaderServices } from '../../services/loader-services';

/**
 * Admin page: kitne users TrustRide par register kar sakte hain.
 *
 * Limit 125 set karne par 125 users tak signup chalta hai; 126th ko register
 * karte hi "Registration is closed" error milta hai. Toggle off = unlimited.
 */
@Component({
  selector: 'app-registration-limit',
  imports: [CommonModule, FormsModule, SideBar],
  templateUrl: './registration-limit.html',
  styleUrl: './registration-limit.css',
})
export class RegistrationLimit implements OnInit {
  // ── Form model ──
  enabled = false;
  limit: number | null = null;

  // ── Live status from the server ──
  status: RegistrationLimitData | null = null;

  loading = true;
  submitting = false;
  error = '';

  private loader = inject(LoaderServices);

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

    this.adminService.getRegistrationLimit().subscribe({
      next: (res) => {
        this.status = res.data;
        this.enabled = res.data.enabled;
        this.limit = res.data.enabled ? res.data.limit : null;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loading = false;
        this.error =
          err?.error?.message || err?.error?.error || 'Failed to load the registration limit.';
        this.cdr.detectChanges();
      },
    });
  }

  /** Progress bar ki width — cap band ho to bar dikhta hi nahi. */
  get usedPercent(): number {
    if (!this.status?.enabled || !this.status.limit) return 0;
    return Math.min(Math.round((this.status.registeredUsers / this.status.limit) * 100), 100);
  }

  save(): void {
    this.error = '';

    const limit = Number(this.limit);

    if (this.enabled) {
      if (!this.limit && this.limit !== 0) {
        this.error = 'Please enter the maximum number of users.';
        return;
      }
      if (!Number.isInteger(limit) || limit < 1) {
        this.error = 'Limit must be a whole number of 1 or more.';
        return;
      }
      // Cap ko already-registered count se neeche le jaana allowed hai, par
      // admin ko pata hona chahiye ki iska matlab signup turant band hai.
      const registered = this.status?.registeredUsers ?? 0;
      if (limit < registered) {
        const ok = confirm(
          `${registered} users are already registered. Setting the limit to ${limit} will close new registrations immediately (existing users are not removed). Continue?`
        );
        if (!ok) return;
      }
    }

    this.submitting = true;
    this.loader.show();
    this.cdr.detectChanges();

    this.adminService
      .updateRegistrationLimit({ enabled: this.enabled, limit: this.enabled ? limit : 0 })
      .subscribe({
        next: (res) => {
          this.submitting = false;
          this.loader.hide();
          this.status = res.data;
          this.limit = res.data.enabled ? res.data.limit : null;
          this.snackbar.success(res?.message || 'Registration limit updated.');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.submitting = false;
          this.loader.hide();
          this.error =
            err?.error?.message ||
            err?.error?.errors?.[0]?.message ||
            'Failed to update the registration limit.';
          this.snackbar.error(this.error);
          this.cdr.detectChanges();
        },
      });
  }
}
