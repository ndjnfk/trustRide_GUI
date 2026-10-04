import '@angular/compiler';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CreateRide } from './create-ride';
import { BLOCKED_CITY_PAIRS, setBaseCities } from '../../helpers/route-rules';
import { of } from 'rxjs';

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

describe('admin panel se judi nayi master city', () => {
  afterEach(() => setBaseCities([]));

  /** Jaise LocationService API se list laakar karta hai. */
  function withDehradun(): any {
    setBaseCities(['dehradun']);
    const c = makeComponent();
    c.allLocations = [...c.allLocations, 'Dehradun', 'Dehradun ISBT'];
    return c;
  }

  it('nayi city ke areas valid locations hain', () => {
    const c = withDehradun();
    expect(c.isKnownLocation('Dehradun ISBT')).toBe(true);
    expect(c.getBaseCity('Dehradun ISBT')).toBe('dehradun');
    expect(c.cityTag('Dehradun ISBT')).toBe('Dehradun');
  });

  it('bina preset route waali jodi par route optional aur ₹350–₹390 band', () => {
    const c = withDehradun();
    setRoute(c, 'Gurgaon Cyber Park', 'Dehradun ISBT');
    expect(c.isRouteOptional).toBe(true);
    expect(c.minPrice).toBe(350);
    expect(c.maxPrice).toBe(390);
    expect(c.pricePerSeat).toBe(350);
  });

  it('Gurgaon ↔ Saharanpur par preset rules waise hi', () => {
    const c = withDehradun();
    setRoute(c, 'Gurgaon', 'Saharanpur');
    expect(c.isRouteOptional).toBe(false);
    expect(c.minPrice).toBe(420);
  });

  it('nayi city ke andar hi trip same-route maana jaata hai', () => {
    const c = withDehradun();
    c.fromLocation = 'Dehradun';
    c.toLocation = 'Dehradun ISBT';
    expect(c.isSameRoute).toBe(true);
  });
});

describe('wizard steps', () => {
  afterEach(() => setBaseCities([]));

  it('Gurgaon ↔ Saharanpur par 5 steps, route chune bina aage nahi', () => {
    const c = makeComponent();
    expect(c.steps.map((s: any) => s.key)).toEqual(['route', 'via', 'when', 'seats', 'price']);
    expect(c.canContinue).toBe(false);
    setRoute(c, 'Saharanpur', 'Gurgaon Cyber Park');
    expect(c.canContinue).toBe(true);
  });

  it('Via step par pehla route apne aap chuna jaata hai', () => {
    const c = makeComponent();
    setRoute(c, 'Saharanpur', 'Gurgaon Cyber Park');
    c.nextStep();
    expect(c.currentStep).toBe('via');
    expect(c.selectedRouteId).toBe('r1r');
    expect(c.pricePerSeat).toBe(440);
  });

  it('date/time ke bina When step aage nahi badhta', () => {
    const c = makeComponent();
    setRoute(c, 'Gurgaon', 'Saharanpur');
    c.nextStep();
    c.nextStep();
    expect(c.currentStep).toBe('when');
    expect(c.canContinue).toBe(false);
    c.rideDate = '2999-01-01';
    c.rideTime = '07:30';
    expect(c.canContinue).toBe(true);
  });

  it('nayi city par Via step hat jaata hai (4 steps)', () => {
    setBaseCities(['dehradun']);
    const c = makeComponent();
    c.allLocations = [...c.allLocations, 'Dehradun', 'Dehradun ISBT'];
    setRoute(c, 'Gurgaon', 'Dehradun ISBT');
    expect(c.steps.map((s: any) => s.key)).toEqual(['route', 'when', 'seats', 'price']);
    c.nextStep();
    expect(c.currentStep).toBe('when');
  });

  it('earnings card route step ke baad hi dikhta hai', () => {
    const c = makeComponent();
    setRoute(c, 'Gurgaon', 'Saharanpur');
    expect(c.earningsReady).toBe(false);
    c.nextStep();
    expect(c.earningsReady).toBe(true);
  });

  it('Back aur stepper se sirf pichhle step par', () => {
    const c = makeComponent();
    setRoute(c, 'Gurgaon', 'Saharanpur');
    c.nextStep();
    c.goToStep(3);
    expect(c.step).toBe(1);
    c.prevStep();
    expect(c.step).toBe(0);
  });

  it('popular routes preset routes se banti hain', () => {
    const c = makeComponent();
    expect(c.popularRoutes.map((p: any) => `${p.fromName}>${p.toName}:${p.distance}:${p.price}`)).toEqual([
      'Gurgaon>Saharanpur:210:440',
      'Saharanpur>Gurgaon:210:440',
    ]);
  });
});

