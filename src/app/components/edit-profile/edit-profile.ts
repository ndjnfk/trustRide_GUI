import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Profileresponse, ProfileService, TravelDay } from '../../servies/profile-service';
import { Router } from '@angular/router';
import { Snackbar } from '../../services/snackbar';
import { environment } from '../../../../environment';
import { forkJoin } from 'rxjs';


@Component({
  selector: 'app-edit-profile',
  imports: [CommonModule, FormsModule],
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
  }

  allPreferences = [
    { key: 'quiet',      icon: 'ti-message-circle',  label: "I'm the quiet type" },
    { key: 'music',      icon: 'ti-music',            label: "It's all about playlist" },
    { key: 'smoking',    icon: 'ti-smoking-no',       label: 'No smoking' },
    { key: 'pets',       icon: 'ti-paw-off',          label: 'No pets' },
   
  ]

  selectedPrefs: string[] = []

  // ── Preferred travel days ──
  locations = ['Gurgaon', 'Saharanpur']
  days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  preferredTravelDays: TravelDay[] = []

  avatarFile: File | null = null
  avatarPreview: string = ''
    private readonly BASE = environment.apiUrl;
  isLoading = false
  isSaving = false

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

  constructor(private profileService: ProfileService,private router: Router,private snackbar:Snackbar) {}

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
        this.selectedPrefs    = d.preferences || []
        this.preferredTravelDays = (d.preferredTravelDays || []).map(t => ({ ...t }))
        
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

    this.isSaving = true
    const formData = new FormData()

    formData.append('fullName',    this.form.fullName)
    formData.append('phoneNumber', this.form.phoneNumber)
    formData.append('city',        this.form.city)
    formData.append('aboutUser',   this.form.aboutUser)
    formData.append('gender',      this.form.gender)

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