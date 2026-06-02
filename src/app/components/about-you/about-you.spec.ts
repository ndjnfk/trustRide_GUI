import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AboutYou } from './about-you';

describe('AboutYou', () => {
  let component: AboutYou;
  let fixture: ComponentFixture<AboutYou>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AboutYou],
    }).compileComponents();

    fixture = TestBed.createComponent(AboutYou);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