describe('price quote (admin ka formula)', () => {
  const noop = () => {};
  const quote = (over: any = {}) => ({
    distance_km: 194.1,
    duration_min: 158,
    approximate: false,
    suggested: 410,
    min: 360,
    max: 460,
    step: 10,
    breakdown: {
      fuel_litres: 12.94, fuel_cost: 1229.3, fuel_per_seat: 409.77, platform_fee: 0,
      fuel_price_per_litre: 95, mileage_kmpl: 15, cost_sharing_seats: 3, rider_adjust: 50,
    },
    ...over,
  });

  /** Nakli RouteMapService — turant jawab deta hai */
  function withQuote(response: any): any {
    const calls: string[] = [];
    const c = new CreateRide(
      {} as any, {} as any, { navigate: noop } as any,
      { markForCheck: noop, detectChanges: noop } as any,
      { snapshot: { queryParamMap: { get: () => null } } } as any,
      undefined,
      {
        getPriceQuote: (f: string, t: string) => { calls.push(`${f}>${t}`); return of(response); },
        getRouteOptions: () => of({ success: false, from: null, to: null, routes: [] }),
      } as any
    ) as any;
    c.calls = calls;
    return c;
  }

  it('route step se aage badhte hi quote aata hai aur suggested price lagta hai', () => {
    const c = withQuote({ success: true, quote: quote() });
    setRoute(c, 'Gurgaon Cyber Park', 'Saharanpur');
    c.nextStep();
    expect(c.calls).toEqual(['Gurgaon Cyber Park>Saharanpur']);
    expect(c.pricePerSeat).toBe(410);
    expect(c.minPrice).toBe(360);
    expect(c.maxPrice).toBe(460);
  });

  it('via chunne se price nahi badalta — distance se bana hai', () => {
    const c = withQuote({ success: true, quote: quote() });
    setRoute(c, 'Gurgaon', 'Saharanpur');
    c.nextStep();
    expect(c.currentStep).toBe('via');
    expect(c.pricePerSeat).toBe(410);
  });

  it('rider sirf ±range me − / + kar sakta hai', () => {
    const c = withQuote({ success: true, quote: quote() });
    setRoute(c, 'Gurgaon', 'Saharanpur');
    c.nextStep();
    for (let i = 0; i < 20; i++) c.incrementPrice();
    expect(c.pricePerSeat).toBe(460);
    for (let i = 0; i < 20; i++) c.decrementPrice();
    expect(c.pricePerSeat).toBe(360);
  });

  it('route badla to purana quote nahi lagta', () => {
    const c = withQuote({ success: true, quote: quote() });
    setRoute(c, 'Gurgaon', 'Saharanpur');
    c.nextStep();
    c.prevStep();
    c.fromLocation = 'Saharanpur';
    c.toLocation = 'Gurgaon';
    expect(c.activeQuote).toBeNull();
    expect(c.minPrice).toBe(420); // fallback jab tak naya quote na aaye
  });

  it('quote na mile to purani fixed range fallback', () => {
    const c = withQuote({ success: false, message: 'down' });
    setRoute(c, 'Gurgaon', 'Saharanpur');
    c.nextStep();
    expect(c.quoteError).toBe('down');
    expect(c.minPrice).toBe(420);
    expect(c.maxPrice).toBe(550);
  });

  it('TrustRide fee dikhti hai par rider ki kamai se nahi katti', () => {
    const q = quote({ breakdown: { ...quote().breakdown, platform_fee: 20 } });
    const c = withQuote({ success: true, quote: q });
    setRoute(c, 'Gurgaon', 'Saharanpur');
    c.nextStep();
    c.seats = 2;
    expect(c.platformFee).toBe(20);
    expect(c.totalEarnings).toBe(820);
    expect(c.riderReceives).toBe(820);
  });
});


