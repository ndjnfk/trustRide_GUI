import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Profileresponse, ProfileService, TravelDay, Vehicle } from '../../servies/profile-service';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { Snackbar } from '../../services/snackbar';
import { environment } from '../../../../environment';
import { forkJoin } from 'rxjs';
import { VehicleDialog } from '../vehicle-dialog/vehicle-dialog';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';


@Component({
  selector: 'app-edit-profile',
  imports: [CommonModule, FormsModule, VehicleDialog],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.css',
})
export class EditProfile implements OnInit, OnDestroy {

  private objectUrl: string | null = null   // local blob URL for instant avatar preview

  form = {
    fullName: '',
    phoneNumber: '',
    city: '',
    aboutUser: '',
    gender: '',
    companyName: '',
    referredBy: '',
  }

  allPreferences = [
    { key: 'quiet',      icon: 'ti-message-circle',  label: "I'm the quiet type" },
    { key: 'music',      icon: 'ti-music',            label: "It's all about playlist" },
    { key: 'smoking',    icon: 'ti-smoking-no',       label: 'No smoking' },
    { key: 'pets',       icon: 'ti-paw-off',          label: 'No pets' },
   
  ]

  selectedPrefs: string[] = []

  // ── Preferred travel days ──
  locations = ['Gurgaon', 'Saharanpur', 'Chandigarh', 'Mohali']
  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  preferredTravelDays: TravelDay[] = []

  // ── Vehicles ──
  vehicles: Vehicle[] = []

  avatarFile: File | null = null
  avatarPreview: string = ''
    private readonly BASE = environment.apiUrl;
  isLoading = false
  isSaving = false

  @ViewChild(VehicleDialog) vehicleDialog!: VehicleDialog

  // ── Role switching ──
  currentRole = ''
  selectedRole = ''
  roleOptions: string[] = []   // all selectable roles (current + alternatives)
  canSwitchRole = false

  // Pretty labels for each role value
  roleLabels: Record<string, string> = {
    passenger: 'Passenger',
    rider: 'Rider',
    both: 'Passenger & Rider',
  }

  constructor(
    private profileService: ProfileService,
    private router: Router,
    private snackbar: Snackbar,
    private dialog: MatDialog,
  ) {}

  ngOnInit() {
    this.loadProfile()
    this.loadRole()
  }

