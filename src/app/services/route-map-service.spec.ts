import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { decodePolyline, formatDuration } from './route-map-service';

describe('decodePolyline', () => {
  it('Google ka reference example decode hota hai', () => {
    // https://developers.google.com/maps/documentation/utilities/polylinealgorithm
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      [38.5, -120.2],
      [40.7, -120.95],
      [43.252, -126.453],
    ]);
  });

  it('khaali string par khaali list', () => {
    expect(decodePolyline('')).toEqual([]);
  });
});

describe('formatDuration', () => {
  it.each([
    [45, '45 min'],
    [60, '1 h'],
    [222, '3 h 42 min'],
    [0, '0 min'],
  ])('%i → %s', (min, text) => {
    expect(formatDuration(min)).toBe(text);
  });
});
