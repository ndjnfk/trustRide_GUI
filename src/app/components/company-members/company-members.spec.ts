import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompanyMembers } from './company-members';

describe('CompanyMembers', () => {
  let component: CompanyMembers;
  let fixture: ComponentFixture<CompanyMembers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompanyMembers],
    }).compileComponents();

    fixture = TestBed.createComponent(CompanyMembers);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