  ngOnDestroy() {
    // ✅ blob URL release karo taaki memory leak na ho
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl)
  }

  loadRole() {
    this.profileService.getRole().subscribe({
      next: (res) => {
        if (res.success) {
          this.currentRole = res.currentRole
          this.selectedRole = res.currentRole
          this.canSwitchRole = res.canSwitch
          // Full list = current role + the alternatives returned by the API
          this.roleOptions = [res.currentRole, ...(res.options || [])]
        }
      },
      error: (err) => {
        console.error('Load role error', err)
      }
    })
  }

  selectRole(role: string) {
    if (!this.canSwitchRole) return
    this.selectedRole = role
  }

  roleLabel(role: string): string {
    return this.roleLabels[role] ?? (role.charAt(0).toUpperCase() + role.slice(1))
  }

  loadProfile() {
    this.isLoading = true
    this.profileService.getUserProfile().subscribe({
      next: (res:Profileresponse) => {
        const d = res.user
        this.form.fullName    = d.fullName   || ''
        this.form.phoneNumber = d.phoneNumber       || ''
        this.form.city        = d.city        || ''
        this.form.aboutUser   = d.aboutUser       || ''
        this.form.gender      = d.gender || ''
        this.form.companyName = d.companyName  || ''
        this.form.referredBy  = d.referredBy   || ''
        this.selectedPrefs    = d.preferences || []
        this.preferredTravelDays = (d.preferredTravelDays || []).map(t => ({ ...t }))
        this.vehicles         = res.vehicles ?? []

 if (d.avatarUrl) this.avatarPreview = `${this.BASE}${d.avatarUrl}`
 console.log( `${this.BASE}${d.avatarUrl}` )  // ✅
        this.isLoading = false
      },
      error: (err) => {
        console.error('Load profile error', err)
        this.isLoading = false
      }
    })
  }

  isSelected(key: string): boolean {
    return this.selectedPrefs.includes(key)
  }

  togglePref(key: string) {
    if (this.isSelected(key)) {
      this.selectedPrefs = this.selectedPrefs.filter(p => p !== key)
    } else {
      this.selectedPrefs.push(key)
    }
  }

  // onAvatarChange(event: Event) {
  //   const input = event.target as HTMLInputElement
  //   if (input.files && input.files[0]) {
  //     this.avatarFile = input.files[0]
  //     const reader = new FileReader()
  //     reader.onload = (e) => this.avatarPreview = e.target?.result as string
  //     reader.readAsDataURL(this.avatarFile)
  //   }
  // }


  onAvatarChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files && input.files[0]) {
    const file = input.files[0]

    // ✅ Client-side validation — jfif aur other invalid types block honge
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp']
    const ext = file.name.split('.').pop()?.toLowerCase() || ''

    if (!allowedExtensions.includes(ext)) {
      this.snackbar.error(`Invalid file type ".${ext}". Only jpg, jpeg, png, webp allowed.`)
      input.value = '' // input reset
      return
    }

    this.avatarFile = file

    // ✅ Instant preview — createObjectURL base64 encode nahi karta, isliye bada photo bhi turant dikhta hai
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl) // purana blob URL release
    this.objectUrl = URL.createObjectURL(file)
    this.avatarPreview = this.objectUrl
  }
}
  saveChanges() {
    // ✅ Validate travel days — sare fields filled hone chahiye
    const invalidTravel = this.preferredTravelDays.some(
      d => !d.goingTo || !d.going || !d.comingTo || !d.leaving
    )
    if (invalidTravel) {
      this.snackbar.error('Please fill all fields of each travel day.')
      return
    }

    // ✅ Company name aur Referred by dono registration par mandatory the —
    //    edit karte waqt inhe blank nahi chhoda ja sakta.
    if (!this.form.companyName?.trim()) {
      this.snackbar.error('Company name is required.')
      return
    }
    if (!this.form.referredBy?.trim()) {
      this.snackbar.error('Referred by is required.')
      return
    }

    this.isSaving = true
    const formData = new FormData()

    formData.append('fullName',    this.form.fullName)
    formData.append('phoneNumber', this.form.phoneNumber)
    formData.append('city',        this.form.city)
    formData.append('aboutUser',   this.form.aboutUser)
    formData.append('gender',      this.form.gender)
    formData.append('companyName', this.form.companyName.trim())
    formData.append('referredBy',  this.form.referredBy.trim())

    this.selectedPrefs.forEach(p => formData.append('preferences[]', p))

    if (this.avatarFile) formData.append('avatar', this.avatarFile)

    // ✅ Ek hi "Save Changes" button — profile + travel days + role sab save honge
    const requests: any = {
      profile: this.profileService.updateProfile(formData),
      travel:  this.profileService.updateTravelDays(this.preferredTravelDays),
    }

    // Role tabhi update hoga jab switch allowed ho aur user ne change kiya ho
    const roleChanged = this.canSwitchRole && this.selectedRole && this.selectedRole !== this.currentRole
    if (roleChanged) {
      requests.role = this.profileService.updateRole(this.selectedRole)
    }

    forkJoin(requests).subscribe({
      next: (res: any) => {
        const { profile, travel, role } = res
        console.log('Updated:', profile)
        if (profile.data?.avatarUrl) {
          this.avatarPreview = `${this.BASE}${profile.data.avatarUrl}`  // ✅
        }
        if (travel?.preferredTravelDays) {
          this.preferredTravelDays = travel.preferredTravelDays.map((t: TravelDay) => ({ ...t }))
        }
        if (role?.success) {
          this.currentRole  = role.role
          this.selectedRole = role.role
          this.roleOptions  = [role.role, ...(role.options || [])]
        }
        this.snackbar.success('Profile updated successfully!')
        this.router.navigate(['/about-you'])
        this.isSaving = false
      },
      error: (err) => {
        console.error('Update error', err)
        const msg = err?.error?.message || 'Something went wrong. Please try again.'
        this.snackbar.error(`Error: ${msg}`)
        this.isSaving = false
      }
    })
  }

  // ── Vehicle helpers ────────────────────────────────────────────────────────
  openAddVehicle() {
    this.vehicleDialog.open()
  }

  openEditVehicle(vehicle: Vehicle) {
    this.vehicleDialog.open(vehicle)
  }

  // Dialog add aur edit dono ke liye same event emit karta hai — _id se decide karo
  onVehicleSaved(vehicle: Vehicle) {
    const index = this.vehicles.findIndex(v => v._id === vehicle._id)
    if (index > -1) {
      this.vehicles = this.vehicles.map(v => (v._id === vehicle._id ? vehicle : v))
    } else {
      this.vehicles = [...this.vehicles, vehicle]
    }
  }

  deleteVehicle(vehicle: Vehicle) {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      width: '350px',
      data: {
        title: 'Delete Vehicle',
        message: `Are you sure you want to delete ${vehicle.model}?`,
      },
    })

    dialogRef.afterClosed().subscribe(confirmed => {
      if (!confirmed) return

      this.profileService.deleteVehicle(vehicle._id!).subscribe({
        next: () => {
          this.vehicles = this.vehicles.filter(v => v._id !== vehicle._id)
          this.snackbar.success('Vehicle removed successfully')
        },
        error: () => {
          this.snackbar.error('Failed to remove vehicle')
        },
      })
    })
  }

  vehicleIcon(type: string): string {
    const map: Record<string, string> = {
      car: '🚗', bike: '🏍️', suv: '🚙', van: '🚐', truck: '🚚',
    }
    return map[type?.toLowerCase()] ?? '🚗'
  }

  // ── Preferred travel days helpers ──
  addTravelDay() {
    this.preferredTravelDays.push({ goingTo: '', going: '', comingTo: '', leaving: '' })
  }

  removeTravelDay(index: number) {
    this.preferredTravelDays.splice(index, 1)
  }

  goBack() {
  this.router.navigate(['/about-you'])  // apna route lagao
}

cancel() {
  this.router.navigate(['/about-you'])  // apna route lagao
}
}