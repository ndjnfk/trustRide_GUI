import { TestBed } from '@angular/core/testing';

import { LoaderServices } from './loader-services';

describe('LoaderServices', () => {
  let service: LoaderServices;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LoaderServices);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
