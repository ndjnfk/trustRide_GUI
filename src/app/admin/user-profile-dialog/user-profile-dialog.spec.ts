import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserProfileDialog } from './user-profile-dialog';

describe('UserProfileDialog', () => {
  let component: UserProfileDialog;
  let fixture: ComponentFixture<UserProfileDialog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserProfileDialog],
    }).compileComponents();

    fixture = TestBed.createComponent(UserProfileDialog);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
