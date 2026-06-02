import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { BehaviorSubject } from 'rxjs';
import { distinctUntilChanged } from 'rxjs/operators';

@Injectable({
  providedIn: 'root',
})
export class LoaderServices {
  /** Real pending-request count — hamesha accurate rehta hai (turant inc/dec). */
  private pendingCount = 0;

  /** Jo template dekhta hai. Visual hide ko min-time ke liye defer karte hain. */
  private visible = new BehaviorSubject<boolean>(false);

  private isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  /** Loader ek baar dikhne ke baad kam se kam itni der visible rahega (ms).
   *  Isse fast navigations / fast API responses pe loader flash hokar gayab nahi hota. */
  private readonly MIN_VISIBLE_MS = 400;
  private shownAt = 0;
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  loading$ = this.visible.pipe(distinctUntilChanged());

  show() {
    if (!this.isBrowser) return;

    this.pendingCount++;

    // Pehle se hide schedule hua ho to cancel karo — loader visible hi rehna chahiye.
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    if (!this.visible.value) {
      this.shownAt = Date.now();
      this.visible.next(true);
    }
  }

  hide() {
    if (!this.isBrowser) return;

    this.pendingCount = Math.max(0, this.pendingCount - 1);

    // Abhi bhi pending requests hain — loader chalu rahe.
    if (this.pendingCount > 0) return;

    // Pehle se ek hide schedule ho chuka hai — dobara mat karo.
    if (this.hideTimer !== null) return;

    // Last request khatam — minimum visible time poora karke hi hide karo.
    const elapsed = Date.now() - this.shownAt;
    const wait = Math.max(0, this.MIN_VISIBLE_MS - elapsed);
    this.hideTimer = setTimeout(() => {
      this.hideTimer = null;
      // Timer ke beech naya request aaya ho to hide mat karo.
      if (this.pendingCount === 0) {
        this.visible.next(false);
      }
    }, wait);
  }

  reset() {
    if (this.hideTimer !== null) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }
    this.pendingCount = 0;
    this.visible.next(false);
  }
}
