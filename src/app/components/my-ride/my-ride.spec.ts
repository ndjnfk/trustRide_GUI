import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MyRide } from './my-ride';

describe('MyRide', () => {
  let component: MyRide;
  let fixture: ComponentFixture<MyRide>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MyRide],
    }).compileComponents();

    fixture = TestBed.createComponent(MyRide);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
