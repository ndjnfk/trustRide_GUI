import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SecurityQues } from './security-ques';

describe('SecurityQues', () => {
  let component: SecurityQues;
  let fixture: ComponentFixture<SecurityQues>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SecurityQues],
    }).compileComponents();

    fixture = TestBed.createComponent(SecurityQues);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
