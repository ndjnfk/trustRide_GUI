import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AvailableRides } from './available-rides';

describe('AvailableRides', () => {
  let component: AvailableRides;
  let fixture: ComponentFixture<AvailableRides>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AvailableRides],
    }).compileComponents();

    fixture = TestBed.createComponent(AvailableRides);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
