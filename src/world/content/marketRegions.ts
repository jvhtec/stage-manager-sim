/**
 * Market regions and regional actor pools. A real market had more firms than a map can hold, so
 * the historically central firms always appear and each region draws a few of its own from a pool
 * (deterministically, per map seed — and the draw is saved, so later content fixes never add or
 * remove rivals from an old game).
 *
 * Regions are content-derived from the town name, so they need no save migration.
 */
import type { CountryCode } from './countries';

const ES_REGIONS: Record<string, string> = {
  Madrid: 'central',
  Barcelona: 'catalonia',
  Valencia: 'valencia',
  Alicante: 'valencia',
  Sevilla: 'andalucia',
  Málaga: 'andalucia',
  Granada: 'andalucia',
  Córdoba: 'andalucia',
  Bilbao: 'basque',
  Pamplona: 'navarra',
  Zaragoza: 'aragon',
  Murcia: 'murcia',
  Palma: 'balearic',
  Vigo: 'galicia',
  Valladolid: 'castilla-leon',
  Gijón: 'asturias',
  Oviedo: 'asturias',
  Santander: 'cantabria',
};

const REGIONS: Partial<Record<CountryCode, Record<string, string>>> = { ES: ES_REGIONS };

/** The market region a town belongs to (its own name where we haven't grouped the country). */
export const marketRegion = (country: CountryCode, cityName: string): string => REGIONS[country]?.[cityName] ?? cityName;

export interface ActorPool {
  country: CountryCode;
  region: string;
  actorIds: string[];
  /** How many of the pool a game draws. */
  min: number;
  max: number;
}

/** Optional regional actors. Anything in a country that isn't in a pool always appears. */
export const ACTOR_POOLS: ActorPool[] = [
  { country: 'ES', region: 'central', actorIds: ['espiral', 'tri', 'cinelux'], min: 1, max: 2 },
  { country: 'ES', region: 'catalonia', actorIds: ['sono', 'dushowes'], min: 1, max: 2 },
  { country: 'ES', region: 'andalucia', actorIds: ['apogee', 'sonorock', 'tcm', 'ojeda', 'tole'], min: 2, max: 3 },
  { country: 'ES', region: 'galicia', actorIds: ['emsac', 'megafer'], min: 1, max: 2 },
  { country: 'ES', region: 'castilla-leon', actorIds: ['use', 'swing', 'realaudio'], min: 1, max: 2 },
  { country: 'ES', region: 'basque', actorIds: ['soinua', 'ingunza'], min: 1, max: 2 },
  { country: 'ES', region: 'balearic', actorIds: ['efectes', 'balearacustic'], min: 1, max: 2 },
];

export const poolOf = (country: CountryCode, actorId: string) => ACTOR_POOLS.find(p => p.country === country && p.actorIds.includes(actorId));
