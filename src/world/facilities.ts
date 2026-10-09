/**
 * Your bases. Two kinds:
 *
 * - **Delegations** — a branch office: cheap, a sales desk and a lock-up for
 *   a few cases. Local contacts make freelance crew there cheaper and better,
 *   and sales staff bring in work from the region. Vans and crew buses only.
 * - **Warehouses** — the real thing, in four sizes: racks for the rig, a
 *   loading dock for trucks of any size, and a prep crew who check every
 *   case before it goes out.
 *
 * Bases cut road costs (shorter runs, fewer nights in hotels) and freelance
 * rates, but add rent — dearer in big cities — and full-time salaries.
 * Full-time staff never go on the road: gig technicians do.
 */
import { tierInfo } from './catalog';
import { depotInCity } from './core';
import { addStock, stockSize } from './loading';
import { roadDistance } from './pathfinding';
import type { CitySize, Depot, FacilityKind, GearStock, StaffRole, TycoonState, Vehicle, WorldMap } from './types';

export interface FacilitySpec {
  label: string;
  /** Cost to build (or to upgrade into this from the level below). */
  build: number;
  /** Rent, rates and utilities per month in a mid-size city. */
  rent: number;
  /** Gear units it can hold (in the building plus on its trucks). */
  capacity: number;
  maxStaff: Record<StaffRole, number>;
  /** Vehicle kinds that can be based here. */
  vehicles: 'all' | ('van' | 'bus')[];
  /** Reputation needed to open or grow into it. */
  minReputation: number;
  blurb: string;
}

export const DELEGATION: FacilitySpec = {
  label: 'Delegation',
  build: 12000,
  rent: 450,
  capacity: 25,
  maxStaff: { warehouse: 1, office: 4 },
  vehicles: ['van', 'bus'],
  minReputation: 0,
  blurb: 'A branch office with a sales desk and a lock-up: local contacts, local freelancers, vans only.',
};

export const WAREHOUSES: FacilitySpec[] = [
  {
    label: 'Small warehouse',
    build: 35000,
    rent: 900,
    capacity: 120,
    maxStaff: { warehouse: 4, office: 2 },
    vehicles: 'all',
    minReputation: 0,
    blurb: 'Racks, a loading dock and room for a couple of trucks.',
  },
  {
    label: 'Medium warehouse',
    build: 60000,
    rent: 1700,
    capacity: 320,
    maxStaff: { warehouse: 8, office: 4 },
    vehicles: 'all',
    minReputation: tierInfo(2).minReputation,
    blurb: 'A proper production base: high racks, three bays and a prep floor.',
  },
  {
    label: 'Large warehouse',
    build: 110000,
    rent: 3000,
    capacity: 800,
    maxStaff: { warehouse: 16, office: 6 },
    vehicles: 'all',
    minReputation: tierInfo(3).minReputation,
    blurb: 'A stadium-tour shed: a fleet of artics backs onto the dock.',
  },
  {
    label: 'Production campus',
    build: 260000,
    rent: 5200,
    capacity: 2000,
    maxStaff: { warehouse: 28, office: 10 },
    vehicles: 'all',
    minReputation: tierInfo(4).minReputation,
    blurb: 'A full production campus: acres of racks, a fleet yard and room for annexes of every kind.',
  },
];

export const STAFF: Record<StaffRole, { label: string; salary: number; blurb: string }> = {
  warehouse: { label: 'Warehouse & prep', salary: 1300, blurb: 'Check, pack and load every case. Unprepped kit fails more and gets left behind.' },
  office: { label: 'Sales & office', salary: 1600, blurb: 'Bring in work from the region and keep the local scene sweet.' },
};
export const STAFF_ROLES: StaffRole[] = ['warehouse', 'office'];

/** Rent multiplier by town size. */
export const RENT_FACTOR: Record<CitySize, number> = { village: 0.6, town: 0.8, city: 1, metropolis: 1.5 };

/** Gear units one prep tech can keep on top of. */
const UNITS_PER_PREP_TECH = 45;
/** Extra show offers per office staff member, nearby (max total below). */
const SALES_BOOST_PER_STAFF = 0.12;
const MAX_SALES_BOOST = 0.6;
const SALES_RADIUS = 30;

