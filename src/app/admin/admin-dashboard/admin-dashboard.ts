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
import { AuthService } from '../../services/auth';
import { Snackbar } from '../../services/snackbar';

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
    private cdr: ChangeDetectorRef,
    private authService:AuthService,
    private snackbar:Snackbar
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
          // Latest members on top (sorted by created_at timestamp, newest first)
          this.allUsers = [...response.data].sort(
            (a, b) =>
              new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
          );
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
sendEmail(userEmail:any){

        this.authService.verifyEmail(userEmail).subscribe({
        next: () => {
            this.snackbar.success(`Verification email sent to ${userEmail}`)
          },
          error: () => {
            // registration already succeeded; just inform the user
            this.snackbar.error('Could not send verification email. Please try again later.')
          }
        })
}


deleteUser(userId: string) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    this.adminService.deleteUser(userId).subscribe({
      next: (res) => {
        console.log('User deleted:', res);
        this.snackbar.success('User deleted successfully')
        this.loadUsers()
      },
      error: (err) => {
        console.error(err);
        alert(err?.error?.message || 'Delete failed');
      },
    });
  }


  checkingEmails = new Set<string>();   // kaunse emails check ho rahe hain

checkBounceEmail(user: any): void {
  const email = user.userEmail;
  if (!email || this.checkingEmails.has(email)) return;

  this.checkingEmails.add(email);
  this.cdr.detectChanges();

  this.adminService.checkBounceEmail(email).subscribe({
    next: (res) => {
      // Bounce result ke hisaab se status decide karo
      const newStatus = res.success ? 'verified' : 'rejected';

      if (res.success) {
        this.snackbar.success(`✅ ${email} — ${res.message}`);
      } else {
        this.snackbar.error(`❌ ${email} — ${res.message}`);
      }

      // Ab verification status update karo
      this.updateStatus(user, newStatus, email);
    },
    error: (err) => {
      // API error (timeout, server down) — status mat badlo,
      // kyunki yeh email invalid hone ka proof nahi hai
      this.checkingEmails.delete(email);
      const message = err?.error?.message || 'Bounce check failed';
      this.snackbar.error(`❌ ${email} — ${message}`);
      this.cdr.detectChanges();
    },
  });
}

private updateStatus(user: any, status: 'verified' | 'rejected', email: string): void {
  const payload = {
    user_id: user._id,        // ← apne UpdateVerificationRequest ke fields ke hisaab se adjust karo
    verification_status: status,
  };

  this.adminService.updateVerificationStatus(payload).subscribe({
    next: (res) => {
      this.checkingEmails.delete(email);
      // Local list mein bhi update karo taaki UI turant reflect kare
      user.verificationStatus = status;
      this.snackbar.success(`User ${status === 'verified' ? 'verified ✅' : 'rejected ❌'}`);
      this.cdr.detectChanges();
    },
    error: (err) => {
      this.checkingEmails.delete(email);
      this.snackbar.error(err?.error?.message || 'Status update failed');
      this.cdr.detectChanges();
    },
  });
}

}
