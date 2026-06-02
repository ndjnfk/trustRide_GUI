import { Injectable, NgZone, PLATFORM_ID, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** The non-standard event Chromium fires when the app is installable. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({ providedIn: 'root' })
export class PwaInstallService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly zone = inject(NgZone);

  /** Saved beforeinstallprompt event (only set on Android/desktop Chromium). */
  private deferred: BeforeInstallPromptEvent | null = null;

  /** True when the browser offered a native install prompt. */
  readonly canInstall = signal(false);
  /** True after the app was installed (or already running standalone). */
  readonly installed = signal(false);
  /** True on iOS Safari, where install is a manual Share-sheet flow. */
  readonly isIos = signal(false);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    const nav = window.navigator as any;
    const ua = nav.userAgent || '';
    const ios = /iphone|ipad|ipod/i.test(ua) && !(window as any).MSStream;
    this.isIos.set(ios);

    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
    this.installed.set(standalone);

    window.addEventListener('beforeinstallprompt', (e: Event) => {
      e.preventDefault();
      this.deferred = e as BeforeInstallPromptEvent;
      this.zone.run(() => this.canInstall.set(true));
    });

    window.addEventListener('appinstalled', () => {
      this.deferred = null;
      this.zone.run(() => {
        this.canInstall.set(false);
        this.installed.set(true);
      });
    });
  }

  /** True if there is anything to show the user (native prompt or iOS hint). */
  isInstallable(): boolean {
    return !this.installed() && (this.canInstall() || this.isIos());
  }

  /**
   * Triggers installation.
   * - Chromium: shows the native install dialog.
   * - iOS: returns 'ios' so the UI can show Share → Add to Home Screen steps.
   */
  async install(): Promise<'accepted' | 'dismissed' | 'ios' | 'unavailable'> {
    if (this.isIos() && !this.canInstall()) return 'ios';
    if (!this.deferred) return 'unavailable';

    await this.deferred.prompt();
    const { outcome } = await this.deferred.userChoice;
    this.deferred = null;
    this.zone.run(() => this.canInstall.set(false));
    return outcome;
  }
}
