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
    { key: 'search',  label: 'Search',     route: '/search-rides' },
    { key: 'publish', label: 'Publish',    route: '/create-ride' },
    { key: 'rides',   label: 'Your rides', route: '/get-ride' },
    { key: 'inbox',   label: 'wpg',      route: 'https://chat.whatsapp.com/BFkpwqCkWZnKvv61V2l03c' },
    { key: 'profile', label: 'Profile',    route: '/about-you' },
  ];

  onNavClick(item: any): void {
  if (item.external) {
    window.open(item.route, '_blank');
  } else {
    this.router.navigate([item.route]);
  }
}
}