describe('live raaste (map se "What is your route?")', () => {
  const noop = () => {};
  afterEach(() => setBaseCities([]));

  const route = (min: number, km: number, summary: string) => ({ duration_min: min, distance_km: km, polyline: 'abc', summary, tolls: 4 });
  const ok = { success: true, from: null, to: null, routes: [route(197, 218, 'NH344G'), route(190, 203, 'NH344G, NH48')] };

  function withRoutes(response: any): any {
    const payloads: any[] = [];
    const c = new CreateRide(
      { createRide: (p: any) => { payloads.push(p); return of({ ride_id: 'x' }); } } as any,
      { success: noop, error: noop } as any,
      { navigate: noop } as any,
      { markForCheck: noop, detectChanges: noop } as any,
      { snapshot: { queryParamMap: { get: () => null } } } as any,
      undefined,
      {
        getPriceQuote: () => of({ success: false }),
        // Array = har call par agla jawab (toll retry test ke liye)
        getRouteOptions: () => of(Array.isArray(response) ? response.shift() : response),
      } as any
    ) as any;
    c.payloads = payloads;
    return c;
  }

  it('route step ke baad raaste aate hain, pehla chuna hota hai, fastest min duration wala', () => {
    const c = withRoutes(ok);
    setRoute(c, 'Gurgaon', 'Saharanpur');
    c.nextStep();
    expect(c.currentStep).toBe('via');
    expect(c.liveRoutes.length).toBe(2);
    expect(c.selectedLive).toBe(0);
    expect(c.fastestLiveIndex).toBe(1);
    expect(c.canContinue).toBe(true);
  });

  it('publish me chuna rasta aur uski sadakein jaati hain', () => {
    const c = withRoutes(ok);
    setRoute(c, 'Gurgaon', 'Saharanpur');
    c.nextStep();
    c.selectLiveRoute(1);
    c.rideDate = '2999-01-01';
    c.rideTime = '07:30';
    c.publishRide();
    expect(c.payloads.length).toBe(1);
    expect(c.payloads[0].route_via).toBe('NH344G, NH48');
    expect(c.payloads[0].route).toEqual({ distance_km: 203, duration_min: 190, polyline: 'abc', summary: 'NH344G, NH48', tolls: 4 });
  });

  it('toll label: 0 = No tolls, ginti ke saath plural', () => {
    const c = withRoutes(ok);
    expect(c.tollLabel(0)).toBe('No tolls');
    expect(c.tollLabel(1)).toBe('1 toll');
    expect(c.tollLabel(4)).toBe('4 tolls');
  });

  it('toll pehli baar na aaye to thodi der baad dobara poochh ke bhar deta hai', () => {
    vi.useFakeTimers();
    try {
      const line = (tolls: number | null) => ({ duration_min: 222, distance_km: 251, polyline: 'p1', summary: 'NH307', tolls });
      const c = withRoutes([
        { success: true, from: null, to: null, routes: [line(null)] },
        { success: true, from: null, to: null, routes: [line(null)] },
        { success: true, from: null, to: null, routes: [line(5)] },
      ]);
      setRoute(c, 'Gurgaon', 'Saharanpur');
      c.nextStep();
      const shown = c.liveRoutes[0];
      expect(shown.tolls).toBeNull();
      vi.advanceTimersByTime(5000);
      expect(shown.tolls).toBeNull();
      vi.advanceTimersByTime(5000);
      expect(shown.tolls).toBe(5);
      expect(c.liveRoutes[0]).toBe(shown); // wahi object — map dobara nahi banta
    } finally {
      vi.useRealTimers();
    }
  });

  it('chune raaste ki km + toll se quote dobara aata hai (price me toll ÷ 4)', () => {
    const calls: string[] = [];
    const c = new CreateRide(
      {} as any, {} as any, { navigate: noop } as any,
      { markForCheck: noop, detectChanges: noop } as any,
      { snapshot: { queryParamMap: { get: () => null } } } as any,
      undefined,
      {
        getPriceQuote: (_f: string, _t: string, pick: any = {}) => {
          const tolls = pick.tolls ?? 0;
          calls.push(`${pick.route ?? '-'}:${tolls}`);
          const suggested = 440 + Math.round((tolls * 100) / 4 / 10) * 10;
          return of({ success: true, quote: { distance_km: 218, duration_min: 197, approximate: false, suggested, min: suggested - 50, max: suggested + 50, step: 10, breakdown: {} } });
        },
        getRouteOptions: () => of({
          success: true, from: null, to: null,
          routes: [
            { duration_min: 222, distance_km: 254, polyline: 'a', summary: 'DDE', tolls: 5 },
            { duration_min: 235, distance_km: 265, polyline: 'b', summary: 'DDE', tolls: 0 },
          ],
        }),
      } as any
    ) as any;
    setRoute(c, 'Gurgaon', 'Saharanpur');
    c.nextStep();
    // pehle bina raaste ke (sabse tez), raaste aate hi pehla rasta + uske 5 toll
    expect(calls).toEqual(['-:0', '0:5']);
    expect(c.pricePerSeat).toBe(570); // 440 + 500/4 = 565 → 570
    c.selectLiveRoute(1);
    expect(calls).toEqual(['-:0', '0:5', '1:0']);
    expect(c.pricePerSeat).toBe(440);
  });

  it('nayi city par bhi live raaste milein to Via step dikhta hai', () => {
    setBaseCities(['dehradun']);
    const c = withRoutes(ok);
    c.allLocations = [...c.allLocations, 'Dehradun', 'Dehradun ISBT'];
    setRoute(c, 'Gurgaon', 'Dehradun ISBT');
    c.nextStep();
    expect(c.steps.map((s: any) => s.key)).toEqual(['route', 'via', 'when', 'seats', 'price']);
    expect(c.currentStep).toBe('via');
  });

  it('raaste na milein to preset routes fallback', () => {
    const c = withRoutes({ success: false, from: null, to: null, routes: [] });
    setRoute(c, 'Saharanpur', 'Gurgaon');
    c.nextStep();
    expect(c.liveRoutes.length).toBe(0);
    expect(c.selectedRouteId).toBe('r1r');
    expect(c.canContinue).toBe(true);
  });

  it('from/to badla to purane raaste nahi lagte', () => {
    const c = withRoutes(ok);
    setRoute(c, 'Gurgaon', 'Saharanpur');
    c.nextStep();
    c.prevStep();
    c.swapLocations();
    expect(c.liveRoutes.length).toBe(0);
    expect(c.selectedLiveRoute).toBeNull();
  });
});
