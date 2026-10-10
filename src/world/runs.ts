/**
 * Road runs. Plan a string of offers for one truck: the planner checks every
 * stop makes load-in, adds up the driving and the nights away, and — if you
 * book the lot and deliver all of it well — pays a bonus for the efficiency
 * of a tight route (promoters like a supplier who's already in the area).
 */
import { tripCharges } from './infra';
import { fuelMultiplier } from './market';
import { HOTEL_NIGHT, PER_DIEM, fuelPerTile, getModel } from './catalog';
import { book, dayOf, formatMoney, gigById, loadInHour, newId, pushNews } from './core';
import { estimateArrival, SUGGEST_RANGE } from './queries';
import { roadDistance } from './pathfinding';
import { worldOf } from './mapgen';
import { gigBookingBar } from './standing';
import type { Gig, Run, TycoonState, Vehicle } from './types';

/** Bonus per extra date on the run, up to the cap. */
export const RUN_BONUS_PER_DATE = 0.03;
export const RUN_BONUS_CAP = 0.12;
/** Every show must land at least this well for the run to pay. */
export const RUN_MIN_QUALITY = 0.6;

export const runBonusRate = (dates: number) => Math.min(RUN_BONUS_CAP, RUN_BONUS_PER_DATE * Math.max(0, dates - 1));

/** Offers that could be strung onto a truck's run: open, bookable, plain single shows, in a sensible reach. */
export function runCandidates(state: TycoonState, v: Vehicle): Gig[] {
  const world = worldOf(state);
  const today = dayOf(state.hour);
  return state.gigs
    .filter(g => {
      if (g.status !== 'offer' || g.tourId || g.festival || g.event || g.overseas) return false;
      if (g.acceptByDay < today || g.day <= today) return false;
      const d = roadDistance(world, v.homeCityId, g.cityId);
      return Number.isFinite(d) && d <= SUGGEST_RANGE * 2.5;
    })
    .sort((a, b) => a.day - b.day);
}

export interface RunStop {
  gig: Gig;
  /** Tiles from the previous stop (or where the truck starts). */
  leg: number;
  /** Hours to spare at load-in; negative means late. */
  spare: number;
  blocker: string | null;
}

export interface RunPlan {
  stops: RunStop[];
  feasible: boolean;
  fees: number;
  distance: number;
  fuel: number;
  /** Tolls, ferry and tunnel fares, customs. */
  tolls: number;
  nights: number;
  travel: number;
  bonusRate: number;
  bonus: number;
  /** Fees and bonus less fuel, tolls and nights away — before wear, wages and the rest. */
  net: number;
}

export function planRun(state: TycoonState, v: Vehicle, gigIds: string[]): RunPlan {
  const world = worldOf(state);
  const model = getModel(v.modelId);
  const gigs = gigIds.map(id => gigById(state, id)).filter((g): g is Gig => !!g).sort((a, b) => loadInHour(a) - loadInHour(b));
  // The truck as it would be with these on the end of whatever it already has.
  const hypo: Vehicle = { ...v, orders: [...v.orders.filter(id => !gigIds.includes(id)), ...gigs.map(g => g.id)] };
  let at = v.status === 'driving' || v.status === 'broken' ? v.route!.to : v.cityId ?? v.homeCityId;
  const before = v.orders.map(id => gigById(state, id)).filter((g): g is Gig => !!g && g.status === 'booked');
  if (before.length) at = before[before.length - 1].cityId;
  let distance = 0;
  let tolls = 0;
  const stops: RunStop[] = gigs.map(g => {
    const leg = roadDistance(world, at, g.cityId);
    distance += Number.isFinite(leg) ? leg : 0;
    tolls += tripCharges(world, at, g.cityId, model.kind).total;
    at = g.cityId;
    return {
      gig: g,
      leg: Number.isFinite(leg) ? leg : 0,
      spare: loadInHour(g) - estimateArrival(state, hypo, g),
      blocker: g.status !== 'offer' ? 'No longer open.' : gigBookingBar(state, g).reason ?? (g.acceptByDay < dayOf(state.hour) ? 'Booking deadline passed.' : null),
    };
  });
  const home = roadDistance(world, at, v.homeCityId);
  if (Number.isFinite(home)) distance += home;
  tolls += tripCharges(world, at, v.homeCityId, model.kind).total;
  const fees = gigs.reduce((sum, g) => sum + g.fee, 0);
  const fuel = Math.round(distance * fuelPerTile(model) * fuelMultiplier(state));
  const days = new Set(gigs.map(g => g.day));
  const away = gigs.filter(g => g.cityId !== v.homeCityId);
  const nights = away.length ? Math.max(1, new Set(away.map(g => g.day)).size + (days.size > 1 ? days.size - 1 : 0)) : 0;
  const crew = Math.min(model.crewSeats, Math.max(0, ...gigs.map(g => g.crewNeeded)));
  const travel = nights * crew * (PER_DIEM + (model.kind === 'bus' ? 0 : HOTEL_NIGHT));
  const bonusRate = runBonusRate(gigs.length);
  const bonus = Math.round(fees * bonusRate);
  return {
    stops,
    feasible: stops.length > 0 && stops.every(s => s.spare >= 0 && !s.blocker),
    fees,
    distance,
    fuel,
    tolls,
    nights,
    travel,
    bonusRate,
    bonus,
    net: Math.round(fees + bonus - fuel - tolls - travel),
  };
}

/** Mutating: record the run once its shows are booked. */
export function openRun(s: TycoonState, vehicleId: string, gigIds: string[]) {
  if (gigIds.length < 2) return;
  s.runs.push({ id: newId(s, 'run'), vehicleId, gigIds, bonusRate: runBonusRate(gigIds.length), status: 'active' });
}

/** Daily: settle runs whose shows are all over — a bonus if every one landed. */
export function settleRuns(s: TycoonState) {
  s.runs.forEach(run => {
    if (run.status !== 'active') return;
    const gigs = run.gigIds.map(id => gigById(s, id));
    if (gigs.some(g => g?.status === 'booked')) return;
    const ok = gigs.every(g => g && g.status === 'done' && (g.result?.quality ?? 0) >= RUN_MIN_QUALITY);
    if (ok) {
      const fees = gigs.reduce((sum, g) => sum + (g?.fee ?? 0), 0);
      const bonus = Math.round(fees * run.bonusRate);
      book(s, 'bonuses', bonus);
      run.status = 'paid';
      run.bonus = bonus;
      pushNews(s, `Run bonus: all ${gigs.length} dates delivered cleanly — promoters add ${formatMoney(s, bonus)}.`, 'good');
    } else {
      run.status = 'broken';
    }
  });
  // Keep the live ones and the last few settled for the planner's history.
  const settled = s.runs.filter(r => r.status !== 'active');
  const drop = new Set(settled.slice(0, Math.max(0, settled.length - 8)).map(r => r.id));
  s.runs = s.runs.filter(r => !drop.has(r.id));
}
