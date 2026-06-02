import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RidePopup } from './ride-popup';

describe('RidePopup', () => {
  let component: RidePopup;
  let fixture: ComponentFixture<RidePopup>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RidePopup],
    }).compileComponents();

    fixture = TestBed.createComponent(RidePopup);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
