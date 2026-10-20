import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
import { Snackbar } from '../../services/snackbar';
import { PushNotificationService, PushState } from '../../services/push-notification';

/*
 * Browser push notifications ka toggle card — Profile (/about-you) aur
 * /profile dono jagah yahi component use hota hai.
 *
 * States: 'loading' → check ho raha hai; 'unsupported' → browser/HTTP support
 * nahi; 'blocked' → user ne browser me deny kiya; 'off' / 'on'.
 */
@Component({
  selector: 'app-notification-toggle',
  imports: [CommonModule],
  templateUrl: './notification-toggle.html',
  styleUrl: './notification-toggle.css',
})
export class NotificationToggle implements OnInit {
  private push = inject(PushNotificationService);
  private snackBar = inject(Snackbar);
  private cdr = inject(ChangeDetectorRef);

  pushState: PushState | 'loading' = 'loading';
  pushBusy = false;

  ngOnInit(): void {
    this.refreshPushState();
  }

  async refreshPushState(): Promise<void> {
    this.pushState = await this.push.getState();
    this.cdr.markForCheck();
  }

  get pushOn(): boolean {
    return this.pushState === 'on';
  }

  get pushHint(): string {
    switch (this.pushState) {
      case 'loading':
        return 'Checking…';
      case 'unsupported':
        return 'This browser does not support push notifications (needs HTTPS and a modern browser).';
      case 'blocked':
        return 'Notifications are blocked in your browser. Allow them from the site settings (🔒 icon in the address bar) and try again.';
      case 'on':
        return 'You will get booking requests, approvals, ride updates and messages on this device.';
      default:
        return 'Turn on to get booking requests, approvals, ride updates and messages — even when the app is closed.';
    }
  }

  async togglePush(): Promise<void> {
    if (this.pushBusy || this.pushState === 'loading' || this.pushState === 'unsupported') return;
    this.pushBusy = true;
    this.cdr.markForCheck();

    try {
      if (this.pushOn) {
        await this.push.disable();
        this.pushState = 'off';
        this.snackBar.info('Notifications turned off');
      } else {
        const state = await this.push.enable();
        this.pushState = state;
        if (state === 'on') this.snackBar.success('Notifications turned on');
        else if (state === 'blocked') this.snackBar.error('Notifications are blocked in the browser settings');
        else this.snackBar.error('Could not turn on notifications. Please try again.');
      }
    } catch (err: any) {
      this.snackBar.error(err?.error?.message || 'Could not update notification setting');
      await this.refreshPushState();
    } finally {
      this.pushBusy = false;
      this.cdr.markForCheck();
    }
  }

  async sendTestPush(): Promise<void> {
    if (this.pushBusy || !this.pushOn) return;
    this.pushBusy = true;
    this.cdr.markForCheck();
    const res = await this.push.sendTest();
    this.pushBusy = false;
    if (res.ok) this.snackBar.success(`Test notification sent (${res.message})`);
    else this.snackBar.error(res.message);
    this.cdr.markForCheck();
  }
}
