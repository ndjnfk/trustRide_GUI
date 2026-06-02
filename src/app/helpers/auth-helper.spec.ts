import { TestBed } from '@angular/core/testing';

import { AuthHelper } from './auth-helper';

describe('AuthHelper', () => {
  let service: AuthHelper;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuthHelper);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
