import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BlablaRideService, CreateBlablaRidePayload } from '../../services/blabla-ride';
import { LoaderServices } from '../../services/loader-services';
import { Snackbar } from '../../services/snackbar';

/**
 * User panel ka BlaBla ride form.
 *
 * Bina login ke khulta hai — na koi token, na guard. Pehchan sirf form wala
 * email hai: backend use `users` me dhoondhta hai aur admin-verified hone par
 * hi ride publish karta hai, isliye yahan sirf shakal-surat ki validation hai.
 * Ride admin wali hi collection me jaati hai, bas email extra hota hai.
 */
@Component({
  selector: 'app-create-blabla-ride',
  imports: [CommonModule, FormsModule],
  templateUrl: './create-blabla-ride.html',
  styleUrl: './create-blabla-ride.css',
})
export class CreateBlablaRide {
  /** Sirf ye do base cities — baaki sab inhi ke areas hain. */
  readonly cities: string[] = ['Gurgaon', 'Saharanpur'];

  form: CreateBlablaRidePayload = this.emptyForm();

  submitting = false;
  /** Publish hone ke baad success panel dikhta hai, form nahi. */
  published = false;
  /** Inline error — snackbar chala jaata hai, ye screen par tika rehta hai. */
  error = '';
  /** Backend ka error_code — verification wale case me extra hint dikhane ke liye. */
  errorCode = '';

  private loader = inject(LoaderServices);

  constructor(
    private blablaService: BlablaRideService,
    private snackbar: Snackbar,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  private emptyForm(): CreateBlablaRidePayload {
    return {
      source: 'Gurgaon',
      destination: 'Saharanpur',
      ride_date: '',
      ride_time: '',
      url: '',
      rider_name: '',
      user_email: '',
    };
  }

  /** Aaj se pehle ki date pick na ho sake — backend bhi wahi reject karta hai. */
  get minDate(): string {
    return new Date(Date.now() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);
  }

  // Sirf do hi routes hain — ek badlo to doosra apne aap set ho jaata hai.
  onSourceChange(): void {
    this.form.destination = this.form.source === 'Gurgaon' ? 'Saharanpur' : 'Gurgaon';
  }

  onDestinationChange(): void {
    this.form.source = this.form.destination === 'Gurgaon' ? 'Saharanpur' : 'Gurgaon';
  }

  /** Returns an error message, or '' when the form is good to send. */
  private validate(): string {
    const f = this.form;
    if (!f.user_email.trim()) return 'Your registered email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.user_email.trim())) {
      return 'Please enter a valid email address';
    }
    if (!f.source || !f.destination) return 'Source and destination are required';
    if (f.source === f.destination) return 'Source and destination cannot be the same city';
    if (!f.ride_date) return 'Departure date is required';
    if (f.ride_date < this.minDate) return 'Departure date cannot be in the past';
    if (!f.ride_time) return 'Departure time is required';
    if (!f.rider_name.trim()) return 'Rider name is required';
    if (!f.url.trim()) return 'BlaBlaCar URL is required';
    if (!/^https?:\/\/.+/i.test(f.url.trim())) return 'URL must start with http:// or https://';
    return '';
  }

  private clean(): CreateBlablaRidePayload {
    const f = this.form;
    return {
      source: f.source,
      destination: f.destination,
      ride_date: f.ride_date,
      // <input type="time"> kabhi "HH:mm:ss" deta hai — API ko HH:mm hi chahiye.
      ride_time: f.ride_time.slice(0, 5),
      url: f.url.trim(),
      rider_name: f.rider_name.trim(),
      user_email: f.user_email.trim(),
    };
  }

  submit(): void {
    if (this.submitting) return;

    const problem = this.validate();
    if (problem) {
      this.error = problem;
      this.errorCode = '';
      this.snackbar.error(problem);
      return;
    }

    this.submitting = true;
    this.error = '';
    this.errorCode = '';
    this.loader.show();

    this.blablaService.createBlablaRide(this.clean()).subscribe({
      next: (res: any) => {
        this.submitting = false;
        this.published = true;
        this.loader.hide();
        this.snackbar.success(res?.message || 'BlaBla ride published');
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.submitting = false;
        this.loader.hide();
        this.errorCode = err?.error?.error_code || '';
        this.error = this.readError(err, 'Could not publish this ride. Please try again.');
        this.snackbar.error(this.error);
        this.cdr.detectChanges();
      },
    });
  }

  /** Ek aur ride daalni ho to sirf route/date/time reset karo — email wahi rakho. */
  publishAnother(): void {
    const email = this.form.user_email;
    const rider = this.form.rider_name;
    this.form = { ...this.emptyForm(), user_email: email, rider_name: rider };
    this.published = false;
    this.error = '';
    this.errorCode = '';
  }

  goToRides(): void {
    this.router.navigate(['/blabla-rides']);
  }

  goToRegister(): void {
    this.router.navigate(['/register']);
  }

  // AdonisJS validator 422 par { errors: [{ message }] } bhejta hai, baaki jagah { message }.
  private readError(err: any, fallback: string): string {
    return err?.error?.errors?.[0]?.message || err?.error?.message || fallback;
  }
}
