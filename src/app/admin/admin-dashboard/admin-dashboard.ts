import { ChangeDetectorRef, Component, OnInit, ViewChild, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { Adminservice, User, UpdateVerificationRequest } from '../../services/adminservice';
import { MaterialModule } from '../../shared/material/material-module';
import { UserProfileDialog } from '../user-profile-dialog/user-profile-dialog';
import { SideBar } from '../side-bar/side-bar';
import { MatDialog } from '@angular/material/dialog';
import { LoaderServices } from '../../services/loader-services';

@Component({
  selector: 'app-admin-dashboard',
  imports: [SideBar,MaterialModule,],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboard {
   displayedColumns: string[] = [
    'userCode',
    'fullName',
    'gender',
   
    'status',
    'verificationStatus',
    
    'profile',
    'actions'
  ];
 
  dataSource = new MatTableDataSource<User>([]);
  allUsers: User[] = [];
  displayedUsers: User[] = [];
  searchTerm = '';
  isLoading = false;
  updatingUserId: string | null = null;
  activeFilter: 'all' | 'verified' | 'pending' | 'rejected' = 'all';
 
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
 
  private loader = inject(LoaderServices);

  constructor(
    private adminService: Adminservice,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private cdr: ChangeDetectorRef
  ) {}
 
  ngOnInit(): void {
    this.loadUsers();
  }
 
  ngAfterViewInit(): void {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }
 
  // loadUsers(): void {
  //   this.isLoading = true;
  //   this.loader.show();
  //   this.adminService.getAllUsers().subscribe({
  //     next: (response) => {
  //       if (response.success) {
  //         this.allUsers = response.data.filter(
  //           (user: User) => user.professionalVerification != null
  //         );
  //         this.applyActiveFilter();
  //       } else {
  //         this.showError('Users load karne mein problem aayi.');
  //       }
  //       this.isLoading = false;
  //       this.loader.hide();
  //     },
  //     error: (err) => {
  //       console.error('API Error:', err);
  //       this.showError(err?.error?.message || 'Server se connect nahi ho paya. Dobara try karein.');
  //       this.isLoading = false;
  //       this.loader.hide();
  //     }
  //   });
  // }
loadUsers(): void {
    this.isLoading = true;
    this.loader.show();
    this.adminService.getAllUsers().subscribe({
      next: (response) => {
        if (response.success) {
          this.allUsers = response.data; // ✅ filter hata diya
          this.applyActiveFilter();
        } else {
          this.showError('Users load karne mein problem aayi.');
        }
        this.isLoading = false;
        this.loader.hide();
      },
      error: (err) => {
        console.error('API Error:', err);
        this.showError(err?.error?.message || 'Server se connect nahi ho paya. Dobara try karein.');
        this.isLoading = false;
        this.loader.hide();
      }
    });
  }
  getCountByStatus(status: 'verified' | 'pending' | 'rejected'): number {
    return this.allUsers.filter(u => u.verificationStatus === status).length;
  }

  setFilter(filter: 'all' | 'verified' | 'pending' | 'rejected'): void {
    this.activeFilter = filter;
    this.applyActiveFilter();
  }

  private applyActiveFilter(): void {
    if (this.activeFilter === 'all') {
      this.dataSource.data = [...this.allUsers];
    } else {
      this.dataSource.data = this.allUsers.filter(u => u.verificationStatus === this.activeFilter);
    }
    this.recomputeDisplayed();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  applyFilter(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value.trim().toLowerCase();
    this.dataSource.filter = this.searchTerm;
    this.recomputeDisplayed();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  private recomputeDisplayed(): void {
    const term = this.searchTerm;
    if (!term) {
      this.displayedUsers = [...this.dataSource.data];
      return;
    }
    this.displayedUsers = this.dataSource.data.filter(u => {
      const code = u.userCode != null ? String(u.userCode) : '';
      return (
        (u.fullName || '').toLowerCase().includes(term) ||
        (u.gender || '').toLowerCase().includes(term) ||
        (u.status || '').toLowerCase().includes(term) ||
        (u.verificationStatus || '').toLowerCase().includes(term) ||
        code.toLowerCase().includes(term)
      );
    });
  }
 
  updateVerificationStatus(user: User, newStatus: 'verified' | 'pending' | 'rejected'): void {
    if (user.verificationStatus === newStatus) {
      this.showInfo(`User already ${newStatus} hai.`);
      return;
    }

    this.updatingUserId = user._id;

    const payload: UpdateVerificationRequest = {
      user_id: user._id,
      verification_status: newStatus
    };

    this.adminService.updateVerificationStatus(payload).subscribe({
      next: (response) => {
        console.log('full response:', JSON.stringify(response, null, 2));
        this.updatingUserId = null;

        if (response.success) {
          const masterIdx = this.allUsers.findIndex(u => u._id === user._id);
          if (masterIdx !== -1) {
            this.allUsers[masterIdx].verificationStatus = newStatus;
          }
          this.applyActiveFilter();
          this.showSuccess(`${user.fullName}'s status has been changed to "${newStatus}" ✓`);
        } else {
          this.showError(response.message ?? 'Status update failed.');
        }
      },
      error: (err) => {
        this.updatingUserId = null;
        console.error('Update error:', err);
        this.showError(err?.error?.message || 'try again.');
      }
    });
  }
 
  downloadIdCard(user: User): void {
    if (!user.professionalVerification?.id_card_url) {
      this.showError('this user id card is not available.');
      return;
    }
    this.adminService.downloadIdCard(user.professionalVerification.id_card_url);
    this.showSuccess('ID Card is downloading...');
  }
 
  getStatusBadgeClass(status: string): string {
    switch (status?.toLowerCase()) {
      case 'verified': return 'badge-verified';
      case 'pending': return 'badge-pending';
      case 'rejected': return 'badge-rejected';
      default: return 'badge-default';
    }
  }
 
  private showSuccess(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 4000,
      panelClass: ['snackbar-success'],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }
 
  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 6000,
      panelClass: ['snackbar-error'],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }
 
  private showInfo(message: string): void {
    this.snackBar.open(message, 'OK', {
      duration: 3000,
      panelClass: ['snackbar-info'],
      horizontalPosition: 'right',
      verticalPosition: 'top'
    });
  }
  openProfile(user: User): void {
  this.dialog.open(UserProfileDialog, {
    data: user,
    width: '750px',
    panelClass: 'profile-dialog-container'
  });
}


}
