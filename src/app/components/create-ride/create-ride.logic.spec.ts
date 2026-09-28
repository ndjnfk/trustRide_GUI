import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { CreateRide } from './create-ride';
import { BLOCKED_CITY_PAIRS } from '../../helpers/route-rules';

/**
 * Create-ride ke route + price rules. Chandigarh/Mohali hatne ke baad sirf
 * Gurgaon ↔ Saharanpur live hai. Component ko seedha instantiate karte hain
 * (ngOnInit call nahi hota, to koi HTTP nahi).
 */
function makeComponent(): any {
  const noop = () => {};
  return new CreateRide(
    {} as any,                                   // Ride service
    {} as any,                                   // Snackbar
    { navigate: noop } as any,                   // Router
    { markForCheck: noop, detectChanges: noop } as any,
    { snapshot: { queryParamMap: { get: () => null } } } as any
  );
}

/** From/To set karke wahi sync chalao jo UI ke select handlers chalate hain. */
function setRoute(c: any, from: string, to: string) {
  c.selectFrom(from);
  c.selectTo(to);
}

describe('getBaseCity', () => {
  const c = makeComponent();

  it.each([
    ['Gurgaon', 'gurgaon'],
    ['Gurgaon Cyber Park', 'gurgaon'],
    ['Gurgaon Vatika Chowk', 'gurgaon'],
    ['Saharanpur', 'saharanpur'],
    ['Saharanpur Clock Tower', 'saharanpur'],
    ['Saharanpur Court Road', 'saharanpur'],
  ])('%s → %s', (area, expected) => {
    expect(c.getBaseCity(area)).toBe(expected);
  });

  it('koi city dusri ka substring nahi hai (galat match se bachne ke liye)', () => {
    const cities = ['gurgaon', 'saharanpur'];
    for (const a of cities) {
      for (const b of cities) {
        if (a !== b) expect(a.includes(b)).toBe(false);
      }
    }
  });
});

describe('area lists', () => {
  const c = makeComponent();

  it('dono cities ke areas allowed list mein hain', () => {
    const expected = [
      'Gurgaon', 'Gurgaon Ambience Mall', 'Gurgaon Cyber Park',
      'Saharanpur', 'Saharanpur Court Road', 'Saharanpur Madhav Nagar',
    ];
    for (const area of expected) expect(c.isKnownLocation(area)).toBe(true);
  });

  it('hataayi gayi cities ab valid nahi hain', () => {
    expect(c.isKnownLocation('Mohali')).toBe(false);
    expect(c.isKnownLocation('Mohali Sector 43')).toBe(false);
    expect(c.isKnownLocation('Chandigarh')).toBe(false);
    expect(c.isKnownLocation('Chandigarh Sector 17')).toBe(false);
  });

  it('free-text location allowed nahi hai', () => {
    expect(c.isKnownLocation('Panchkula')).toBe(false);
  });

  it('suggestions sirf bachi hui cities ke aate hain', () => {
    const c2 = makeComponent();
    c2.selectFrom('Gurgaon');
    c2.toLocation = 'Sahar';
    c2.onToInput();
    expect(c2.toSuggestions.length).toBeGreaterThan(0);
    expect(c2.toSuggestions.every((s: string) => s.startsWith('Saharanpur'))).toBe(true);

    c2.toLocation = 'Mohali';
    c2.onToInput();
    expect(c2.toSuggestions).toEqual([]);
  });
});

describe('blocked city pairs', () => {
  // Teeno purane blocked pairs Chandigarh/Mohali ke saath hi chale gaye.
  it('abhi koi blocked pair nahi hai', () => {
    expect(BLOCKED_CITY_PAIRS).toHaveLength(0);
  });

  const allowed: [string, string][] = [
    ['Gurgaon', 'Saharanpur'],
    ['Saharanpur', 'Gurgaon'],
  ];

  it.each(allowed)('%s → %s allowed hai', (from, to) => {
    const c = makeComponent();
    setRoute(c, from, to);
    expect(c.isBlockedRoute).toBe(false);
  });
});

