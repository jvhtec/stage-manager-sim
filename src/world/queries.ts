/** Read-only projections for the UI — nothing here mutates state. */
import { GEAR_RESALE_RATE, HOTEL_NIGHT, HOURS_PER_DAY, PER_DIEM, fuelPerTile, getModel } from './catalog';
import { getProduct } from './content/gear';
import { techBonus } from './content/techs';
import { houseRigAt } from './contracts';
import { ownedStock } from './wear';
import { freelancersFor, type FreelanceHire } from './crew';
import { prepRatio } from './facilities';
import { subHireFor, type SubHire } from './hire';
import { moraleBonus } from './crew';
import { REST_AT, aboard, atDepot, evaluateCrew, mayBoard, pickCrew, type CrewEvaluation } from './people';
import { addStock, baseShowQuality, deptTotals, evaluateGear, pickGear, stockSize, type GearEvaluation } from './loading';
import {
  dateOfDay,
  depotInCity,
  emptyCounts,
  formatHour,
  gigById,
  loadInHour,
  loadOutDoneHour,
  plannedDepartureHour,
  sellValue,
  travelHours,
} from './core';
import { worldOf } from './mapgen';
import { roadDistance } from './pathfinding';
import { DEPTS, type CrewMember, type DeptCounts, type GearStock, type Gig, type TycoonState, type Vehicle } from './types';

export function vehicleActivity(state: TycoonState, v: Vehicle): string {
  const world = worldOf(state);
  const cityName = (id?: string) => (id ? world.cityById.get(id)?.name ?? '?' : '?');
  const next = v.orders.length ? gigById(state, v.orders[0]) : undefined;
  switch (v.status) {
    case 'driving':
      return `Heading to ${cityName(v.route?.to)}`;
    case 'broken':
      return `Broken down near ${cityName(v.route?.to)}`;
    case 'servicing':
      return 'In the workshop';
    case 'on-site':
      return next ? `On site: ${world.venueById.get(next.venueId)?.name}` : 'On site';
    case 'scheduled':
      if (next && v.cityId) {
        return `Departs ${formatHour(state, plannedDepartureHour(world, v, v.cityId, next))} for ${cityName(next.cityId)}`;
      }
      return 'Waiting for orders';
    default:
      return v.cityId === v.homeCityId ? `Parked at ${cityName(v.cityId)} depot` : `Parked in ${cityName(v.cityId)}`;
  }
}

/** Rough arrival hour if `v` were sent to `gig` given its current orders. */
export function estimateArrival(state: TycoonState, v: Vehicle, gig: Gig): number {
  const world = worldOf(state);
  const earlier = v.orders
    .map(id => gigById(state, id))
    .filter((g): g is Gig => !!g && g.id !== gig.id && g.day <= gig.day);
  const last = earlier[earlier.length - 1];
  if (last) {
    return loadOutDoneHour(last) + travelHours(world, v.modelId, last.cityId, gig.cityId);
  }
  if (v.status === 'driving' || v.status === 'broken') {
    const to = v.route!.to;
    const remaining = Math.ceil((roadDistance(world, v.route!.from, to) - v.route!.progress) / getModel(v.modelId).speed);
    const start = state.hour + Math.max(0, remaining) + Math.max(0, (v.brokenUntil ?? 0) - state.hour);
    return start + travelHours(world, v.modelId, to, gig.cityId);
  }
  const from = v.cityId ?? v.homeCityId;
  const loaded = stockSize(v.cargo) + v.crew > 0;
  if (from === gig.cityId && (loaded || from !== v.homeCityId)) return state.hour;
  const depart = Math.max(state.hour, plannedDepartureHour(world, v, from, gig));
  return depart + travelHours(world, v.modelId, from, gig.cityId);
}

export interface CoverageProjection {
  gear: DeptCounts;
  crew: number;
  latestArrival: number;
  onTime: boolean;
  vehicles: Vehicle[];
  /** Kit vs expectations and rider, from the same evaluation the sim uses. */
  evaluation: GearEvaluation;
  /** Expected show quality (0-1) if everything goes to plan. */
  expectedQuality: number;
  /** Star techs riding with the assigned trucks. */
  techIds: string[];
  /** The kit that would go out, by product. */
  delivered: GearStock;
  /** Local freelancers who'd fill any crew gap. */
  freelance: FreelanceHire;
  /** How well-prepped the kit going out is (0-1). */
  prep: number;
  /** Kit you'd sub-hire from rivals to fill the gaps. */
  subhire: SubHire;
  /** Who'd be working it, and how well they fit. */
  people: CrewMember[];
  crewEval: CrewEvaluation;
}

