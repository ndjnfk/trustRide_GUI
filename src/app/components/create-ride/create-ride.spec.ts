import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CreateRide } from './create-ride';

describe('CreateRide', () => {
  let component: CreateRide;
  let fixture: ComponentFixture<CreateRide>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CreateRide],
    }).compileComponents();

    fixture = TestBed.createComponent(CreateRide);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
