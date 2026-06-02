import { CommonModule } from '@angular/common';

import { Router, RouterLink } from '@angular/router';
import { Component, Output, EventEmitter } from '@angular/core';
import { MaterialModule } from '../../shared/material/material-module';
import { Adminservice } from '../../services/adminservice';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-side-bar',
  imports: [CommonModule,RouterLink,MaterialModule],
  templateUrl: './side-bar.html',
  styleUrl: './side-bar.css',
})
export class SideBar {
   isCollapsed = false;
 
  menuItems = [
    { label: 'Dashboard',   icon: 'dashboard',    route: '/admin/dashboard' },
    { label: 'Users',       icon: 'people',        route: '/admin/dashboard' },
    { label: 'Analytics',   icon: 'bar_chart',     route: '/admin/analytics' },
  
  ];
 
  constructor(private router: Router,  private adminService: Adminservice,  private snackBar: MatSnackBar) {}
 
  // toggleSidebar() {
  //   this.isCollapsed = !this.isCollapsed;
  //   this.collapsedChange.emit(this.isCollapsed);
  // }

  // @Output() collapsedChange = new EventEmitter<boolean>();
 
 logout(): void {
  this.snackBar.open('Logging out...', '', {
    duration: 1500,
    panelClass: ['snack-info']
  });

  this.adminService.logout().subscribe({
    next: () => {
      this.snackBar.open('✓ Logged out successfully', '', {
        duration: 2000,
        panelClass: ['snack-success']
      });
    },
    error: () => {
      this.snackBar.open('⚠ Session cleared locally', '', {
        duration: 2000,
        panelClass: ['snack-warning']
      });
    }
  });
}


isMobileOpen = false
 
  toggleSidebar() {
    this.isMobileOpen = !this.isMobileOpen
  }
 
  closeSidebar() {
    this.isMobileOpen = false
  }


  isClearingRedis = false;
isClearingMongo = false;

clearRedis(): void {
  if (!confirm('⚠️ All Redis data will be cleared. This action cannot be undone. Are you sure?')) return;

  this.isClearingRedis = true;
  this.adminService.clearRedisData().subscribe({
    next: (res) => {
      this.isClearingRedis = false;
      this.snackBar.open(res.message ?? 'Redis cleared!', '', {
        duration: 2000,
        panelClass: ['snack-success']
      });
    },
    error: () => {
      this.isClearingRedis = false;
      this.snackBar.open('error in Redis clear ', '', {
        duration: 2000,
        panelClass: ['snack-error']
      });
    }
  });
}

clearMongo(): void {
  if (!confirm('⚠️ All MongoDB data will be permanently deleted and cannot be recovered. Are you sure you want to continue?')) return;

  this.isClearingMongo = true;
  this.adminService.clearMongoData().subscribe({
    next: (res) => {
      this.isClearingMongo = false;
      this.snackBar.open(res.message ?? 'Mongo cleared!', '', {
        duration: 2000,
        panelClass: ['snack-success']
      });
    },
    error: () => {
      this.isClearingMongo = false;
      this.snackBar.open('error in Mongo clear.', '', {
        duration: 2000,
        panelClass: ['snack-error']
      });
    }
  });
}
}