describe('price range', () => {
  it('Gurgaon ↔ Saharanpur par range ₹420–₹550 hai', () => {
    const c = makeComponent();
    setRoute(c, 'Gurgaon', 'Saharanpur');
    expect(c.minPrice).toBe(420);
    expect(c.maxPrice).toBe(550);
    expect(c.pricePerSeat).toBe(450);   // default range ke andar hai → waisa hi
  });

  it('koi city route-optional nahi hai, isliye ₹350–₹390 band abhi lagta hi nahi', () => {
    const c = makeComponent();
    setRoute(c, 'Saharanpur', 'Gurgaon');
    expect(c.isRouteOptional).toBe(false);
    expect(c.minPrice).toBe(420);
  });

  it('+ button ₹550 se upar nahi jaata', () => {
    const c = makeComponent();
    setRoute(c, 'Gurgaon', 'Saharanpur');
    for (let i = 0; i < 30; i++) c.incrementPrice();
    expect(c.pricePerSeat).toBe(550);
  });

  it('− button ₹420 se neeche nahi jaata', () => {
    const c = makeComponent();
    setRoute(c, 'Gurgaon', 'Saharanpur');
    for (let i = 0; i < 30; i++) c.decrementPrice();
    expect(c.pricePerSeat).toBe(420);
  });

  it('range ke beech ke saare steps 10 ke multiple mein hain', () => {
    const c = makeComponent();
    setRoute(c, 'Gurgaon', 'Saharanpur');
    const seen: number[] = [c.pricePerSeat];
    for (let i = 0; i < 10; i++) { c.incrementPrice(); seen.push(c.pricePerSeat); }
    expect([...new Set(seen)]).toEqual([
      450, 460, 470, 480, 490, 500, 510, 520, 530, 540, 550,
    ]);
  });
});

describe('route selection', () => {
  it('Gurgaon ↔ Saharanpur par route zaroori hai', () => {
    const c = makeComponent();
    setRoute(c, 'Gurgaon', 'Saharanpur');
    c.rideDate = '2026-12-01';
    c.rideTime = '09:00';

    expect(c.isRouteOptional).toBe(false);
    expect(c.filteredRoutes.length).toBeGreaterThan(0);
    expect(c.isFormValid).toBe(false);          // route select nahi kiya

    c.selectRoute(c.filteredRoutes[0]);
    expect(c.isFormValid).toBe(true);
  });

  it('swap karne par ulti-direction ka stale route clear ho jaata hai', () => {
    const c = makeComponent();
    setRoute(c, 'Gurgaon', 'Saharanpur');
    c.selectRoute(c.filteredRoutes[0]);         // r1: gurgaon → saharanpur
    expect(c.selectedRouteId).toBe('r1');

    c.swapLocations();                          // ab Saharanpur → Gurgaon
    expect(c.selectedRouteId).toBe('');         // r1 is direction ka nahi hai
  });

  it('type karke city badalne par stale route clear ho jaata hai', () => {
    const c = makeComponent();
    setRoute(c, 'Gurgaon', 'Saharanpur');
    c.selectRoute(c.filteredRoutes[0]);
    expect(c.selectedRouteId).toBe('r1');

    c.fromLocation = 'Saharanpur';              // dropdown use kiye bina typed
    c.onFromInput();
    expect(c.selectedRouteId).toBe('');         // saharanpur → saharanpur ka koi route nahi
  });

  it('same city se same city par ride nahi ban sakti', () => {
    const c = makeComponent();
    setRoute(c, 'Saharanpur Clock Tower', 'Saharanpur Madhav Nagar');
    expect(c.isSameRoute).toBe(true);
    expect(c.isFormValid).toBe(false);
  });
});

describe('cityTag — dropdown chip label', () => {
  const c = makeComponent();

  it.each([
    ['Gurgaon Vatika Chowk', 'Gurgaon'],
    ['Saharanpur Sharda Nagar', 'Saharanpur'],
  ])('%s → %s', (area, label) => {
    expect(c.cityTag(area)).toBe(label);
  });
});
