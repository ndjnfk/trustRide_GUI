/**
 * Route rules ek hi jagah — create-ride, register aur edit-profile teeno
 * yahin se padhte hain taaki rule kahin alag na ho jaaye.
 */

/**
 * App ki default base cities — baaki saare location names inhi ke andar ke areas hain.
 * Admin panel se jodi gayi cities LocationService `setBaseCities()` se judti hain.
 */
export const BASE_CITIES = ['gurgaon', 'saharanpur'] as const;

let baseCities: string[] = [...BASE_CITIES];

/** Abhi jitni base cities pata hain (default + admin wali), lowercase. */
export function getBaseCities(): readonly string[] {
  return baseCities;
}

/** Admin wali cities register karo. Default cities kabhi nahi hatti. */
export function setBaseCities(keys: string[]): void {
  const next = new Set<string>(BASE_CITIES);
  for (const key of keys) {
    const k = String(key ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
    if (k) next.add(k);
  }
  baseCities = [...next];
}

/**
 * Jin cities ke beech rides allowed nahi hain (dono direction band).
 *
 * Abhi khaali hai: pehle ke teeno blocked pairs (Gurgaon↔Mohali,
 * Gurgaon↔Chandigarh, Mohali↔Chandigarh) Chandigarh/Mohali hatne ke saath hi
 * khatam ho gaye, aur bachi hui do cities ke beech ride chalti hai. Mechanism
 * jaan-boojh kar rakha hai — naya pair band karna ho to bas yahan add karo.
 */
export const BLOCKED_CITY_PAIRS: readonly (readonly [string, string])[] = [];

/**
 * Area name se base city nikalta hai.
 * "Gurgaon Cyber Park" → "gurgaon", "Saharanpur Court Road" → "saharanpur".
 * Unknown value ho to trimmed lowercase string wapas milti hai.
 */
export function baseCityOf(location: string, cities: readonly string[] = baseCities): string {
  const value = (location || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!value) return '';

  // Naming convention "City + area" hai, isliye jo city naam string mein
  // SABSE PEHLE aata hai wahi base city hai — warna "Saharanpur Gurgaon Road"
  // check-order ki wajah se galti se gurgaon ban jaata. Ek hi position par do
  // match hon ("Noida" / "Noida Extension") to lamba naam jeetta hai.
  let match = '';
  let matchIndex = Infinity;

  for (const city of cities) {
    const index = value.indexOf(city);
    if (index === -1) continue;
    if (index < matchIndex || (index === matchIndex && city.length > match.length)) {
      matchIndex = index;
      match = city;
    }
  }

  return match || value;
}

/**
 * Do locations ke beech ride/travel allowed hai ya nahi.
 * Poore area names ("Saharanpur Court Road") aur sirf city names ("Saharanpur") dono chalte hain.
 * Koi ek khaali ho to blocked nahi maana jaata — user ne abhi choose hi nahi kiya.
 */
export function isCityPairBlocked(from: string, to: string): boolean {
  const a = baseCityOf(from);
  const b = baseCityOf(to);
  if (!a || !b) return false;

  return BLOCKED_CITY_PAIRS.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x)
  );
}
