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
import type { CountryCode } from './content/countries';

/** Gear slots: the classic departments plus mixing consoles (FOH / monitors). */
export type Department = 'audio' | 'lighting' | 'video' | 'stage';
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
  /** A town just over the border: shows only (no bases), and a border or a ferry on the way. */
  abroad?: { country: string; flag: string };
}

/** A stretch of road over water: a bridge, a ferry, or (once it opens) a tunnel. */
export interface Crossing {
  id: number;
  name?: string;
  /** Water tiles of the crossing. */
  tiles: number[];
  km: number;
  /** What it is when no fixed link has been built: short hops are bridges, the rest ferries. */
  base: 'bridge' | 'ferry';
  /** A fixed link that replaces the ferry in a given year. */
  link?: { kind: 'bridge' | 'tunnel'; opens: number; name: string };
  /** Index into WorldMap.borderCountries when it lands in another country. */
  border: number;
}

/** A real motorway: the road tiles between two towns that it upgrades from the year it opens. */
export interface Corridor {
  name: string;
  from: string;
  to: string;
  opens: number;
  toll: boolean;
  tiles: number[];
}

/** What the roads are like in a given year: which motorways and links are open, how long borders take. */
export interface Era {
  year: number;
  key: string;
  /** Hours lost at each neighbouring country's border (index as borderCountries), and the customs fee. */
  border: { hours: number; fee: number }[];
  /** Hours lost at each historic internal border (index as zones). */
  zone: number[];
  /** December to March: snow on the high roads. */
  winter: boolean;
  /** How fast a solo-driven truck averages under the day's drivers'-hours rules (team drivers are unaffected). */
  soloPace: number;
  /** Those rules, in a few words. */
  driversRules: string;
  /** Strikes, blockades and storms under way (titles). */
  disruptions: string[];
}

export interface WorldMap {
  seed: number;
  /** Home country code. */
  country: string;
  width: number;
  height: number;
  /** Ground distance of one tile — game distances and travel times follow real kilometres. */
  kmPerTile: number;
  terrain: Uint8Array;
  road: Uint8Array;
  /** 1 on land that belongs to a neighbouring country (drawn muted, no towns, roads avoid it). */
  foreign: Uint8Array;
  /** Integer height per tile *corner*, (width+1) x (height+1). Adjacent corners differ by at most 1. */
  heights: Uint8Array;
  cities: City[];
  /** Real towns just over the border (shows only). */
  abroad: City[];
  cityById: Map<string, City>;
  venueById: Map<string, Venue>;
  /** Cache of road paths (tile indices) between city centers. */
  pathCache: Map<string, number[]>;
  /** Cost of each cached path in game distance units (see pathfinding.KM_PER_UNIT). */
  distCache: Map<string, number>;
  /** Which neighbouring country each foreign land tile belongs to (index into borderCountries), -1 at home or sea. */
  landCountry: Int8Array;
  borderCountries: string[];
  /** Historic internal borders (index into zones) per tile, -1 outside. */
  zoneOf: Int8Array;
  zones: { name: string; until: number }[];
  crossings: Crossing[];
  /** Crossing id per water tile carrying a road, -1 elsewhere. */
  crossingAt: Int16Array;
  corridors: Corridor[];
  /** 1 on high road tiles that snow slows in winter (mountain passes). */
  snowy: Uint8Array;
  /** The year's road network (set on the world for a particular year, see infra.eraWorld). */
  era?: Era;
  /** 1 where an open motorway runs. */
  motorway?: Uint8Array;
  /** Per crossing tile: 1 bridge, 2 ferry, 3 tunnel. */
  crossKind?: Uint8Array;
  /** Per tile slow-down from a strike, blockade or storm under way (1 = normal). */
  slow?: Float32Array;
  /** Era worlds derived from this one, by era key. */
  eras?: Map<string, WorldMap>;
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
  | 'tolls'
  | 'busHire'
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
  | 'zones'
  | 'marketing'
  | 'equity'
  | 'festival'
  | 'venues'
  | 'facilities'
  | 'merch'
  | 'legal'
  | 'tax'
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
  tolls: 'Tolls, ferries & customs',
  busHire: 'Tour bus hire',
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
  zones: 'Low-emission zones',
  marketing: 'Marketing & trade shows',
  equity: 'Shares & dividends',
  festival: 'Own festival',
  venues: 'Owned venues',
  facilities: 'Annexes & stages',
  merch: 'Merchandise',
  legal: 'Legal fees',
  tax: 'Corporation tax',
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
  /** Tickets held (certs.ts). */
  certs?: CertId[];
  /** On a course until this day: unavailable for jobs. */
  course?: { cert: CertId; untilDay: number };
  /** Lasting burnout from long stretches of exhaustion, 0-100 (bonds.ts). */
  burnout?: number;
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
  /** Annexes and their level (annexes.ts). */
  modules?: Partial<Record<ModuleId, number>>;
  /** Day the rehearsal stage is free again. */
  stageBusyUntil?: number;
  /** The last council safety audit (audits.ts). */
  audit?: { year: number; score: number };
}

