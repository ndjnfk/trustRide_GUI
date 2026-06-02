import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OneRideDetails } from './one-ride-details';

describe('OneRideDetails', () => {
  let component: OneRideDetails;
  let fixture: ComponentFixture<OneRideDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OneRideDetails],
    }).compileComponents();

    fixture = TestBed.createComponent(OneRideDetails);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
