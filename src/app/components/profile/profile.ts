// profile.component.ts
import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import {
  ProfileService,
  UserProfile,
  ProfessionalDoc,
  Vehicle,
} from '../../servies/profile-service';
import { environment } from '../../../../environment';
import { AuthHelper } from '../../helpers/auth-helper';
import { Snackbar } from '../../services/snackbar';
import { MaterialModule } from '../../shared/material/material-module';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { MatDialog } from '@angular/material/dialog';

type ActiveTab = 'personal' | 'professional' | 'vehicles';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule, MaterialModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Profile implements OnInit {

  activeTab: ActiveTab = 'personal';
  isLoading = true;
  isSaving = false;
  error = '';

  // ── Personal ───────────────────────────────────────────────────────────────
  profile: UserProfile = {
    fullName: '', gender: '', userEmail: '', phoneNumber: '',
  };
  avatarPreview: string | null = null;
  avatarFile: File | null = null;

  // ── Professional ───────────────────────────────────────────────────────────
  profDoc: ProfessionalDoc = {
    company_name: '', job_title: '', work_email: '', linkedin_url: '',
  };
  idCardFile: File | null = null;
  idCardPreview: string | null = null;
  hasProfDoc = false;

  // ── Vehicles ───────────────────────────────────────────────────────────────
  vehicles: Vehicle[] = [];
  showVehicleForm = false;
  editingVehicle: Vehicle | null = null;
  vehicleForm: Vehicle = this.emptyVehicle();

  constructor(
    private profileService: ProfileService,
    private snackBar: Snackbar,
    private cdr: ChangeDetectorRef,
    private dialog: MatDialog
  ) { }

  ngOnInit(): void {
    this.loadAll();
  }

  setTab(tab: ActiveTab) {
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

  private emptyVehicle(): Vehicle {
    return { vehicle_type: '', model: '', plate_number: '', color: '', seat_capacity: 1 };
  }

  // ── Load all ───────────────────────────────────────────────────────────────

  loadAll() {
    this.isLoading = true;
    this.cdr.detectChanges();
    this.error = '';
    console.log('Token:', AuthHelper.getToken());
    console.log('Storage direct:', localStorage.getItem('auth_token'));

    this.profileService.getProfile().subscribe({
      next: (res) => {
        // loadAll() mein ye add karo temporarily
        console.log('Token in storage:', AuthHelper.getToken());
        console.log('LocalStorage:', localStorage.getItem('auth_token'));
        this.profile = res.user;
        // ✅ Fix: relative path ko full URL banao
        // this.avatarPreview = res.user.avatarUrl
        //   ? `http://localhost:3333${res.user.avatarUrl}`
        //   : null;
        this.avatarPreview = res.user.avatarUrl
          ? `${environment.apiUrl}${res.user.avatarUrl}`
          : null;
        console.log('Final Avatar URL:', this.avatarPreview)
        // this.avatarPreview = res.user.avatarUrl
        // ? `http://34.207.242.45:3333/${res.user.avatarUrl}`
        // : null;

        this.profDoc = res.professional ?? {
          company_name: '', job_title: '', work_email: '', linkedin_url: '',
        };
        this.hasProfDoc = !!res.professional;
        this.vehicles = res.vehicles ?? [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error = err?.error?.message || 'Failed to load profile.';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ── Avatar ─────────────────────────────────────────────────────────────────

  onAvatarChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.avatarFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.avatarPreview = e.target?.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  getInitials(): string {
    if (!this.profile.fullName) return '?';
    return this.profile.fullName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  // ── Save Personal ──────────────────────────────────────────────────────────

  savePersonal() {
    this.isSaving = true;
    this.cdr.detectChanges();

    this.profileService
      .updatePersonal(
        this.profile.fullName,
        this.profile.gender,
        this.profile.phoneNumber,
        this.avatarFile
      )
      .subscribe({
        next: (res) => {
          this.profile = { ...this.profile, ...res.user };
          this.avatarFile = null;
          this.isSaving = false;
          this.snackBar.success('Personal information updated successfully');
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isSaving = false;
          this.snackBar.error('Failed to update personal information');
          this.cdr.detectChanges();
        },
      });
  }

  // ── Professional ───────────────────────────────────────────────────────────

  onIdCardChange(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.idCardFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      this.idCardPreview = e.target?.result as string;
      this.cdr.detectChanges();
    };
    reader.readAsDataURL(file);
  }

  saveProfessional() {
    this.isSaving = true;
    this.cdr.detectChanges();

    const req$ = this.hasProfDoc
      ? this.profileService.updateProfessional(this.profDoc, this.idCardFile)
      : this.profileService.createProfessional(this.profDoc, this.idCardFile);

    req$.subscribe({
      next: (res) => {
       this.profDoc = {
    ...res.document,
    verification_status: this.profDoc.verification_status // purana status rakho
  };
        this.hasProfDoc = true;
        this.idCardFile = null;
        this.isSaving = false;
        this.snackBar.success('Professional information saved successfully');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.error('Failed to save professional information');
        this.cdr.detectChanges();
      },
    });
  }

  // ── Vehicles ───────────────────────────────────────────────────────────────

  openAddVehicle() {
    this.editingVehicle = null;
    this.vehicleForm = this.emptyVehicle();
    this.showVehicleForm = true;
    this.cdr.detectChanges();
  }

  openEditVehicle(v: Vehicle) {
    this.editingVehicle = v;
    this.vehicleForm = { ...v };
    this.showVehicleForm = true;
    this.cdr.detectChanges();
  }

  cancelVehicleForm() {
    this.showVehicleForm = false;
    this.editingVehicle = null;
    this.cdr.detectChanges();
  }

  saveVehicle() {
    this.isSaving = true;
    this.cdr.detectChanges();

    const req$ = this.editingVehicle
      ? this.profileService.updateVehicle({
        ...this.vehicleForm,
        _id: this.editingVehicle._id,   // MongoDB _id body mein jayega
      })
      : this.profileService.addVehicle(this.vehicleForm);

    req$.subscribe({
      next: (res) => {
        
        if (this.editingVehicle) {
          // update in-place
          const idx = this.vehicles.findIndex(v => v._id === this.editingVehicle!._id);
          if (idx > -1) this.vehicles = [
            ...this.vehicles.slice(0, idx),
            res.vehicle,
            ...this.vehicles.slice(idx + 1),
          ];
        } else {
          this.vehicles = [...this.vehicles, res.vehicle];
        }
        this.showVehicleForm = false;
        this.editingVehicle = null;
        this.isSaving = false;
        this.snackBar.success('Vehicle information saved successfully');
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSaving = false;
        if (err?.status === 400) {
          this.snackBar.error('Please fill in all required details and select a vehicle');

        }
        else {
          this.snackBar.error('Failed to save vehicle information');
        }
        this.cdr.detectChanges();
      },
    });
  }

  // deleteVehicle(v: Vehicle) {
  //   if (!confirm(`Delete ${v.model}?`)) return;

  //   this.profileService.deleteVehicle(v._id!).subscribe({
  //     next: () => {
  //       this.vehicles = this.vehicles.filter(x => x._id !== v._id);
  //       this.snackBar.success('Vehicle removed successfully');
  //       this.cdr.detectChanges();
  //     },
  //     error: (err) => {
  //       this.snackBar.error('Failed to remove vehicle');
  //     },
  //   });
  // }

  // ── Helpers ────────────────────────────────────────────────────────────────


  deleteVehicle(v: Vehicle) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      width: '350px',
      data: {
        title: 'Delete Vehicle',
        message: `Are you sure you want to delete ${v.model}?`
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;

      this.profileService.deleteVehicle(v._id!).subscribe({
        next: () => {
          this.vehicles = this.vehicles.filter(x => x._id !== v._id);
          this.snackBar.success('Vehicle removed successfully');
          this.cdr.detectChanges();
        },
        error: () => {
          this.snackBar.error('Failed to remove vehicle');
        }
      });
    });
  }
  verificationBadge(status?: string): string {
    const map: Record<string, string> = {
      pending: '⏳ Pending',
      verified: '✅ Verified',
      rejected: '❌ Rejected',
    };
    return map[status ?? 'pending'] ?? '⏳ Pending';
  }

  vehicleIcon(type: string): string {
    const map: Record<string, string> = {
      car: '🚗', bike: '🏍️', suv: '🚙', van: '🚐', truck: '🚚',
    };
    return map[type?.toLowerCase()] ?? '🚗';
  }



  // ── Profile Completion ─────────────────────────────────────────────────────

  get completionItems(): { label: string; done: boolean; weight: number }[] {
    return [
      { label: 'Full name', done: !!this.profile.fullName?.trim(), weight: 15 },
      { label: 'Gender', done: !!this.profile.gender?.trim(), weight: 10 },
      { label: 'Phone number', done: !!this.profile.phoneNumber?.trim(), weight: 15 },
      { label: 'Profile photo', done: !!this.avatarPreview, weight: 10 },
      { label: 'Work details', done: this.hasProfDoc, weight: 20 },
      { label: 'Vehicle added', done: this.vehicles.length > 0, weight: 20 },
      { label: 'ID card', done: !!(this.profDoc?.id_card_url || this.idCardPreview), weight: 10 },
    ];
  }

  get completionPercent(): number {
    return this.completionItems
      .filter(i => i.done)
      .reduce((sum, i) => sum + i.weight, 0);
  }

  get completionColor(): string {
    if (this.completionPercent < 40) return '#E24B4A';
    if (this.completionPercent < 75) return '#EF9F27';
    return '#1D9E75';
  }
}