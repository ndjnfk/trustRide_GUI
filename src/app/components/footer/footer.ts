import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterModule } from '@angular/router';
import { AuthHelper } from '../../helpers/auth-helper';

@Component({
  selector: 'app-footer',
  imports: [RouterLink,CommonModule, RouterModule],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {

  constructor(private router:Router){}
  currentYear = new Date().getFullYear();

  get isLoggedIn(): boolean {
    return AuthHelper.isLoggedIn();
  }
 
  links = {
    product: [
      { label: 'Home',    route: '/dashboard' },
      { label: 'Create Ride',  route: '/create-ride'    },
      { label: 'My Ride',    route: '/get-ride' },
      // { label: 'Analytics',    route: '/analytics' },
    ],
    company: [
      { label: 'About Us',     route: '/about'   },
      { label: 'Blog',         route: '/blog'    },
      // { label: 'Careers',      route: '/careers' },
      // { label: 'Press Kit',    route: '/press'   },
    ],
    support: [
      { label: 'Help Center',  route: '/help'    },
      { label: 'Contact Us',   route: '/contact' },
      { label: 'Status',       route: '/status'  },
      { label: 'API Docs',     route: '/docs'    },
    ],
    legal: [
      { label: 'Privacy Policy', route: '/privacy' },
      { label: 'Terms of Service', route: '/terms' },
      { label: 'Cookie Policy', route: '/cookies'  },
    ],
  };
 
  socials = [
    { name: 'Twitter/X', icon: 'x',        href: 'https://twitter.com' },
    { name: 'LinkedIn',  icon: 'linkedin',  href: 'https://linkedin.com' },
    { name: 'GitHub',    icon: 'github',    href: 'https://github.com' },
    { name: 'Discord',   icon: 'discord',   href: 'https://discord.com' },
  ];

  mobileNavItems = [
    // Tiffin aur Emergency tabs filhaal website se band — admin panel me pages
    // chaalu hain. Tiffin ki jagah wapas Search aa gaya hai (jaisa pehle tha).
    // Inhe wapas chalu karo to footer.html ka *ngIf bhi dekh lena — logged-out
    // visitor ko sirf pehla public tab dikhta hai.
    // { key: 'tiffin',      label: 'Tiffin',      route: '/tiffin-service' },
    // { key: 'emergency',   label: 'Emergency',   route: '/medical-emergency' },
    { key: 'search',      label: 'Search',      route: '/search-rides' },
    { key: 'publish',     label: 'Publish',     route: '/create-ride' },
    { key: 'rides',       label: 'Your rides',  route: '/get-ride' },
    { key: 'chat',        label: 'Chat',        route: '/chat' },
    { key: 'profile',     label: 'Profile',     route: '/about-you' },
  ];

  onNavClick(item: any): void {
  if (item.external) {
    window.open(item.route, '_blank');
  } else {
    this.router.navigate([item.route]);
  }
}
}