export type VehicleStatus =
  | 'parked'
  | 'scheduled'
  | 'driving'
  | 'on-site'
  | 'broken'
  | 'servicing'
  /** A tour bus out on hire to a touring act (buses.ts). */
  | 'hired-out';

export interface VehicleRoute {
  from: string;
  to: string;
  /** Distance units travelled along the route (see pathfinding.KM_PER_UNIT). */
  progress: number;
  /** The route's length in units when the vehicle set off (motorways or a new tunnel can shorten it mid-trip). */
  total?: number;
}

export interface Vehicle {
  id: string;
  /** 'player' or a rival id. */
  owner: string;
  /** Two drivers taking turns in a sleeper cab: quicker on long hauls, at a second driver's pay. */
  teamDrivers?: boolean;
  modelId: string;
  name: string;
  homeCityId: string;
  boughtHour: number;
  reliability: number;
  lastServiceHour: number;
  /** A service fell due and was put off because cash was short (consequences.ts). */
  serviceSkipped?: { hour: number; incidentId: string };
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
  /** How busy it's been lately, 0-1 (fleetReport.ts). */
  util?: number;
  /** Filters fitted to an older engine, each adding an emission class (regulation.ts). */
  retrofit?: number;
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
  /** Stock ordered for the road, and what it made (merch.ts). */
  merch?: { level: MerchLevel; invested: number; revenue?: number };
}

/** An artist's rider asking for a particular brand in one department. */
export interface Rider {
  dept: Dept;
  brand: string;
}

/** A booking's contract terms (terms.ts): shares of the fee. */
export interface GigTerms {
  deposit: number;
  cancel: number;
}

/** A technical rider's hard requirements (techRider.ts). */
export interface TechSpec {
  /** Inputs the FOH desk must take. */
  inputs: number;
  /** The engineer's show file runs on this console brand. */
  consoleFamily?: string;
  /** Only these PA brands are approved. */
  paBrands?: string[];
}

