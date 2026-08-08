import { describe, expect, it } from 'vitest';
import { baseCityOf, isCityPairBlocked } from './route-rules';

describe('baseCityOf', () => {
  it.each([
    ['Gurgaon', 'gurgaon'],
    ['Gurgaon Cyber Park', 'gurgaon'],
    ['Saharanpur Court Road', 'saharanpur'],
    ['Mohali Sector 43', 'mohali'],
    ['Chandigarh Sector 17', 'chandigarh'],
    ['  mohali  ', 'mohali'],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(baseCityOf(input)).toBe(expected);
  });
});

describe('isCityPairBlocked', () => {
  const blocked: [string, string][] = [
    ['Gurgaon', 'Mohali'],
    ['Mohali', 'Gurgaon'],
    ['Gurgaon', 'Chandigarh'],
    ['Chandigarh', 'Gurgaon'],
    ['Mohali', 'Chandigarh'],
    ['Chandigarh', 'Mohali'],
  ];

  it.each(blocked)('%s ↔ %s blocked', (a, b) => {
    expect(isCityPairBlocked(a, b)).toBe(true);
  });

  const allowed: [string, string][] = [
    ['Gurgaon', 'Saharanpur'],
    ['Saharanpur', 'Gurgaon'],
    ['Saharanpur', 'Mohali'],
    ['Mohali', 'Saharanpur'],
    ['Saharanpur', 'Chandigarh'],
    ['Chandigarh', 'Saharanpur'],
  ];

  it.each(allowed)('%s ↔ %s allowed', (a, b) => {
    expect(isCityPairBlocked(a, b)).toBe(false);
  });

  it('poore area names par bhi kaam karta hai', () => {
    expect(isCityPairBlocked('Gurgaon Cyber Park', 'Mohali Sector 43')).toBe(true);
    expect(isCityPairBlocked('Saharanpur Clock Tower', 'Chandigarh Sector 17')).toBe(false);
  });

  it('koi ek value khaali ho to blocked nahi maanta', () => {
    expect(isCityPairBlocked('Gurgaon', '')).toBe(false);
    expect(isCityPairBlocked('', 'Mohali')).toBe(false);
  });
});
