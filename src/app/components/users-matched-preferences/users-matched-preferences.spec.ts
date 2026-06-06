import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UsersMatchedPreferences } from './users-matched-preferences';

describe('UsersMatchedPreferences', () => {
  let component: UsersMatchedPreferences;
  let fixture: ComponentFixture<UsersMatchedPreferences>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UsersMatchedPreferences],
    }).compileComponents();

    fixture = TestBed.createComponent(UsersMatchedPreferences);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
