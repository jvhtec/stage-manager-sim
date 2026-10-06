/** Read-only projections for the UI — nothing here mutates state. */
import { GEAR_PRICES, GEAR_RESALE_RATE, getModel } from './catalog';
import {
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
import { getWorld } from './mapgen';
import { roadDistance } from './pathfinding';
import { DEPTS, type DeptCounts, type Gig, type TycoonState, type Vehicle } from './types';

export function vehicleActivity(state: TycoonState, v: Vehicle): string {
  const world = getWorld(state.mapSeed);
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
  const world = getWorld(state.mapSeed);
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
  const loaded = v.cargo.audio + v.cargo.lighting + v.cargo.video + v.cargo.stage + v.crew > 0;
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
}

/** What would turn up at `gig` if things go to plan — mirrors the sim's greedy loading. */
export function projectCoverage(state: TycoonState, gig: Gig): CoverageProjection {
  const vehicles = state.vehicles.filter(v => v.owner === 'player' && v.orders.includes(gig.id));
  const stock = new Map(state.depots.map(d => [d.cityId, { gear: { ...d.gear }, crew: d.crew }]));
  const gear = emptyCounts();
  let crew = 0;
  let latestArrival = 0;

  // Already-loaded vehicles first (that's what the sim nets out), then the rest.
  const ordered = [...vehicles].sort((a, b) => Number(sumOf(b.cargo) + b.crew > 0) - Number(sumOf(a.cargo) + a.crew > 0));
  ordered.forEach(v => {
    latestArrival = Math.max(latestArrival, estimateArrival(state, v, gig));
    const loaded = sumOf(v.cargo) + v.crew > 0;
    if (loaded) {
      DEPTS.forEach(d => (gear[d] += v.cargo[d]));
      crew += v.crew;
      return;
    }
    const model = getModel(v.modelId);
    const depot = stock.get(v.homeCityId);
    if (!depot) return;
    let space = model.gearCapacity;
    while (space > 0) {
      const dept = [...DEPTS]
        .filter(d => gig.needs[d] - gear[d] > 0 && depot.gear[d] > 0)
        .sort((a, b) => gig.needs[b] - gear[b] - (gig.needs[a] - gear[a]))[0];
      if (!dept) break;
      gear[dept] += 1;
      depot.gear[dept] -= 1;
      space -= 1;
    }
    const seats = Math.min(model.crewSeats, Math.max(0, gig.crewNeeded - crew), depot.crew);
    crew += seats;
    depot.crew -= seats;
  });

  return { gear, crew, latestArrival, onTime: !vehicles.length || latestArrival <= loadInHour(gig), vehicles };
}

const sumOf = (c: DeptCounts) => c.audio + c.lighting + c.video + c.stage;

export function companyValue(state: TycoonState): number {
  const fleet = state.vehicles.filter(v => v.owner === 'player').reduce((sum, v) => sum + sellValue(v, state.hour), 0);
  const gear = state.depots.reduce(
    (sum, d) => sum + DEPTS.reduce((s2, dept) => s2 + d.gear[dept] * GEAR_PRICES[dept] * GEAR_RESALE_RATE, 0),
    0,
  );
  const inTransit = state.vehicles
    .filter(v => v.owner === 'player')
    .reduce((sum, v) => sum + DEPTS.reduce((s2, dept) => s2 + v.cargo[dept] * GEAR_PRICES[dept] * GEAR_RESALE_RATE, 0), 0);
  return Math.round(state.company.cash - state.company.loan + fleet + gear + inTransit + state.depots.length * 20000);
}

export function homeDepot(state: TycoonState, v: Vehicle) {
  return depotInCity(state, v.homeCityId);
}
