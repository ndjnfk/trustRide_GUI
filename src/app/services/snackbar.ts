import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root',
})
export class Snackbar {
   constructor(private snackBar: MatSnackBar) {}

  success(message: string): void {
    this.open(message, 'success');
  }

  error(message: string): void {
    this.open(message, 'error');
  }

  info(message: string): void {
    this.open(message, 'info');
  }

  warning(message: string): void {
    this.open(message, 'warning');
  }

  private open(
    message: string,
    type: 'success' | 'error' | 'info' | 'warning'
  ): void {

    let panelClass = '';

    switch (type) {
      case 'success':
        panelClass = 'snack-success';
        break;

      case 'error':
        panelClass = 'snack-error';
        break;

      case 'info':
        panelClass = 'snack-info';
        break;

      case 'warning':
        panelClass = 'snack-warning';
        break;
    }

    this.snackBar.open(message, 'Close', {
      duration: 4000,
      horizontalPosition: 'right',
      verticalPosition: 'top',
      panelClass: [panelClass],
    });
  }
}
