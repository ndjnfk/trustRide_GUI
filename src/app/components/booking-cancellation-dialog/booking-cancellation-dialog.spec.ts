import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BookingCancellationDialog } from './booking-cancellation-dialog';

describe('BookingCancellationDialog', () => {
  let component: BookingCancellationDialog;
  let fixture: ComponentFixture<BookingCancellationDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BookingCancellationDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(BookingCancellationDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
