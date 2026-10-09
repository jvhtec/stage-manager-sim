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
  | 'workshop'
  | 'contracts'
  | 'insurance'
  | 'salaries'
  | 'freelance'
  | 'travel'
  | 'fuel'
  | 'subhire'
  | 'rental'
  | 'leasing'
  | 'rnd'
  | 'royalties'
  | 'deals'
  | 'training'
  | 'onsite'
  | 'sponsorship'
  | 'paperwork'
  | 'bonuses'
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
  workshop: 'Gear maintenance',
  contracts: 'House contracts',
  insurance: 'Insurance',
  salaries: 'Full-time staff',
  freelance: 'Freelance crew',
  travel: 'Per diems & hotels',
  fuel: 'Fuel',
  subhire: 'Sub-hired kit',
  rental: 'Kit rented out',
  leasing: 'Vehicle leases',
  rnd: 'R&D',
  royalties: 'Design royalties',
  deals: 'Production deals',
  training: 'Crew training',
  onsite: 'On-the-day extras',
  sponsorship: 'Maker sponsorship',
  paperwork: 'Visas & carnets',
  bonuses: 'Run bonuses',
  sales: 'Asset sales',
};

/** Departments crew specialise in (consoles are sound work). */
export type CrewDept = 'audio' | 'lighting' | 'video' | 'stage';
export type CrewTrait = 'chief' | 'roadwarrior' | 'perfectionist' | 'polyglot' | 'party' | 'mentor';

/** A gig technician (people.ts). */
export interface CrewMember {
  id: string;
  name: string;
  primary: CrewDept;
  /** 0-5 per department. */
  skills: Record<CrewDept, number>;
  /** Shows worked per department towards the next level. */
  xp: Record<CrewDept, number>;
  trait?: CrewTrait;
  fatigue: number;
  hiredHour: number;
  /** At a base… */
  depotId?: string;
  /** …or aboard a truck. */
  vehicleId?: string;
  /** Always rides this truck when it loads at their base. */
  pinnedVehicleId?: string;
  /** Pay on top of the going rate for their level (a matched counter-offer). */
  payBump?: number;
  /** Won't listen to rivals' offers until this hour. */
  loyalUntil?: number;
}

/** A rival trying to hire one of your people away: match it or lose them. */
export interface PoachBid {
  id: string;
  personId: string;
  rivalName: string;
  /** Pay rise they're offered, e.g. 0.3 = +30%. */
  raise: number;
  expiresDay: number;
}

export type FacilityKind = 'delegation' | 'warehouse';
/** Full-time staff roles at a base (gig technicians are `crew`). */
export type StaffRole = 'warehouse' | 'office';

/** A base: a delegation (branch office) or a warehouse (facilities.ts). */
export interface Depot {
  id: string;
  kind: FacilityKind;
  /** Warehouse size 1-3 (small / medium / large); delegations are 1. */
  size: number;
  /** Full-time staff on salary — they never go on the road. */
  staff: Record<StaffRole, number>;
  cityId: string;
  /** Index into the city's warehouse lots. */
  lot: number;
  gear: GearStock;
  /** Gig technicians on the payroll, based here between jobs. */
  crew: number;
  /** Average fatigue (0-100) of the crew resting here. */
  fatigue?: number;
  /** Average experience (0-100) of the crew based here. */
  experience?: number;
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
  /** Average fatigue (0-100) of the crew aboard. */
  crewFatigue?: number;
  /** Average experience (0-100) of the crew aboard. */
  crewExperience?: number;
  arrivedHour?: number;
  profitThisYear: number;
  profitLastYear: number;
  /** Leased rather than owned (finance.ts). */
  lease?: { monthly: number; sinceHour: number };
}

export type BidLevel = 'sharp' | 'standard' | 'premium';
export type RndAmbition = 'refine' | 'flagship' | 'breakthrough';

/** An R&D project (rnd.ts). */
export interface RndProject {
  id: string;
  dept: Dept;
  ambition: RndAmbition;
  budget: number;
  monthsDone: number;
  startedDay: number;
  status: 'running' | 'done' | 'failed';
  series: string;
  productId?: string;
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
  /** Shows that run over several days (festival stages). Default 1. */
  days?: number;
  /** A festival stage contract (content/festivals.ts). `act` is the festival's name. */
  festival?: { id: string; year: number; stage: string; main: boolean };
  /** A special event's department lot (events.ts), or a show spawned by a citywide event. */
  event?: { id: string; year: number; name: string; lot: Dept; broadcast: boolean; scale: number; citywide?: boolean };
  /** Your sealed bid on an event lot. */
  bid?: BidLevel;
  /** You've already haggled over the fee (negotiate.ts). */
  negotiated?: boolean;
  /** People you've named for this show (people.ts); they board first and are held back from other jobs. */
  crewPicks?: string[];
  status: GigStatus;
  rivalId?: string;
  result?: GigResult;
  /** What your on-the-day decisions did to the show (dilemmas.ts). */
  mods?: ShowMods;
}

export interface ShowMods {
  quality?: number;
  failureFactor?: number;
  /** Multiplier on the chance of storms at an outdoor show. */
  stormFactor?: number;
}

/** One lot at an auction (auctions.ts): used kit or a used truck. */
export interface AuctionLot {
  id: string;
  kind: 'gear' | 'vehicle';
  productId?: string;
  qty?: number;
  /** Gear condition 0-100. */
  condition?: number;
  modelId?: string;
  ageYears?: number;
  reliability?: number;
  /** Market value; the asking price is a sliding share of it. */
  value: number;
}

