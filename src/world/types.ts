/**
 * Types for the Transport-Tycoon-style world simulation.
 *
 * Split in two halves:
 * - The *map* (terrain, roads, cities, venues) is derived deterministically
 *   from `TycoonState.mapSeed` by `generateWorld()` and never saved — the
 *   same seed always rebuilds the same map, which keeps saves tiny.
 * - The *state* (everything that changes as the clock runs) is plain JSON
 *   and is what gets persisted.
 */
import type { Department } from '@/types/game';
import type { CountryCode } from './content/countries';

/** Gear slots: the classic departments plus mixing consoles (FOH / monitors). */
export type Dept = Department | 'console';
export const DEPTS: Dept[] = ['audio', 'console', 'lighting', 'video', 'stage'];
export type DeptCounts = Record<Dept, number>;
/** Gear units held, keyed by product id (see content/gear.ts). */
export type GearStock = Record<string, number>;

// ---------------------------------------------------------------------------
// Map (derived from seed)
// ---------------------------------------------------------------------------

export enum Terrain {
  Water = 0,
  Grass = 1,
  Forest = 2,
  Rough = 3,
  Sand = 4,
}

export type CitySize = 'village' | 'town' | 'city' | 'metropolis';
export type VenueKind = 'pub' | 'hall' | 'club' | 'theatre' | 'arena' | 'stadium' | 'airport';

export interface Venue {
  id: string;
  cityId: string;
  name: string;
  kind: VenueKind;
  /** 1-4 — matches the reputation tier needed to book shows here. */
  tier: number;
  capacity: number;
  /** Top-left tile of the footprint. */
  x: number;
  y: number;
  /** Footprint in tiles (arenas and stadiums take more than one). */
  w: number;
  h: number;
}

export interface Building {
  x: number;
  y: number;
  /** Height in "floors" — purely cosmetic. */
  floors: number;
  color: number;
}

export interface City {
  id: string;
  name: string;
  /** Center tile — always a road tile; vehicles route to/from here. */
  x: number;
  y: number;
  population: number;
  size: CitySize;
  radius: number;
  venues: Venue[];
  buildings: Building[];
  /** 2x2 warehouse lots (top-left tiles). You and rivals each take one. */
  lots: { x: number; y: number }[];
}

export interface WorldMap {
  seed: number;
  width: number;
  height: number;
  terrain: Uint8Array;
  road: Uint8Array;
  /** Integer height per tile *corner*, (width+1) x (height+1). Adjacent corners differ by at most 1. */
  heights: Uint8Array;
  cities: City[];
  cityById: Map<string, City>;
  venueById: Map<string, Venue>;
  /** Cache of road paths (tile indices) between city centers. */
  pathCache: Map<string, number[]>;
}

// ---------------------------------------------------------------------------
// Simulation state (saved)
// ---------------------------------------------------------------------------

export type LedgerCategory =
  | 'shows'
  | 'penalties'
  | 'running'
  | 'servicing'
  | 'wages'
  | 'property'
  | 'purchases'
  | 'interest'
  | 'freight'
  | 'support'
  | 'sales';

export const LEDGER_LABELS: Record<LedgerCategory, string> = {
  shows: 'Show income',
  penalties: 'Penalties',
  running: 'Vehicle running costs',
  servicing: 'Vehicle servicing',
  wages: 'Crew wages',
  property: 'Depots & property',
  purchases: 'New vehicles & gear',
  interest: 'Loan interest',
  freight: 'Air freight & flights',
  support: 'Government support',
  sales: 'Asset sales',
};

export interface Depot {
  id: string;
  cityId: string;
  /** Index into the city's warehouse lots. */
  lot: number;
  gear: GearStock;
  crew: number;
  builtHour: number;
}

export type VehicleStatus =
  | 'parked'
  | 'scheduled'
  | 'driving'
  | 'on-site'
  | 'broken'
  | 'servicing';

export interface VehicleRoute {
  from: string;
  to: string;
  /** Tiles travelled along the cached path. */
  progress: number;
}

export interface Vehicle {
  id: string;
  /** 'player' or a rival id. */
  owner: string;
  modelId: string;
  name: string;
  homeCityId: string;
  boughtHour: number;
  reliability: number;
  lastServiceHour: number;
  status: VehicleStatus;
  /** City the vehicle is sitting in (undefined while on the road). */
  cityId?: string;
  route?: VehicleRoute;
  brokenUntil?: number;
  busyUntil?: number;
  /** Booked gig ids in the order they'll be played — a tour is just a long order list. */
  orders: string[];
  cargo: GearStock;
  crew: number;
  arrivedHour?: number;
  profitThisYear: number;
  profitLastYear: number;
}