/** What would turn up at `gig` if things go to plan — runs the sim's own loading and scoring. */
export function projectCoverage(state: TycoonState, gig: Gig): CoverageProjection {
  const vehicles = state.vehicles.filter(v => v.owner === 'player' && v.orders.includes(gig.id));
  const stock = new Map(state.depots.map(d => [d.cityId, { gear: { ...d.gear }, people: atDepot(state, d.id) }]));
  const delivered: GearStock = { ...(vehicles.length ? houseRigAt(state, gig.venueId) : undefined) };
  const people: CrewMember[] = [];
  let latestArrival = 0;

  // Already-loaded vehicles first (that's what the sim nets out), then the rest.
  const isLoaded = (v: Vehicle) => stockSize(v.cargo) + v.crew > 0;
  const ordered = [...vehicles].sort((a, b) => Number(isLoaded(b)) - Number(isLoaded(a)));
  ordered.forEach(v => {
    latestArrival = Math.max(latestArrival, estimateArrival(state, v, gig));
    if (isLoaded(v)) {
      addStock(delivered, v.cargo);
      people.push(...aboard(state, v.id));
      return;
    }
    const model = getModel(v.modelId);
    const depot = stock.get(v.homeCityId);
    if (!depot) return;
    const have = deptTotals(delivered);
    const remaining = emptyCounts();
    DEPTS.forEach(d => (remaining[d] = Math.max(0, gig.needs[d] - have[d])));
    addStock(delivered, pickGear(depot.gear, remaining, model.gearCapacity, gig.rider));
    const opts = { vehicleId: v.id, restAt: REST_AT[state.policies.rest] };
    const pinned = depot.people.filter(m => m.pinnedVehicleId === v.id).length;
    const seats = Math.min(model.crewSeats, Math.max(pinned, gig.crewNeeded - people.length), depot.people.filter(m => mayBoard(m, opts)).length);
    people.push(...pickCrew(depot.people, gig, seats, people, opts));
  });
  const crew = people.length;
  const crewEval = evaluateCrew(people, gig);
  let effCrew = crewEval.effective;

  const subhire = vehicles.length ? subHireFor(state, worldOf(state), gig, delivered) : { stock: {}, units: 0, cost: 0, from: [] };
  const withHire: GearStock = { ...delivered };
  addStock(withHire, subhire.stock);
  const evaluation = evaluateGear(withHire, gig, dateOfDay(state, gig.day).getUTCFullYear(), state.gearCondition);
  const freelance = vehicles.length ? freelancersFor(state, worldOf(state), gig, crew) : { count: 0, cost: 0, effectiveness: 0, local: false };
  effCrew += freelance.count * freelance.effectiveness;
  // Prep is judged on the bases the trucks come from (loaded or not).
  const prep = vehicles.length
    ? vehicles.reduce((sum, v) => {
        const base = depotInCity(state, v.homeCityId);
        return sum + (base ? prepRatio(state, base) : 0);
      }, 0) / vehicles.length
    : 1;
  const vehicleIds = new Set(vehicles.map(v => v.id));
  const techIds = state.techs.filter(t => t.vehicleId && vehicleIds.has(t.vehicleId)).map(t => t.techId);
  const onTime = !vehicles.length || latestArrival <= loadInHour(gig);
  const expectedQuality = vehicles.length
    ? baseShowQuality({
        gearCoverage: evaluation.coverage,
        crewCoverage: Math.min(1, effCrew / Math.max(1, gig.crewNeeded)),
        lateHours: Math.max(0, latestArrival - loadInHour(gig)),
        gearQuality: evaluation.quality,
        riderMet: evaluation.riderMet,
        bonus: techBonus(techIds, gig.act) + moraleBonus(state.crewMorale) + crewEval.bonus,
      })
    : 0;
  return { gear: evaluation.delivered, crew, latestArrival, onTime, vehicles, evaluation, expectedQuality, techIds, delivered, freelance, prep, subhire, people, crewEval };
}

/** What a pile of kit would fetch, given its condition. */
export function stockValue(stock: GearStock, condition: Record<string, number> = {}): number {
  let total = 0;
  for (const id in stock) total += getProduct(id).price * GEAR_RESALE_RATE * (0.5 + 0.5 * ((condition[id] ?? 100) / 100)) * stock[id];
  return total;
}

export function companyValue(state: TycoonState): number {
  const fleet = state.vehicles.filter(v => v.owner === 'player' && !v.lease).reduce((sum, v) => sum + sellValue(v, state.hour), 0);
  // Everything you own, wherever it is: racks, trucks, couriers and venues' house rigs.
  const gear = stockValue(ownedStock(state), state.gearCondition);
  return Math.round(state.company.cash - state.company.loan + fleet + gear + state.depots.length * 20000);
}

export function homeDepot(state: TycoonState, v: Vehicle) {
  return depotInCity(state, v.homeCityId);
}

export interface JobCosts {
  fuel: number;
  travel: number;
  freelance: number;
  subhire: number;
  total: number;
  nights: number;
}

/**
 * Rough road costs of a job for the trucks assigned to it: fuel there and
 * back, a night's per diems and hotel for each crew member for every night
 * away, and any freelancers. (Tours share the trip between dates; this
 * counts each date as its own round trip, so it errs on the high side.)
 */
export function estimateJobCosts(state: TycoonState, gig: Gig, projection = projectCoverage(state, gig)): JobCosts {
  const world = worldOf(state);
  let fuel = 0;
  let travel = 0;
  let nights = 0;
  projection.vehicles.forEach(v => {
    const model = getModel(v.modelId);
    const dist = roadDistance(world, v.homeCityId, gig.cityId);
    if (!Number.isFinite(dist)) return;
    fuel += dist * 2 * fuelPerTile(model);
    if (v.homeCityId === gig.cityId && !gig.overseas) return;
    const away = Math.max(1, Math.ceil((loadOutDoneHour(gig) - loadInHour(gig) + (2 * dist) / model.speed) / HOURS_PER_DAY));
    const crew = Math.min(model.crewSeats, gig.crewNeeded);
    nights += away;
    travel += away * crew * (PER_DIEM + (model.kind === 'bus' ? 0 : HOTEL_NIGHT));
  });
  const freelance = projection.freelance.cost;
  const subhire = projection.subhire.cost;
  return { fuel: Math.round(fuel), travel: Math.round(travel), freelance, subhire, total: Math.round(fuel + travel + freelance + subhire), nights };
}
