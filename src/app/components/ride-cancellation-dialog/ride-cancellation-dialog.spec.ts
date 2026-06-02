import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RideCancellationDialog } from './ride-cancellation-dialog';

describe('RideCancellationDialog', () => {
  let component: RideCancellationDialog;
  let fixture: ComponentFixture<RideCancellationDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RideCancellationDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(RideCancellationDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