export interface Gig {
  id: string;
  act: string;
  /** Booked by a Spanish town council in fiesta season: pays late (rules.ts). */
  council?: boolean;
  /** Germany: a Meister für Veranstaltungstechnik (extra certified rigger) must be on the crew. */
  meister?: boolean;
  /** Britain after 1998: relief crew under the working-time rules (already in crewNeeded). */
  relief?: boolean;
  /** Kit sent by rail or air freight instead of (or as well as) a truck (freight.ts). */
  freight?: { mode: 'rail' | 'air'; fromDepotId: string; gear: GearStock; arrives: number; cost: number; hours: number; returned?: boolean };
  /** Conditions noted on the way to the night that will explain how it went (consequences.ts). */
  trouble?: Cause[];
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
  /** Hard technical requirements (techRider.ts). */
  techSpec?: TechSpec;
  /** Deposit and cancellation clause (terms.ts). */
  terms?: GigTerms;
  /** You've already pushed for better terms. */
  termsAsked?: boolean;
  /** Deposit received. */
  depositPaid?: number;
  /** The client pulled the show. */
  cancelled?: boolean;
  /** What the production manager has spent advancing this show. */
  pmSpent?: number;
  /** Production fixes booked for the room (production.ts). */
  fixes?: { generator?: boolean; groundSupport?: boolean; shuttle?: boolean; loaders?: boolean };
  /** Kit cross-hired from a rental house straight to the venue: product id → units. */
  crossHire?: GearStock;
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
  /** On a share of the gate instead of a flat fee (gate.ts): the true ticket-sales hype and your forecast of it. */
  gate?: { hype: number; forecast: number };
  /** People you've named for this show (people.ts); they board first and are held back from other jobs. */
  crewPicks?: string[];
  status: GigStatus;
  rivalId?: string;
  result?: GigResult;
  /** What your on-the-day decisions did to the show (dilemmas.ts). */
  mods?: ShowMods;
  /** Level of the stage it rehearsed on (annexes.ts). */
  rehearsed?: number;
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

/** A brand sponsoring your trucks (sponsors.ts). */
export interface SponsorDeal {
  id: string;
  brandId: string;
  monthly: number;
  /** Shows a month you've promised. */
  minShows: number;
  status: 'offer' | 'active';
  startDay: number;
  endDay: number;
  shortfalls: number;
  paid: number;
}

export type ModuleId = 'rehearsal' | 'workshop' | 'lounge' | 'academy';

export type CertId = 'rigging' | 'safety';

export type InvoicingPolicy = 'hold' | 'factor' | 'insure';

/** Money a promoter owes you (receivables.ts). */
export interface Invoice {
  id: string;
  /** The promoter has already paid late once (consequences.ts). */
  slipped?: boolean;
  gigId: string;
  act: string;
  amount: number;
  dueDay: number;
  tier: number;
  insured: boolean;
}

export type MerchLevel = 'small' | 'medium' | 'large';

export type VenueProgramme = 'lease' | 'promote';

/** A room you own (owned.ts). */
export interface OwnedVenue {
  venueId: string;
  cityId: string;
  price: number;
  /** 0-100, falls with age. */
  condition: number;
  programme: VenueProgramme;
  boughtHour: number;
  /** Net since you bought it. */
  earned: number;
}

export type FestTier = 'field' | 'weekender' | 'major';
export type FestHeadliner = 'local' | 'name' | 'star';
export type FestTicket = 'low' | 'fair' | 'premium';

/** The festival you promote yourself (ownfest.ts). */
export interface OwnFestival {
  year: number;
  tier: FestTier;
  headliner: FestHeadliner;
  ticket: FestTicket;
  cityId: string;
  day: number;
  /** Spent up front. */
  paid: number;
  covered: boolean;
  status: 'planned' | 'done';
  result?: { attendance: number; revenue: number; profit: number; stormed: boolean };
}

export interface FestivalEdition {
  year: number;
  tier: FestTier;
  attendance: number;
  profit: number;
  brand: number;
}

export type DividendLevel = 'none' | 'modest' | 'generous';

/** The company's stock-market listing (shares.ts). */
export interface Listing {
  day: number;
  /** Share of the company in public hands. */
  float: number;
  /** 0-100: how the market feels about you. */
  confidence: number;
  dividend: DividendLevel;
  /** Trading-ledger total at the last month end (to work out each month's profit). */
  mark: number;
  /** Months with confidence near zero. */
  weakMonths: number;
  /** Cash raised at the float, and paid out in dividends since. */
  raised: number;
  paid: number;
}

/** A rival undercutting a town's fees (pricewars.ts). */
export interface PriceWar {
  id: string;
  cityId: string;
  rivalId: string;
  startDay: number;
  endDay: number;
  /** Share fees fall by. */
  undercut: number;
  /** You've stood up to them. */
  fight: boolean;
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

export type DilemmaKind = 'change' | 'audit' | 'dispute' | 'dirty' | 'sponsor' | 'charity' | 'venue' | 'ownfest' | 'shareholders' | 'pricewar' | 'tradeshow' | 'raise' | 'burnout' | 'customs' | 'breakdown' | 'power' | 'union' | 'manager' | 'curfew' | 'injury' | 'storm';

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
  /** Extra reference for the kind (a trade show's id). */
  payload?: string;
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

/** A rival's operation (rivalOps.ts): what it owns, what it's doing, and its books. */
export interface RivalOps {
  cash: number;
  /** Units per department. */
  kit: DeptCounts;
  /** Rated quality of its kit. */
  quality: number;
  /** Console family of its desks, and the most inputs any of them takes. */
  desk?: string;
  inputs: number;
  /** PA brands it owns. */
  pa: string[];
  crew: number;
  trucks: number;
  /** Kit condition, 0-100. */
  condition: number;
  month: { income: number; costs: number };
  record: { shows: number; failed: number; late?: number; kitFailures?: number; crossHires: number; fixes: number; cancelled: number; declined: Partial<Record<'kit' | 'crew' | 'trucks' | 'rider' | 'room', number>> };
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
  /** Its operation: kit, crew, trucks, books (rivalOps.ts). */
  ops?: RivalOps;
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
  marketing: MarketingLevel;
  /** Book the rehearsals a show needs for you as the dates come close. */
  rehearsal: 'manual' | 'auto';
  /** What to do with promoters' invoices (receivables.ts). */
  invoicing: InvoicingPolicy;
}

export type Difficulty = 'easy' | 'normal' | 'hard';
export type GoalId = 'sandbox' | 'top' | 'empire' | 'worlds' | 'awards' | 'consolidator' | 'survivor' | 'scenario';

export type MarketingLevel = 'none' | 'local' | 'trade' | 'national';

/** Show-driven buzz and deals still running (marketing.ts). */
export interface Promo {
  offerMult: number;
  offerUntil: number;
  gearDiscount: number;
  gearUntil: number;
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
/** The trade press's year-end charts and reviews (charts.ts). */
/** One reason something went wrong, with how much it contributed (0-1). */
export interface Cause {
  id: string;
  label: string;
  detail: string;
  weight: number;
  /** The earlier incident that set this up. */
  link?: string;
}

/** A recorded problem and the chain of conditions that produced it (consequences.ts). */
export interface Incident {
  id: string;
  hour: number;
  kind: 'cash' | 'breakdown' | 'show' | 'client';
  title: string;
  gigId?: string;
  vehicleId?: string;
  causes: Cause[];
  outcome: string;
}

export interface YearChart {
  year: number;
  rank: number;
  firms: number;
  table: { name: string; score: number; you?: boolean }[];
  tours: { act: string; tier: number; yours?: boolean }[];
  rave?: { act: string; quality: number; text: string };
  pan?: { act: string; quality: number; text: string };
}

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
  /** Technology waves already rumoured/arrived (content/techWaves.ts). */
  announcedWaves: string[];
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
  /** Touring acts wanting a bus and driver for weeks (buses.ts). */
  busHires: BusHire[];
  /** Recent shows per town by who played them ('player' or a rival id), fading each year: market share. */
  townShows: Record<string, Record<string, number>>;
  /** Buzz and deals from trade shows (marketing.ts). */
  promo?: Promo;
  /** Day each rival was last raided for crew (headhunt.ts). */
  headhunted?: Record<string, number>;
  /** Per-rival heat and investigator cover (rivalry.ts). */
  rivalry: Record<string, { heat: number; intelUntil?: number }>;
  /** Brand sponsors and goodwill (sponsors.ts). */
  sponsors: SponsorDeal[];
  goodwill?: number;
  charityDone?: number;
  /** showsPlayed at the last monthly sponsor check. */
  sponsorMark?: number;
  /** Rooms you own (owned.ts). */
  ownedVenues: OwnedVenue[];
  /** This year's festival of your own, if any (ownfest.ts). */
  ownFestival?: OwnFestival;
  /** 0-100: how well the festival's name sells. */
  festivalBrand?: number;
  festivalHistory: FestivalEdition[];
  /** Losses carried forward against future profits (tax.ts). */
  taxLoss?: number;
  /** Days (since the start) on which you made an insurance claim (incidents.ts). */
  claims: number[];
  /** Moving average of the departments your recent shows needed (expertise.ts). */
  mix?: Record<Dept, number>;
  /** Invoices waiting to be paid (receivables.ts). */
  receivables: Invoice[];
  /** A fuel contract: the locked price multiplier and when it ends (market.ts). */
  fuelLock?: { price: number; untilDay: number };
  /** Stock-market listing, once you go public (shares.ts). */
  listing?: Listing;
  /** Rivals undercutting your towns (pricewars.ts). */
  priceWars: PriceWar[];
  /** Planned road runs (runs.ts). */
  runs: Run[];
  /** Promoter relationship per venue, 0-8 (venues.ts). */
  venueRelations: Record<string, number>;
  partners: Partial<Record<Dept, { brand: string; sinceDay: number; lapse: number }>>;
  reports: AnnualReport[];
  charts?: YearChart[];
  /** Every incident ever, counted by kind and by cause (consequences.ts). */
  incidentTally?: { kinds: Record<string, number>; causes: Record<string, number>; main: Record<string, number> };
  /** Why things went wrong: the recent incident log (consequences.ts). */
  incidents?: Incident[];
  /** Rapport between pairs of crew, −100..100, keyed by sorted id pair (bonds.ts). */
  bonds?: Record<string, number>;
  /** Department heads on the payroll (management.ts). */
  managers?: { production?: boolean; crew?: boolean; finance?: boolean; spendLimit?: 0.1 | 0.2 | 0.35 };
  /** Acts and venues that won't book you, until a day (blacklist.ts). Keys `act:Name`, `venue:id`. */
  blacklist?: Record<string, number>;
  /** Days you broke each act's rider. */
  breachLog?: Record<string, number[]>;
  /** What you've taught each client about extras (changes.ts). */
  clients?: Record<string, { paid: number; absorbed: number; refused: number; declined: number }>;
  /** Maintenance you've put off because cash was short. */
  lapses?: { workshop?: { hour: number; incidentId: string } };
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
  stats: { showsPlayed: number; showsFailed: number; peakCash: number; rivalsBought?: number; /** Cash at the start, for the money invariant (invariants.ts). */ startCash?: number; /** Crew who quit, burnt out or were poached. */ crewLost?: number };
  /** Chosen at the start (scenario.ts). */
  difficulty?: Difficulty;
  goal?: GoalId;
  /** A historic scenario (scenarios.ts) this game started as. */
  scenario?: string;
  goalResult?: { status: 'won' | 'missed'; day: number };
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

/** A tour's bus contract: an act wants a sleeper bus and driver for weeks. */
export interface BusHire {
  id: string;
  act: string;
  tier: number;
  /** Days on tour. */
  days: number;
  /** Per day, driver included. */
  rate: number;
  startDay: number;
  acceptByDay: number;
  status: 'offer' | 'active' | 'done' | 'lost';
  vehicleId?: string;
  rivalId?: string;
  /** Earned so far. */
  earned?: number;
}
