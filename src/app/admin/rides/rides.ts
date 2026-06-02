import { CommonModule, DatePipe, UpperCasePipe } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { Adminservice } from '../../services/adminservice';
import { SideBar } from '../side-bar/side-bar';
import { Snackbar } from '../../services/snackbar';
import { LoaderServices } from '../../services/loader-services';

@Component({
  selector: 'app-rides',
  imports: [CommonModule, DatePipe, UpperCasePipe,SideBar],
  templateUrl: './rides.html',
  styleUrl: './rides.css',
})
export class Rides {
  rides: any[] = []
  totalRides = 0
  loading = false
  error = ''
  selectedRide: any = null
 
  private loader = inject(LoaderServices);

  constructor(private adminService: Adminservice, private cdr: ChangeDetectorRef,private snackbar:Snackbar) {}
 
  ngOnInit() {
    this.fetchRides()
  }
 
  fetchRides() {
    this.loading = true
    this.loader.show();
    this.error = ''

    this.adminService.getAllRides().subscribe({
      next: (res: any) => {
        this.rides = res.rides || []
        this.totalRides = res.total_rides || 0
        this.loading = false
        this.loader.hide();
          this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.error = 'Failed to load rides. Please try again.'
        this.loading = false
        this.loader.hide();
          this.cdr.detectChanges();
      }
    })
  }
 
  openBookings(ride: any) {
    this.selectedRide = ride
  }
 
  closePopup() {
    this.selectedRide = null
  }
 
  getStars(rating: number): number[] {
    return Array(rating).fill(0)
  }
 
  getEmptyStars(rating: number): number[] {
    return Array(5 - rating).fill(0)
  }

  deletingRideId: string | null = null
 
deleteRide(ride: any) {
  const confirmDelete = window.confirm(
   `Do you want to delete the ride from ${ride.start_location?.name} to ${ride.end_location?.name}?`
  )
  if (!confirmDelete) return

  this.deletingRideId = ride.ride_id

  this.adminService.deleteRide(ride.ride_id).subscribe({
    next: (res: any) => {
      this.deletingRideId = null
      this.fetchRides()  // ← bas yeh karo, filter ki zaroorat nahi
    },
    error: (err: any) => {
      this.snackbar.error('Delete failed. Please try again.')
      this.deletingRideId = null
    }
  })
}
}
