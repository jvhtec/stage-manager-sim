/**
 * Every room has its quirks. Deterministic from the venue's name, kind and country, so they never
 * need saving:
 *  - load-in: a dock, the street, or stairs (old theatres) — stairs need an extra pair of hands;
 *  - a curfew: run late into it and the venue fines you and the show is cut short;
 *  - a noise limit (strict in Germany, Switzerland and Austria): an oversized PA gets limited;
 *  - a union house (IATSE in American theatres and arenas, some British theatres): you pay their call.
 */
import type { Venue, WorldMap } from './types';

export interface VenueTraits {
  loadIn: 'dock' | 'street' | 'stairs';
  /** Hard stop, as an hour of the day. */
  curfew?: number;
  /** dB(A) at the desk. */
  noiseDb?: number;
  union?: boolean;
}

/** Per crew member the show needs, a union house call. */
export const UNION_CALL = 180;
/** Per tier, the fine for running into a curfew. */
export const CURFEW_FINE = 900;
export const CURFEW_QUALITY = 0.05;
export const NOISE_QUALITY = 0.04;
/** Audio beyond this multiple of what the show needs trips a noise limiter. */
export const NOISE_HEADROOM = 1.4;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

const STRICT_NOISE = new Set(['DE', 'CH', 'AT']);

export function venueTraits(venue: Pick<Venue, 'name' | 'kind'>, country: string): VenueTraits {
  const r = (salt: string) => hash(`${venue.name}|${salt}`);
  const big = venue.kind === 'arena' || venue.kind === 'stadium';
  const loadIn: VenueTraits['loadIn'] = big ? 'dock' : venue.kind === 'theatre' ? (r('load') < 0.4 ? 'stairs' : r('load') < 0.8 ? 'street' : 'dock') : venue.kind === 'pub' ? 'street' : r('load') < 0.25 ? 'stairs' : 'street';
  const t: VenueTraits = { loadIn };
  const curfewChance = country === 'GB' ? (big ? 0.8 : 0.45) : country === 'US' ? 0.35 : 0.25;
  if (venue.kind !== 'pub' && r('curfew') < curfewChance) t.curfew = big && venue.kind === 'stadium' ? 22 : 23;
  if (STRICT_NOISE.has(country) ? r('noise') < (big ? 0.7 : 0.4) : r('noise') < (big ? 0.15 : 0.1)) t.noiseDb = STRICT_NOISE.has(country) ? 99 : 102;
  if (country === 'US' && (venue.kind === 'theatre' || big) && r('union') < 0.8) t.union = true;
  if (country === 'GB' && venue.kind === 'theatre' && r('union') < 0.4) t.union = true;
  return t;
}

/** The traits of a venue on this map (a town abroad uses its own country's habits). */
export function traitsOf(world: Pick<WorldMap, 'country' | 'cityById'>, venue: Venue): VenueTraits {
  const city = world.cityById.get(venue.cityId);
  return venueTraits(venue, city?.abroad?.country ?? world.country);
}

/** One line per quirk, for windows. */
export function describeTraits(t: VenueTraits): string[] {
  const out: string[] = [];
  if (t.loadIn === 'stairs') out.push('Load-in up stairs: needs an extra hand');
  else if (t.loadIn === 'street') out.push('Load-in from the street');
  else out.push('Loading dock');
  if (t.curfew !== undefined) out.push(`Curfew ${t.curfew}:00 — run late and it's a fine and a cut show`);
  if (t.noiseDb !== undefined) out.push(`Noise limit ${t.noiseDb} dB — an oversized PA gets limited`);
  if (t.union) out.push(`Union house crew: ${UNION_CALL} a head per show`);
  return out;
}