export function facilitySpec(d: Pick<Depot, 'kind' | 'size'>): FacilitySpec {
  return d.kind === 'delegation' ? DELEGATION : WAREHOUSES[Math.max(1, Math.min(WAREHOUSES.length, d.size)) - 1];
}

/** What a base can become next, if anything. */
export function nextUpgrade(d: Pick<Depot, 'kind' | 'size'>): { spec: FacilitySpec; cost: number; kind: FacilityKind; size: number } | null {
  if (d.kind === 'delegation') return { spec: WAREHOUSES[0], cost: WAREHOUSES[0].build - Math.round(DELEGATION.build / 2), kind: 'warehouse', size: 1 };
  if (d.size >= WAREHOUSES.length) return null;
  return { spec: WAREHOUSES[d.size], cost: WAREHOUSES[d.size].build, kind: 'warehouse', size: d.size + 1 };
}

export function monthlyRent(world: WorldMap, d: Depot): number {
  const size = world.cityById.get(d.cityId)?.size ?? 'city';
  return Math.round(facilitySpec(d).rent * RENT_FACTOR[size]);
}

export const staffCount = (d: Depot) => d.staff.warehouse + d.staff.office;

export function monthlySalaries(state: TycoonState, payMultiplier: number): number {
  return Math.round(state.depots.reduce((sum, d) => sum + (d.staff.warehouse * STAFF.warehouse.salary + d.staff.office * STAFF.office.salary) * payMultiplier, 0));
}

/** Everything a base is responsible for: what's on its racks and on its trucks. */
export function homeStock(state: TycoonState, d: Depot): GearStock {
  const all: GearStock = { ...d.gear };
  state.vehicles.filter(v => v.owner === 'player' && v.homeCityId === d.cityId).forEach(v => addStock(all, v.cargo));
  return all;
}

export const usedCapacity = (state: TycoonState, d: Depot) => stockSize(homeStock(state, d));

/** 0-1: how well the prep crew keeps up with the kit going in and out. */
export function prepRatio(state: TycoonState, d: Depot): number {
  const units = usedCapacity(state, d);
  if (!units) return 1;
  return Math.min(1, (d.staff.warehouse * UNITS_PER_PREP_TECH) / units);
}

/** Prep across the trucks at a show, weighted by what each carries. */
export function prepOf(state: TycoonState, vehicles: Vehicle[]): number {
  let units = 0;
  let weighted = 0;
  vehicles.forEach(v => {
    const base = depotInCity(state, v.homeCityId);
    const n = stockSize(v.cargo);
    units += n;
    weighted += n * (base ? prepRatio(state, base) : 0);
  });
  return units ? weighted / units : 1;
}

/** Failure-chance multiplier from prep: 0.6× fully prepped, 1.6× unprepped. */
export const prepFailureFactor = (prep: number) => 1.6 - prep;

/** Chance per truck that a case gets left on the warehouse floor. */
export const leftBehindChance = (prep: number) => Math.max(0, 0.5 - prep) * 0.6;

/** Extra share of show offers in a town from your sales staff nearby. */
export function salesBoost(state: TycoonState, world: WorldMap, cityId: string): number {
  let boost = 0;
  state.depots.forEach(d => {
    if (!d.staff.office) return;
    const dist = d.cityId === cityId ? 0 : roadDistance(world, d.cityId, cityId);
    if (dist > SALES_RADIUS) return;
    boost += d.staff.office * SALES_BOOST_PER_STAFF * (dist <= 8 ? 1 : 0.5);
  });
  return Math.min(MAX_SALES_BOOST, boost);
}

export const hasBaseIn = (state: TycoonState, cityId: string) => !!depotInCity(state, cityId);

export function canBaseVehicle(d: Pick<Depot, 'kind' | 'size'>, kind: 'van' | 'truck' | 'semi' | 'bus'): boolean {
  const allowed = facilitySpec(d).vehicles;
  return allowed === 'all' || (allowed as string[]).includes(kind);
}
