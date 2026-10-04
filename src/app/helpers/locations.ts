/**
 * Pickup/drop locations ka shape + fallback list.
 *
 * Asli list API (`GET /locations`) se aati hai aur admin panel se manage hoti
 * hai. Ye default sirf tab kaam aata hai jab API na mile (offline / server
 * down) — wahi data jo API pehli baar seed karti hai, taaki user ko fark na dikhe.
 */

export interface LocationCity {
  /** Base city key = lowercase naam ('gurgaon', 'new delhi') — baseCityOf() yahi lautata hai. */
  key: string;
  /** Display naam — "Saharanpur". */
  name: string;
  /** Visible areas; pehla item hamesha city ka naam khud hota hai. */
  areas: string[];
}

export const DEFAULT_LOCATION_CITIES: LocationCity[] = [
  {
    key: 'gurgaon',
    name: 'Gurgaon',
    areas: [
      'Gurgaon',
      'Gurgaon Ambience Mall',
      'Gurgaon Cyber Park',
      'Gurgaon Rajiv Chowk',
      'Gurgaon Iffco Chowk',
      'Gurgaon Huda City Center Secor 29',
      'Gurgaon Sector 32 ,Jharsa Institutional Area',
      'Gurgaon Sector 48,Candor Tech Space',
      'Gurgaon Sector 21, Krishna Chowk',
      'Gurgaon Hero Honda Chowk',
      'Gurgaon Subhash Chowk',
      'Gurgaon Vatika Chowk',
      'Gurgaon Candor Sector 21',
      'Gurgaon Arjan Garh Metro Station',
    ],
  },
  {
    key: 'saharanpur',
    name: 'Saharanpur',
    areas: [
      'Saharanpur',
      'Saharanpur Clock Tower',
      'Saharanpur Dehradun Chowk',
      'Saharanpur Anupam Sweets',
      'Saharanpur Court Road',
      'Saharanpur Vishwakarma Chowk',
      'Saharanpur Hasanpur Chungi',
      'Saharanpur J V Jain College',
      'Saharanpur Sharda Nagar',
      'Saharanpur Hakikat Nagar',
      'Saharanpur Madhav Nagar',
    ],
  },
];

/** Saari cities ke areas ek flat list me (cities ke order me). */
export function flattenAreas(cities: LocationCity[]): string[] {
  return cities.flatMap((city) => city.areas);
}

/** Sirf master city ke display naam — ["Gurgaon", "Saharanpur"]. */
export function cityNames(cities: LocationCity[]): string[] {
  return cities.map((city) => city.name);
}

/** `city` ke alawa pehli city — source/destination same na rahein. */
export function otherCity(cities: string[], city: string): string {
  return cities.find((c) => c !== city) ?? '';
}
