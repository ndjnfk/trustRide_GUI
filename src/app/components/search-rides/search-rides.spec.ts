import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchRides } from './search-rides';

describe('SearchRides', () => {
  let component: SearchRides;
  let fixture: ComponentFixture<SearchRides>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SearchRides],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchRides);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
