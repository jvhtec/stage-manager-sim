/**
 * The rental market between firms. Short of kit for a show? Sub-hire it from
 * a rival with a base nearby — they deliver straight to the venue, at a day
 * rate, with kit that meets the night's expectations. Got kit sitting idle?
 * Rent it out between your own jobs for an income, at the cost of extra wear.
 */
import { book, yearOf } from './core';
import { expectedQuality, getProduct, productsAvailableIn } from './content/gear';
import { deptTotals } from './loading';
import { roadDistance } from './pathfinding';
import { condition } from './wear';
import { DEPTS, type DeptCounts, type GearStock, type Gig, type TycoonState, type WorldMap } from './types';

/** Day rate as a share of the kit's replacement value. */
export const SUBHIRE_DAY_RATE = 0.1;
/** How far a rival will deliver. */
const SUBHIRE_RADIUS = 40;
/** Units each nearby rival can spare, per department. */
const UNITS_PER_RIVAL = 5;
/** Rent-out income per day as a share of the replacement value of idle kit… */
export const RENT_OUT_DAY_RATE = 0.0012;
/** …and the wear it costs (condition points per day). */
const RENT_OUT_WEAR = 0.06;

/** The kind of kit a rental house sends: workmanlike, a notch below what the show expects. */
export function rentalProduct(dept: keyof DeptCounts, tier: number, year: number): string | undefined {
  const bar = expectedQuality(tier, year) - 1;
  const options = productsAvailableIn(year, dept);
  if (!options.length) return undefined;
  return [...options].sort((a, b) => Math.abs(a.quality - bar) - Math.abs(b.quality - bar) || a.price - b.price)[0].id;
}

export interface SubHire {
  stock: GearStock;
  units: number;
  cost: number;
  /** Rivals supplying it. */
  from: string[];
}

/** What you'd sub-hire to fill the gaps left by `working` at `gig`. */
export function subHireFor(state: TycoonState, world: WorldMap, gig: Gig, working: GearStock): SubHire {
  const none: SubHire = { stock: {}, units: 0, cost: 0, from: [] };
  if (state.policies.subhire === 'off' || gig.overseas) return none;
  const nearby = state.rivals.filter(r => roadDistance(world, r.hqCityId, gig.cityId) <= SUBHIRE_RADIUS);
  if (!nearby.length) return none;
  const have = deptTotals(working);
  const year = yearOf(state, gig.day * 24);
  const days = gig.days ?? 1;
  const stock: GearStock = {};
  let units = 0;
  let cost = 0;
  DEPTS.forEach(d => {
    const short = Math.min(gig.needs[d] - have[d], nearby.length * UNITS_PER_RIVAL);
    if (short <= 0) return;
    const id = rentalProduct(d, gig.tier, year);
    if (!id) return;
    stock[id] = (stock[id] ?? 0) + short;
    units += short;
    cost += getProduct(id).price * SUBHIRE_DAY_RATE * short * days;
  });
  return { stock, units, cost: Math.round(cost), from: nearby.slice(0, 2).map(r => r.name) };
}

export function bookSubHire(s: TycoonState, hire: SubHire) {
  if (hire.cost) book(s, 'subhire', -hire.cost);
}

/** Daily: idle kit out on dry hire earns a little and wears a little. */
export function dailyRentOut(s: TycoonState) {
  if (s.policies.rentOut !== 'on') return;
  let income = 0;
  s.depots.forEach(d => {
    for (const id in d.gear) {
      const n = d.gear[id];
      if (!n) continue;
      income += getProduct(id).price * n * RENT_OUT_DAY_RATE;
      s.gearCondition[id] = Math.max(0, condition(s, id) - RENT_OUT_WEAR);
    }
  });
  if (income) book(s, 'rental', Math.round(income));
}

/** Rough monthly rent-out income at today's stock, for the Policies window. */
export function rentOutMonthly(state: TycoonState): number {
  let value = 0;
  state.depots.forEach(d => {
    for (const id in d.gear) value += getProduct(id).price * d.gear[id];
  });
  return Math.round(value * RENT_OUT_DAY_RATE * 30);
}
