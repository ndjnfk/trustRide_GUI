import { Component, PLATFORM_ID, inject, signal } from '@angular/core';
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


@Component({
  selector: 'app-root',
    imports: [CommonModule,AsyncPipe, RouterOutlet,Header,Footer],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('realtime-app');
 isAdminRoute = true

  private router = inject(Router);
  protected loader = inject(LoaderServices);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

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

ngOnInit() {
    this.router.events
      .pipe(filter(event => event instanceof NavigationEnd))
      .subscribe((event: NavigationEnd) => {
        const url = event.urlAfterRedirects
        this.isAdminRoute = url.startsWith('/admin')
      })
  }

}

