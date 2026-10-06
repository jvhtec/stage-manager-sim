/**
 * Static game data and tuning knobs for the world sim: vehicle models (which
 * unlock by year, like new engines in Transport Tycoon), gear prices, venue
 * tiers, the show-day timetable, and the running-cost economy.
 */
import type { Dept, DeptCounts } from './types';

export const HOURS_PER_DAY = 24;
export const START_YEAR = 1990;

// Show-day timetable, in hours after midnight on the gig's day. Trucks must be
// at the venue by LOAD_IN; anything that rolls up after SHOW_START is useless.
export const LOAD_IN_HOUR = 10;
export const SHOW_START_HOUR = 20;
export const SHOW_END_HOUR = 23;
/** Teardown finishes at 02:00 the following morning. */
export const LOAD_OUT_DONE_HOUR = 26;
/** Spare hours a vehicle plans to arrive ahead of load-in. */
export const DEPARTURE_BUFFER_HOURS = 4;

export interface VehicleModel {
  id: string;
  name: string;
  kind: 'van' | 'truck' | 'semi' | 'bus';
  /** Gear units (roughly: one flight-cased department package). */
  gearCapacity: number;
  crewSeats: number;
  /** Tiles per hour. */
  speed: number;
  price: number;
  runningCostPerYear: number;
  /** Max reliability when new (0-100). */
  reliability: number;
  lifespanYears: number;
  introYear: number;
}

export const VEHICLE_MODELS: VehicleModel[] = [
  {
    id: 'splitter-van',
    name: 'Splitter Van',
    kind: 'van',
    gearCapacity: 3,
    crewSeats: 6,
    speed: 1.6,
    price: 16000,
    runningCostPerYear: 3500,
    reliability: 82,
    lifespanYears: 8,
    introYear: 1980,
  },
  {
    id: 'luton-box',
    name: 'Luton Box Van',
    kind: 'truck',
    gearCapacity: 6,
    crewSeats: 2,
    speed: 1.5,
    price: 28000,
    runningCostPerYear: 5500,
    reliability: 80,
    lifespanYears: 10,
    introYear: 1984,
  },
  {
    id: 'rigid-7t',
    name: '7.5t Rigid Truck',
    kind: 'truck',
    gearCapacity: 12,
    crewSeats: 2,
    speed: 1.35,
    price: 52000,
    runningCostPerYear: 9500,
    reliability: 84,
    lifespanYears: 12,
    introYear: 1988,
  },
  {
    id: 'artic-40',
    name: 'Artic 40ft Trailer',
    kind: 'semi',
    gearCapacity: 28,
    crewSeats: 2,
    speed: 1.2,
    price: 115000,
    runningCostPerYear: 21000,
    reliability: 86,
    lifespanYears: 15,
    introYear: 1992,
  },
  {
    id: 'sleeper-bus',
    name: 'Crew Sleeper Bus',
    kind: 'bus',
    gearCapacity: 2,
    crewSeats: 12,
    speed: 1.45,
    price: 140000,
    runningCostPerYear: 18000,
    reliability: 88,
    lifespanYears: 15,
    introYear: 1994,
  },
  {
    id: 'euro-van',
    name: 'EuroSprint Van',
    kind: 'van',
    gearCapacity: 4,
    crewSeats: 7,
    speed: 1.9,
    price: 24000,
    runningCostPerYear: 3800,
    reliability: 92,
    lifespanYears: 9,
    introYear: 1998,
  },
  {
    id: 'megaliner',
    name: 'Megaliner 45ft',
    kind: 'semi',
    gearCapacity: 40,
    crewSeats: 2,
    speed: 1.35,
    price: 190000,
    runningCostPerYear: 28000,
    reliability: 93,
    lifespanYears: 16,
    introYear: 2004,
  },
];

export function getModel(id: string): VehicleModel {
  const model = VEHICLE_MODELS.find(m => m.id === id);
  if (!model) throw new Error(`Unknown vehicle model ${id}`);
  return model;
}

export function modelsAvailableIn(year: number): VehicleModel[] {
  return VEHICLE_MODELS.filter(m => m.introYear <= year);
}

export const GEAR_PRICES: Record<Dept, number> = {
  audio: 2600,
  lighting: 2100,
  video: 4200,
  stage: 1500,
};
export const GEAR_RESALE_RATE = 0.5;

export const DEPT_LABELS: Record<Dept, string> = {
  audio: 'Audio',
  lighting: 'Lighting',
  video: 'Video',
  stage: 'Staging',
};

export const DEPT_COLORS: Record<Dept, string> = {
  audio: '#3b82f6',
  lighting: '#f59e0b',
  video: '#a855f7',
  stage: '#10b981',
};

export interface TierInfo {
  tier: number;
  label: string;
  minReputation: number;
  baseFee: number;
  needs: DeptCounts;
  crew: number;
  color: string;
}

export const TIERS: TierInfo[] = [
  {
    tier: 1,
    label: 'Local Circuit',
    minReputation: 0,
    baseFee: 3200,
    needs: { audio: 2, lighting: 1, video: 0, stage: 1 },
    crew: 2,
    color: '#94a3b8',
  },
  {
    tier: 2,
    label: 'Regional',
    minReputation: 25,
    baseFee: 8500,
    needs: { audio: 4, lighting: 3, video: 1, stage: 2 },
    crew: 4,
    color: '#38bdf8',
  },
  {
    tier: 3,
    label: 'National',
    minReputation: 55,
    baseFee: 30000,
    needs: { audio: 8, lighting: 7, video: 4, stage: 6 },
    crew: 8,
    color: '#f472b6',
  },
  {
    tier: 4,
    label: 'World Class',
    minReputation: 80,
    baseFee: 95000,
    needs: { audio: 16, lighting: 14, video: 10, stage: 12 },
    crew: 16,
    color: '#facc15',
  },
];

export function tierInfo(tier: number): TierInfo {
  return TIERS[Math.max(1, Math.min(4, tier)) - 1];
}

export function companyTier(reputation: number): number {
  let tier = 1;
  TIERS.forEach(t => {
    if (reputation >= t.minReputation) tier = t.tier;
  });
  return tier;
}

// Economy -------------------------------------------------------------------
export const STARTING_CASH = 50000;
export const STARTING_REPUTATION = 18;
export const CREW_WAGE_PER_DAY = 55;
export const CREW_HIRE_COST = 400;
export const DEPOT_BUILD_COST = 35000;
export const DEPOT_UPKEEP_PER_MONTH = 900;
export const LOAN_STEP = 10000;
export const MAX_LOAN = 150000;
export const LOAN_INTEREST_PER_YEAR = 0.07;
export const NEGATIVE_MONTHS_GAME_OVER = 3;
export const SERVICE_INTERVAL_DAYS = 45;
export const SERVICE_HOURS = 8;
export const SERVICE_COST = 350;
/** Share of the fee forfeited when a booked show doesn't happen. */
export const NO_SHOW_PENALTY_RATE = 0.3;
export const DAYS_PER_YEAR = 365;
