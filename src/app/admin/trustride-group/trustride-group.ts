import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Adminservice, TrcMember, TrcMemberStatus } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';

type Tab = 'active' | 'removed' | 'left' | 'unverified' | 'all';

/**
 * Admin page: TrustRide Chat group ke members.
 *
 * User verify hote hi khud group me aa jata hai (backend syncVerification).
 * Yahan admin kisi ko Remove kar sakta hai — removed user verify dobara hone par bhi
 * wapas nahi judta, jab tak admin yahin se "Add" na kare.
 */
@Component({
  selector: 'app-trustride-group',
  imports: [CommonModule, FormsModule, SideBar],
  templateUrl: './trustride-group.html',
  styleUrl: './trustride-group.css',
})
export class TrustRideGroup implements OnInit {
  members: TrcMember[] = [];
  counts: Record<TrcMemberStatus, number> = { active: 0, removed: 0, left: 0, unverified: 0 };

  tab: Tab = 'active';
  q = '';
  loading = true;
  error = '';
  busyId: string | null = null;

  // "Add member" panel — group se bahar wale verified users
  showAdd = false;
  addQ = '';

  readonly tabs: Array<{ key: Tab; label: string }> = [
    { key: 'active', label: 'In group' },
    { key: 'removed', label: 'Removed' },
    { key: 'left', label: 'Left' },
    { key: 'unverified', label: 'Unverified' },
    { key: 'all', label: 'All' },
  ];

  private adminService = inject(Adminservice);
  private cdr = inject(ChangeDetectorRef);
  private snackbar = inject(Snackbar);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.cdr.markForCheck();

    // poori list ek baar laate hain; tab / search client side
    this.adminService.getTrcMembers({ status: 'all' }).subscribe({
      next: (res) => {
        this.members = res.members ?? [];
        this.counts = Object.assign({ active: 0, removed: 0, left: 0, unverified: 0 }, res.counts);
        this.loading = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message || 'Failed to load group members.';
        this.cdr.markForCheck();
      },
    });
  }

  countFor(tab: Tab): number {
    return tab === 'all' ? this.members.length : this.counts[tab] ?? 0;
  }

  private matches(m: TrcMember, q: string): boolean {
    const n = q.trim().toLowerCase();
    if (!n) return true;
    return [m.name, m.email, m.phone].some((v) => v && v.toLowerCase().includes(n));
  }

  get visible(): TrcMember[] {
    return this.members.filter((m) => (this.tab === 'all' || m.status === this.tab) && this.matches(m, this.q));
  }

  /** Add panel: verified par group me nahi (removed / left) */
  get addable(): TrcMember[] {
    return this.members.filter((m) => m.status !== 'active' && m.verified && this.matches(m, this.addQ));
  }

  statusLabel(s: TrcMemberStatus): string {
    return { active: 'In group', removed: 'Removed by admin', left: 'Left', unverified: 'Unverified' }[s] ?? s;
  }

  remove(m: TrcMember): void {
    const reason = prompt(`Remove ${m.name} from TrustRide Chat?\n\nReason (optional):`, '');
    if (reason === null) return;
    this.busyId = m.user_id;
    this.cdr.markForCheck();
    this.adminService.removeTrcMember(m.user_id, reason.trim() || undefined).subscribe({
      next: (res) => {
        this.busyId = null;
        this.snackbar.success(res?.message || 'User removed from the group.');
        this.load();
      },
      error: (err) => {
        this.busyId = null;
        this.snackbar.error(err?.error?.message || 'Failed to remove user.');
        this.cdr.markForCheck();
      },
    });
  }

  add(m: TrcMember): void {
    this.busyId = m.user_id;
    this.cdr.markForCheck();
    this.adminService.addTrcMember(m.user_id).subscribe({
      next: (res) => {
        this.busyId = null;
        this.snackbar.success(res?.message || 'User added to the group.');
        this.load();
      },
      error: (err) => {
        this.busyId = null;
        this.snackbar.error(err?.error?.message || 'Failed to add user.');
        this.cdr.markForCheck();
      },
    });
  }
}
