import '@angular/compiler';
import { describe, expect, it } from 'vitest';
import { CreateRide } from './create-ride';

/**
 * Mohali / Chandigarh areas add karne ke baad create-ride ki
 * route + price rules verify karta hai. Component ko seedha
 * instantiate karte hain (ngOnInit call nahi hota, to koi HTTP nahi).
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

describe('getBaseCity — naye areas', () => {
  const c = makeComponent();

  it.each([
    ['Mohali', 'mohali'],
    ['Mohali Sohana Gurdwara', 'mohali'],
    ['Mohali Homeland', 'mohali'],
    ['Mohali Bestech Towers', 'mohali'],
    ['Mohali Bhena Da Dhaba', 'mohali'],
    ['Mohali Sector 43', 'mohali'],
    ['Chandigarh', 'chandigarh'],
    ['Chandigarh Sector 17', 'chandigarh'],
    ['Gurgaon Cyber Park', 'gurgaon'],
    ['Saharanpur Clock Tower', 'saharanpur'],
  ])('%s → %s', (area, expected) => {
    expect(c.getBaseCity(area)).toBe(expected);
  });

  it('koi city dusri ka substring nahi hai (galat match se bachne ke liye)', () => {
    const cities = ['gurgaon', 'saharanpur', 'mohali', 'chandigarh'];
    for (const a of cities) {
      for (const b of cities) {
        if (a !== b) expect(a.includes(b)).toBe(false);
      }
    }
  });
});

describe('area lists', () => {
  const c = makeComponent();

  it('saare naye areas allowed list mein hain', () => {
    const expected = [
      'Mohali', 'Mohali Sohana Gurdwara', 'Mohali Homeland',
      'Mohali Bestech Towers', 'Mohali Bhena Da Dhaba', 'Mohali Sector 43',
      'Chandigarh', 'Chandigarh Sector 17',
    ];
    for (const area of expected) expect(c.isKnownLocation(area)).toBe(true);
  });

  it('purane areas abhi bhi valid hain', () => {
    expect(c.isKnownLocation('Gurgaon Ambience Mall')).toBe(true);
    expect(c.isKnownLocation('Saharanpur Court Road')).toBe(true);
  });

  it('free-text location allowed nahi hai', () => {
    expect(c.isKnownLocation('Panchkula')).toBe(false);
  });
});

describe('blocked city pairs — dono direction', () => {
  const blocked: [string, string][] = [
    ['Gurgaon', 'Mohali'],
    ['Mohali', 'Gurgaon'],
    ['Gurgaon', 'Chandigarh'],
    ['Chandigarh', 'Gurgaon'],
    ['Mohali', 'Chandigarh'],
    ['Chandigarh', 'Mohali'],
  ];

  it.each(blocked)('%s → %s blocked hai aur publish nahi ho sakta', (from, to) => {
    const c = makeComponent();
    setRoute(c, from, to);
    c.rideDate = '2026-12-01';
    c.rideTime = '09:00';
    expect(c.isBlockedRoute).toBe(true);
    expect(c.isFormValid).toBe(false);
  });

  const allowed: [string, string][] = [
    ['Gurgaon', 'Saharanpur'],
    ['Saharanpur', 'Gurgaon'],
    ['Saharanpur', 'Mohali'],
    ['Mohali', 'Saharanpur'],
    ['Saharanpur', 'Chandigarh'],
    ['Chandigarh', 'Saharanpur'],
  ];

  it.each(allowed)('%s → %s allowed hai', (from, to) => {
    const c = makeComponent();
    setRoute(c, from, to);
    expect(c.isBlockedRoute).toBe(false);
  });

  it('blocked cities suggestions mein nahi aate', () => {
    const c = makeComponent();
    c.selectFrom('Gurgaon');
    c.toLocation = 'Mohali';
    c.onToInput();
    expect(c.toSuggestions).toEqual([]);

    c.toLocation = 'Chandigarh';
    c.onToInput();
    expect(c.toSuggestions).toEqual([]);
  });

  it('allowed city ke suggestions aate hain', () => {
    const c = makeComponent();
    c.selectFrom('Saharanpur');
    c.toLocation = 'Mohali';
    c.onToInput();
    expect(c.toSuggestions.length).toBeGreaterThan(0);
    expect(c.toSuggestions.every((s: string) => s.startsWith('Mohali'))).toBe(true);
  });
});

describe('price range', () => {
  it('Saharanpur ↔ Mohali par ₹350–₹390', () => {
    const c = makeComponent();
    setRoute(c, 'Saharanpur', 'Mohali Homeland');
    expect(c.minPrice).toBe(350);
    expect(c.maxPrice).toBe(390);
    expect(c.pricePerSeat).toBe(350);   // default 450 range se bahar tha → reset
  });

  it('Saharanpur ↔ Chandigarh par ₹350–₹390', () => {
    const c = makeComponent();
    setRoute(c, 'Chandigarh Sector 17', 'Saharanpur');
    expect(c.minPrice).toBe(350);
    expect(c.maxPrice).toBe(390);
    expect(c.pricePerSeat).toBe(350);
  });

  it('Gurgaon ↔ Saharanpur par purani range ₹420–₹550 bani hui hai', () => {
    const c = makeComponent();
    setRoute(c, 'Gurgaon', 'Saharanpur');
    expect(c.minPrice).toBe(420);
    expect(c.maxPrice).toBe(550);
  });

  it('+ button ₹390 se upar nahi jaata', () => {
    const c = makeComponent();
    setRoute(c, 'Saharanpur', 'Chandigarh');
    for (let i = 0; i < 20; i++) c.incrementPrice();
    expect(c.pricePerSeat).toBe(390);
  });

  it('− button ₹350 se neeche nahi jaata', () => {
    const c = makeComponent();
    setRoute(c, 'Saharanpur', 'Chandigarh');
    for (let i = 0; i < 20; i++) c.decrementPrice();
    expect(c.pricePerSeat).toBe(350);
  });

  it('range ke beech ke saare steps 10 ke multiple mein hain', () => {
    const c = makeComponent();
    setRoute(c, 'Saharanpur', 'Chandigarh');
    const seen: number[] = [c.pricePerSeat];
    for (let i = 0; i < 10; i++) { c.incrementPrice(); seen.push(c.pricePerSeat); }
    expect([...new Set(seen)]).toEqual([350, 360, 370, 380, 390]);
  });

  it('city badalne par price nayi range mein aa jaata hai', () => {
    const c = makeComponent();
    setRoute(c, 'Saharanpur', 'Chandigarh');
    expect(c.pricePerSeat).toBe(350);

    c.selectTo('Gurgaon');                 // ab Saharanpur ↔ Gurgaon
    expect(c.minPrice).toBe(420);
    expect(c.pricePerSeat).toBeGreaterThanOrEqual(420);
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

  it('Saharanpur ↔ Chandigarh par route ke bina publish ho jaata hai', () => {
    const c = makeComponent();
    setRoute(c, 'Saharanpur', 'Chandigarh Sector 17');
    c.rideDate = '2026-12-01';
    c.rideTime = '09:00';

    expect(c.isRouteOptional).toBe(true);
    expect(c.filteredRoutes).toEqual([]);       // koi preset route nahi
    expect(c.selectedRouteId).toBe('');
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

    c.fromLocation = 'Chandigarh';              // dropdown use kiye bina typed
    c.onFromInput();
    expect(c.selectedRouteId).toBe('');
    expect(c.pricePerSeat).toBeLessThanOrEqual(390);
  });

  it('same city se same city par ride nahi ban sakti', () => {
    const c = makeComponent();
    setRoute(c, 'Mohali Homeland', 'Mohali Sector 43');
    expect(c.isSameRoute).toBe(true);
    expect(c.isFormValid).toBe(false);
  });
});

describe('cityTag — dropdown chip label', () => {
  const c = makeComponent();

  it.each([
    ['Mohali Sector 43', 'Mohali'],
    ['Chandigarh Sector 17', 'Chandigarh'],
    ['Gurgaon Vatika Chowk', 'Gurgaon'],
    ['Saharanpur Sharda Nagar', 'Saharanpur'],
  ])('%s → %s', (area, label) => {
    expect(c.cityTag(area)).toBe(label);
  });
});
