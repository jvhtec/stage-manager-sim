/**
 * The industry's annual shop windows. Each year, on its day, a show can be
 * walked or exhibited at — for a price and a burst of attention. Dates and
 * venues approximate; edit freely.
 */
import type { CountryCode } from './countries';

export interface TradeShow {
  id: string;
  name: string;
  /** Where it's held (affects the travel bill). */
  country: CountryCode;
  city: string;
  month: number;
  day: number;
  /** First and last year it runs under this name. */
  from: number;
  to?: number;
  blurb: string;
}

export const TRADE_SHOWS: TradeShow[] = [
  { id: 'plasa', name: 'PLASA Show', country: 'GB', city: 'London', month: 9, day: 8, from: 1975, blurb: 'The British trade show for sound, light and staging.' },
  { id: 'musikmesse', name: 'Musikmesse', country: 'DE', city: 'Frankfurt', month: 3, day: 24, from: 1980, to: 1998, blurb: 'Frankfurt’s music fair, where the pro-audio trade comes to look.' },
  { id: 'prolight', name: 'Prolight + Sound', country: 'DE', city: 'Frankfurt', month: 4, day: 6, from: 1999, blurb: 'Frankfurt’s pro-audio and lighting show, the continent’s biggest.' },
  { id: 'ldi', name: 'LDI', country: 'US', city: 'Las Vegas', month: 11, day: 14, from: 1984, blurb: 'Lighting Dimensions International: the American show for lights, staging and video.' },
];

export const showsIn = (year: number): TradeShow[] => TRADE_SHOWS.filter(s => year >= s.from && (s.to === undefined || year <= s.to));

/** Travel multiplier: at home 1, elsewhere in Europe 1.8, across the ocean 3. */
export function travelFactor(home: CountryCode, host: CountryCode): number {
  if (home === host) return 1;
  const europe = new Set<CountryCode>(['GB', 'ES', 'DE', 'FR', 'IT']);
  return europe.has(home) && europe.has(host) ? 1.8 : 3;
}
