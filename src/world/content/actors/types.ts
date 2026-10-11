/**
 * Historical actors: the real rental and production houses, as content. Each record says who could
 * plausibly exist, where, in what business and under which names and owners — never how the
 * simulation turns out. Sources and confidence for every record live in docs/rival-history.md and
 * docs/research/; only the confidence grade travels with the code.
 *
 * Runtime state (state.rivals) keeps only the actor's id and its mutable operation, so a corrected
 * date here never needs a save migration.
 */
import type { CountryCode } from '../countries';

/** A — primary/near-primary; B — specialist trade source; C — career record or directory; D — folklore. */
export type Confidence = 'A' | 'B' | 'C' | 'D';

export type BusinessLine =
  | 'audio'
  | 'lighting'
  | 'video'
  | 'staging'
  | 'rigging'
  | 'backline'
  | 'corporate-av'
  | 'installation'
  | 'distribution';

/** How far the firm's network reaches in an era (not the same as where it has a warehouse). */
export type Reach = 'local' | 'regional' | 'national' | 'international';

/**
 * A dated item may be a documented fact or an explicit modelling choice used to turn a fuzzy
 * historical range into a playable year. Modelled dates must say why, so approximation never gets
 * mistaken for archival fact in content or UI.
 */
export interface HistoricalBasis {
  basis?: 'documented' | 'modelled';
  note?: string;
}

/** What the firm did in a span of years. */
export interface OperatingEra extends HistoricalBasis {
  from: number;
  lines: BusinessLine[];
  /** Venue tiers it chases. */
  tiers: [number, number];
  reach?: Reach;
}

/** A base in a country: a warehouse, local staff and the right to bid for ordinary local work. */
export interface LocalPresence extends HistoricalBasis {
  country: CountryCode;
  from: number;
  to?: number;
  /** Map town it works from (the nearest one on the map when its real town isn't there). */
  city?: string;
  /** News when it opens here, instead of the generic line. */
  news?: string;
}

export interface NameEra extends HistoricalBasis {
  from: number;
  name: string;
  /** News for the change of name (none for the first name). */
  news?: string;
}

/**
 * Things that happen to a company. They are different events with different consequences:
 * - `ownership`: a new owner. Same company, same base, same kit, same clients.
 * - `absorbed`: it is folded into another actor, which takes over its kit, crew, trucks, booked
 *   work, money owed and its patch.
 * - `pivot`: it leaves rental competition for another business (distribution, manufacturing).
 * - `closure`: it stops trading.
 */
export type CompanyEvent = (
  | { kind: 'ownership'; year: number; owner: string; news: string }
  | { kind: 'absorbed'; year: number; into: string; news: string }
  | { kind: 'pivot'; year: number; to: 'distribution' | 'manufacturing' | 'installation'; news: string }
  | { kind: 'closure'; year: number; how: 'voluntary' | 'insolvency' | 'unknown'; news: string }
) & HistoricalBasis;

export interface HistoricalActor {
  id: string;
  color: string;
  /** Where the company comes from (it may have bases elsewhere). */
  home: CountryCode | 'CA' | 'BE';
  founded: { year: number; confidence: Confidence; note?: string };
  presence: LocalPresence[];
  names: NameEra[];
  eras: OperatingEra[];
  /** Standing when it first appears on the map. */
  reputation: number;
  events?: CompanyEvent[];
}
