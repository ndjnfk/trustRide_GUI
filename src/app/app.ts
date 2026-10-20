import { Component, Injector, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
  RouterOutlet,
} from '@angular/router';
import { Header } from './components/header/header';
import { Footer } from './components/footer/footer';
import { LoaderServices } from './services/loader-services';
import { AsyncPipe } from '@angular/common';
import { filter } from 'rxjs/operators'
import { HealthComponent } from './components/health/health';
import { Charts } from './components/charts/charts';
import { CartFab } from './marketplace-components/cart-fab/cart-fab';
import { ChatbotWidget } from './components/chatbot-widget/chatbot-widget';


@Component({
  selector: 'app-root',
    imports: [CommonModule,AsyncPipe, RouterOutlet,Header,Footer,CartFab,ChatbotWidget],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('realtime-app');
 isAdminRoute = true
 isMarketplaceRoute = false
 isChatThreadRoute = false

  private router = inject(Router);
  protected loader = inject(LoaderServices);
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    this.resumeLiveTracking();
    this.syncPushNotifications();

    this.router.events.subscribe(event => {
      if (event instanceof NavigationStart) {
        this.loader.show();
      } else if (
        event instanceof NavigationEnd ||
        event instanceof NavigationCancel ||
        event instanceof NavigationError
      ) {
        this.loader.hide();
      }
    });
  }

  /**
   * Driver location share kar raha tha aur app band ho gayi — khulte hi wapas chalu.
   * Service + Snackbar lazy import — socket.io/GPS/Material snackbar ka code har
   * page ke initial bundle me na aaye. 'live_tracking_ride' = TrackingService ka RESUME_KEY.
   */
  private async resumeLiveTracking(): Promise<void> {
    try {
      if (!localStorage.getItem('live_tracking_ride')) return;
    } catch {
      return;
    }
    const { TrackingService } = await import('./services/tracking-service');
    const resumed = await this.injector.get(TrackingService).resumeIfNeeded();
    if (!resumed) return;
    const { Snackbar } = await import('./services/snackbar');
    this.injector.get(Snackbar).success('Live location sharing resumed');
  }

  /**
   * Browser push: logged-in user ne profile me notifications ON ki hon to app
   * khulte hi FCM token refresh + foreground listener. Lazy import — firebase
   * ka code initial bundle me nahi aata. Fail ho to chup-chaap ignore.
   */
  private async syncPushNotifications(): Promise<void> {
    try {
      const { PushNotificationService } = await import('./services/push-notification');
      await this.injector.get(PushNotificationService).syncOnStartup();
    } catch {
      /* optional feature */
    }
  }

ngOnInit() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const url = event.urlAfterRedirects
        this.isAdminRoute = url.startsWith('/admin')
        this.isMarketplaceRoute = url.startsWith('/marketplace')
        // A single chat conversation (/chat/:threadId) has its own composer send
        // button; hide the floating assistant here so the two don't overlap on mobile.
        this.isChatThreadRoute = url.startsWith('/chat/')
      })
  }

}