export interface Auction {
  id: string;
  seller: string;
  cityId: string;
  startDay: number;
  endDay: number;
  lots: AuctionLot[];
}

/** A string of shows booked together on one truck (runs.ts). */
export interface Run {
  id: string;
  vehicleId: string;
  gigIds: string[];
  bonusRate: number;
  status: 'active' | 'paid' | 'broken';
  bonus?: number;
}

export type DilemmaKind = 'raise' | 'burnout' | 'customs' | 'breakdown' | 'power' | 'union' | 'manager' | 'curfew' | 'injury' | 'storm';

/** A problem that needs your call (dilemmas.ts). */
export interface Dilemma {
  id: string;
  kind: DilemmaKind;
  title: string;
  text: string;
  options: { id: string; label: string; detail: string; cost?: number }[];
  /** What happens if you don't answer by `expiresHour`. */
  defaultOption: string;
  gigId?: string;
  vehicleId?: string;
  personId?: string;
  createdHour: number;
  expiresHour: number;
}

export type ContractStatus = 'offer' | 'active' | 'ended' | 'expired' | 'rival';

/** A venue's year-long house PA & lighting contract (contracts.ts). */
export interface VenueContract {
  id: string;
  venueId: string;
  cityId: string;
  tier: number;
  /** The house rig the venue wants installed. */
  kit: DeptCounts;
  /** What you actually installed (locked in the venue until the contract ends). */
  installed: GearStock;
  monthly: number;
  acceptByDay: number;
  startDay: number;
  endDay: number;
  status: ContractStatus;
  rivalId?: string;
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
  /** Financial health 0-100 (rivals.ts); at 0 they go under. */
  health?: number;
  /** showsPlayed at the last monthly check. */
  lastShows?: number;
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

export type WorkshopLevel = 'none' | 'basic' | 'full';
export type PayLevel = 'low' | 'standard' | 'high';
export type InsuranceLevel = 'none' | 'basic' | 'full';
export type TrainingLevel = 'none' | 'courses' | 'academy';

/** Standing company policies — the levers you set once and live with. */
export interface Policies {
  workshop: WorkshopLevel;
  pay: PayLevel;
  insurance: InsuranceLevel;
  /** Fill crew gaps with local freelancers at the venue. */
  freelance: 'off' | 'fill';
  /** Fill kit gaps by sub-hiring from rivals nearby. */
  subhire: 'off' | 'fill';
  /** Rent idle kit out between jobs. */
  rentOut: 'off' | 'on';
  training: TrainingLevel;
  /** Rest rota: keep tired people at base instead of sending them out. */
  rest: RestRota;
}

export type RestRota = 'off' | 'tired' | 'strict';

/** One year's record, for the company rating and the awards (awards.ts). */
export interface YearStats {
  shows: number;
  failed: number;
  qualitySum: number;
  festivals: number;
  festivalQualitySum: number;
  tours: number;
  worldTours: number;
  events?: number;
  eventQualitySum?: number;
}

/** The year's books and standing (milestones.ts). */
export interface AnnualReport {
  year: number;
  revenue: number;
  costs: number;
  net: number;
  cash: number;
  value: number;
  shows: number;
  failed: number;
  avgQuality: number;
  rating: number;
  rank: number;
  firms: number;
  reputation: number;
  fleet: number;
  crew: number;
  best?: { act: string; quality: number };
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
  policies: Policies;
  /** Company-wide crew morale, 0-100 (crew.ts). */
  crewMorale: number;
  /** Product id → average condition (0-100) of the units you own; missing = 100. */
  gearCondition: Record<string, number>;
  contracts: VenueContract[];
  projects: RndProject[];
  /** Your gig technicians, by name (people.ts). */
  people: CrewMember[];
  /** This month's hiring market: candidates, each tagged with the base they'd join. */
  candidates: CrewMember[];
  /** Rivals' open offers to your people (people.ts). */
  poachBids: PoachBid[];
  /** Problems waiting on your decision (dilemmas.ts). */
  dilemmas: Dilemma[];
  /** Used kit and trucks under the hammer (auctions.ts). */
  auctions: Auction[];
  /** Career milestones reached (milestones.ts) and the yearly reports. */
  milestones: { id: string; day: number }[];
  /** Manufacturer partnership per department (partners.ts). */
  /** Town size multipliers over the game (towns.ts). */
  townGrowth: Record<string, number>;
  /** Planned road runs (runs.ts). */
  runs: Run[];
  /** Promoter relationship per venue, 0-8 (venues.ts). */
  venueRelations: Record<string, number>;
  partners: Partial<Record<Dept, { brand: string; sinceDay: number; lapse: number }>>;
  reports: AnnualReport[];
  /** Exclusive production deals with acts (deals.ts). */
  deals: { id: string; act: string; tier: number; monthly: number; startDay: number; endDay: number; strikes: number; status: 'offer' | 'active' | 'ended'; offerExpires: number }[];
  /** Your own products (encoded ids, see content/gear.ts ownProductId). */
  ownProducts: string[];
  /** Rivals that went bust or were bought out — they don't come back. */
  goneRivals: string[];
  /** Kit on its way between your bases by courier (transfers.ts). */
  transfers: { id: string; fromDepotId: string; toDepotId: string; stock: GearStock; arriveHour: number }[];
  yearStats: Record<number, YearStats>;
  awards: { year: number; title: string }[];
  /** Special-event tenders already opened, as "eventId-year". */
  eventsPosted: string[];
  /** Festival tenders already opened, as "festivalId-year". */
  festivalsPosted: string[];
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
