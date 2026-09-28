import { describe, expect, it } from 'vitest';
import { BLOCKED_CITY_PAIRS, baseCityOf, isCityPairBlocked } from './route-rules';

describe('baseCityOf', () => {
  it.each([
    ['Gurgaon', 'gurgaon'],
    ['Gurgaon Cyber Park', 'gurgaon'],
    ['Saharanpur Court Road', 'saharanpur'],
    ['Saharanpur Clock Tower', 'saharanpur'],
    ['  saharanpur  ', 'saharanpur'],
    ['', ''],
  ])('%s → %s', (input, expected) => {
    expect(baseCityOf(input)).toBe(expected);
  });

  it('jo city naam pehle aata hai wahi base city hai', () => {
    // "Saharanpur Gurgaon Road" saharanpur ka area hai — check-order ki wajah
    // se galti se gurgaon nahi banna chahiye.
    expect(baseCityOf('Saharanpur Gurgaon Road')).toBe('saharanpur');
  });

  it('unknown location trimmed lowercase wapas deta hai', () => {
    expect(baseCityOf('  Meerut  ')).toBe('meerut');
  });
});

describe('isCityPairBlocked', () => {
  // Chandigarh/Mohali hatne ke baad koi pair blocked nahi bacha. Ye test
  // jaan-boojh kar hai: pair wapas add ho to neeche wale "allowed" cases
  // soch-samajh kar badalne padenge.
  it('abhi koi blocked pair nahi hai', () => {
    expect(BLOCKED_CITY_PAIRS).toHaveLength(0);
  });

  const allowed: [string, string][] = [
    ['Gurgaon', 'Saharanpur'],
    ['Saharanpur', 'Gurgaon'],
  ];

  it.each(allowed)('%s ↔ %s allowed', (a, b) => {
    expect(isCityPairBlocked(a, b)).toBe(false);
  });

  it('poore area names par bhi kaam karta hai', () => {
    expect(isCityPairBlocked('Gurgaon Cyber Park', 'Saharanpur Court Road')).toBe(false);
    expect(isCityPairBlocked('Saharanpur Clock Tower', 'Gurgaon Iffco Chowk')).toBe(false);
  });

  it('koi ek value khaali ho to blocked nahi maanta', () => {
    expect(isCityPairBlocked('Gurgaon', '')).toBe(false);
    expect(isCityPairBlocked('', 'Saharanpur')).toBe(false);
  });
});
