import { CommonModule, TitleCasePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  OnDestroy,
  Output,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProfileService, Vehicle } from '../../servies/profile-service';
import { Snackbar } from '../../services/snackbar';

declare const bootstrap: any;

@Component({
  selector: 'app-vehicle-dialog',
  imports: [CommonModule, FormsModule, TitleCasePipe],
  templateUrl: './vehicle-dialog.html',
  styleUrl: './vehicle-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VehicleDialog implements OnDestroy {
  readonly vehicleTypes = ['car', 'bike', 'suv', 'van', 'truck'];

  @Output() saved = new EventEmitter<Vehicle>();

  @ViewChild('modalEl', { static: true })
  modalEl!: ElementRef<HTMLDivElement>;

  editingVehicle: Vehicle | null = null;
  vehicleForm: Vehicle = this.emptyVehicle();
  isSaving = false;

  private modalInstance: any = null;

  constructor(
    private profileService: ProfileService,
    private snackBar: Snackbar,
    private cdr: ChangeDetectorRef,
  ) {}

  ngOnDestroy(): void {
    this.modalInstance?.dispose();
  }

  open(vehicle?: Vehicle | null): void {
    this.editingVehicle = vehicle ?? null;
    this.vehicleForm = vehicle ? { ...vehicle } : this.emptyVehicle();
    this.isSaving = false;
    this.cdr.detectChanges();

    if (!this.modalInstance) {
      this.modalInstance = new bootstrap.Modal(this.modalEl.nativeElement, {
        backdrop: 'static',
        keyboard: true,
      });
    }
    this.modalInstance.show();
  }

  close(): void {
    this.modalInstance?.hide();
  }

  vehicleIcon(type: string): string {
    const map: Record<string, string> = {
      car: '🚗', bike: '🏍️', suv: '🚙', van: '🚐', truck: '🚚',
    };
    return map[type?.toLowerCase()] ?? '🚗';
  }

  save(): void {
    this.isSaving = true;
    this.cdr.detectChanges();

    const req$ = this.editingVehicle
      ? this.profileService.updateVehicle({
          ...this.vehicleForm,
          _id: this.editingVehicle._id,
        })
      : this.profileService.addVehicle(this.vehicleForm);

    req$.subscribe({
      next: (res) => {
        this.isSaving = false;
        this.snackBar.success('Vehicle information saved successfully');
        this.saved.emit(res.vehicle);
        this.close();
      },
      error: (err) => {
        this.isSaving = false;
        if (err?.status === 400) {
          this.snackBar.error('Please fill in all required details and select a vehicle');
        } else {
          this.snackBar.error('Failed to save vehicle information');
        }
        this.cdr.detectChanges();
      },
    });
  }

  private emptyVehicle(): Vehicle {
    return { vehicle_type: '', model: '', plate_number: '', color: '', seat_capacity: 1 };
  }
}