export type GigStatus = 'offer' | 'booked' | 'done' | 'failed' | 'expired' | 'rival';

export interface GigResult {
  quality: number;
  payout: number;
  lateHours: number;
  gearCoverage: number;
  crewCoverage: number;
  /** How well the delivered kit met this show's expectations (0.6-1.08). */
  gearQuality?: number;
  riderMet?: boolean;
  /** Star techs who worked the show. */
  techs?: string[];
}

export interface OverseasStop {
  city: string;
  country: string;
  venue: string;
  day: number;
}

/** A run of dates abroad, played from one shipment of gear flown out of the airport. */
export interface OverseasLeg {
  regionId: string;
  stops: OverseasStop[];
}

export type TourStatus = 'offer' | 'booked' | 'done' | 'failed' | 'expired' | 'rival';

export interface Tour {
  id: string;
  act: string;
  name: string;
  kind: 'national' | 'world';
  gigIds: string[];
  /** Paid on top of the show fees if every date is played. */
  bonus: number;
  acceptByDay: number;
  status: TourStatus;
  rivalId?: string;
}

/** An artist's rider asking for a particular brand in one department. */
export interface Rider {
  dept: Dept;
  brand: string;
}

export interface Gig {
  id: string;
  act: string;
  venueId: string;
  cityId: string;
  tier: number;
  /** Day index (since game start) the show is played. */
  day: number;
  acceptByDay: number;
  needs: DeptCounts;
  crewNeeded: number;
  fee: number;
  rider?: Rider;
  /** The act has worked with you before and asked for you by name. */
  asksForYou?: boolean;
  tourId?: string;
  /** Set for world-tour legs abroad; the gig's venue/city is then the airport. */
  overseas?: OverseasLeg;
  status: GigStatus;
  rivalId?: string;
  result?: GigResult;
}

export interface Rival {
  id: string;
  name: string;
  color: string;
  specialty: Dept;
  minTier: number;
  maxTier: number;
  hqCityId: string;
  /** Index into the HQ city's warehouse lots. */
  lot: number;
  reputation: number;
  showsPlayed: number;
}

export type NewsTone = 'info' | 'good' | 'bad' | 'big';

export interface NewsItem {
  id: string;
  hour: number;
  text: string;
  tone: NewsTone;
  cityId?: string;
  vehicleId?: string;
  gigId?: string;
}

/** A star tech on the payroll (see content/techs.ts). */
export interface HiredTech {
  techId: string;
  /** Truck they ride with — they only help at shows that truck is at. */
  vehicleId?: string;
}

export interface Company {
  name: string;
  color: string;
  reputation: number;
  cash: number;
  loan: number;
  hqCityId: string;
}

export interface TycoonState {
  mapSeed: number;
  /** Home country (content/countries.ts): town names, local rivals and acts, currency. */
  country: CountryCode;
  rngState: number;
  /** Hours since 00:00 on day 0. */
  hour: number;
  startYear: number;
  company: Company;
  depots: Depot[];
  vehicles: Vehicle[];
  gigs: Gig[];
  /** The player's standing with each city's local scene, 0-100 (cf. TT town ratings). */
  cityRatings: Record<string, number>;
  rivals: Rival[];
  tours: Tour[];
  techs: HiredTech[];
  news: NewsItem[];
  /** Year → category → signed amount (income positive, costs negative). */
  ledger: Record<number, Partial<Record<LedgerCategory, number>>>;
  /** Vehicle model ids already announced as available. */
  announcedModels: string[];
  /** Gear product ids already announced as available. */
  announcedGear: string[];
  /** Economy periods (content/economy.ts) already announced. */
  announcedClimate: string[];
  /** Artist name → number of good shows you've done for them. */
  artistRelations: Record<string, number>;
  negativeMonths: number;
  nextId: number;
  stats: { showsPlayed: number; showsFailed: number; peakCash: number };
  gameOver?: { hour: number; reason: string };
}

export interface ActionResult {
  ok: boolean;
  message?: string;
}

export interface ActionOutcome {
  state: TycoonState;
  result: ActionResult;
}
