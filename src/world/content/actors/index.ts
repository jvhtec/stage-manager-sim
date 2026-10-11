/**
 * The historical actor registry and pure lookups by year. Nothing here touches game state.
 */
import type { CountryCode } from '../countries';
import type { Dept } from '../../types';
import { ES_ACTORS } from './es';
import { GB_ACTORS } from './gb';
import { US_ACTORS } from './us';
import { DE_ACTORS, FR_ACTORS, IT_ACTORS } from './europe';
import type { BusinessLine, CompanyEvent, HistoricalActor, LocalPresence, OperatingEra } from './types';

export type { BusinessLine, CompanyEvent, Confidence, HistoricalActor, LocalPresence, OperatingEra, Reach } from './types';

export const HISTORICAL_ACTORS: HistoricalActor[] = [...US_ACTORS, ...GB_ACTORS, ...ES_ACTORS, ...FR_ACTORS, ...DE_ACTORS, ...IT_ACTORS];

const BY_ID = new Map(HISTORICAL_ACTORS.map(a => [a.id, a]));
export const actorById = (id: string): HistoricalActor | undefined => BY_ID.get(id);

const latest = <T extends { from: number }>(xs: T[], year: number): T | undefined => xs.filter(x => x.from <= year).pop();

/** Its local base in this country this year, if it has one. */
export function presenceIn(a: HistoricalActor, country: CountryCode, year: number): LocalPresence | undefined {
  return a.presence.find(p => p.country === country && p.from <= year && (p.to === undefined || year < p.to));
}

/** Every actor that ever had a base in this country. */
export const actorsIn = (country: CountryCode) => HISTORICAL_ACTORS.filter(a => a.presence.some(p => p.country === country));

/** The year it first sets up in this country. */
export const firstPresence = (a: HistoricalActor, country: CountryCode) =>
  Math.min(...a.presence.filter(p => p.country === country).map(p => p.from));

export const nameIn = (a: HistoricalActor, year: number): string => (latest(a.names, year) ?? a.names[0]).name;
export const eraIn = (a: HistoricalActor, year: number): OperatingEra => latest(a.eras, year) ?? a.eras[0];

/** Who owns it this year (undefined while it's independent / owned by its founders). */
export function ownerIn(a: HistoricalActor, year: number): string | undefined {
  return (a.events ?? []).filter((e): e is Extract<CompanyEvent, { kind: 'ownership' }> => e.kind === 'ownership' && e.year <= year).pop()?.owner;
}

/** The year it leaves the rental market for good (absorbed, pivoted or closed), if it does. */
export const endYear = (a: HistoricalActor) => (a.events ?? []).filter(e => e.kind !== 'ownership').map(e => e.year).sort((x, y) => x - y)[0];

/** Which gear departments a business line runs. */
export const LINE_DEPTS: Record<BusinessLine, Dept[]> = {
  audio: ['audio', 'console'],
  lighting: ['lighting'],
  video: ['video'],
  staging: ['stage'],
  rigging: ['stage'],
  backline: [],
  'corporate-av': ['video', 'audio', 'console'],
  installation: [],
  distribution: [],
};

export const deptsOfLines = (lines: BusinessLine[]): Dept[] => [...new Set(lines.flatMap(l => LINE_DEPTS[l]))];

export const LINE_LABELS: Record<BusinessLine, string> = {
  audio: 'sound',
  lighting: 'lighting',
  video: 'video',
  staging: 'staging',
  rigging: 'rigging',
  backline: 'backline',
  'corporate-av': 'corporate AV',
  installation: 'installations',
  distribution: 'distribution',
};
