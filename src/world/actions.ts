/**
 * Player commands. Each takes the current state and returns
 * `{ state, result }` — a new state on success, the untouched one on failure.
 */
import {
  CREW_HIRE_COST,
  DEPOT_BUILD_COST,
  GEAR_RESALE_RATE,
  LOAN_STEP,
  MAX_LOAN,
  companyTier,
  getModel,
  tierInfo,
} from './catalog';
import {
  book,
  cloneState,
  dayOf,
  depotInCity,
  gigById,
  newId,
  pushNews,
  sellValue,
  showEndHour,
} from './core';
import { getWorld } from './mapgen';
import { roadDistance } from './pathfinding';
import { serviceNow } from './sim';
import { makeVehicle } from './state';
import type { ActionOutcome, TycoonState } from './types';
import { getProduct } from './content/gear';

const fail = (state: TycoonState, message: string): ActionOutcome => ({ state, result: { ok: false, message } });
const ok = (state: TycoonState, message?: string): ActionOutcome => ({ state, result: { ok: true, message } });
const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

export function bookGig(state: TycoonState, gigId: string): ActionOutcome {
  const gig = gigById(state, gigId);
  if (!gig || gig.status !== 'offer') return fail(state, 'That offer is no longer available.');
  if (gig.acceptByDay < dayOf(state.hour)) return fail(state, 'The booking deadline has passed.');
  const needed = tierInfo(gig.tier);
  if (companyTier(state.company.reputation) < gig.tier) {
    return fail(state, `Promoters want reputation ${needed.minReputation}+ for ${needed.label} venues.`);
  }
  const s = cloneState(state);
  gigById(s, gigId)!.status = 'booked';
  return ok(s, `Booked ${gig.act}. Now assign vehicles to get the gear there.`);
}

export function assignVehicle(state: TycoonState, vehicleId: string, gigId: string): ActionOutcome {
  const v0 = state.vehicles.find(v => v.id === vehicleId && v.owner === 'player');
  const gig0 = gigById(state, gigId);
  if (!v0 || !gig0) return fail(state, 'Unknown vehicle or show.');
  if (gig0.status !== 'booked') return fail(state, 'Book the show first.');
  if (v0.orders.includes(gigId)) return fail(state, `${v0.name} is already on that job.`);
  if (state.hour >= showEndHour(gig0)) return fail(state, 'That show is already over.');
  const world = getWorld(state.mapSeed);
  if (!Number.isFinite(roadDistance(world, v0.homeCityId, gig0.cityId))) {
    return fail(state, 'There is no road from this vehicle’s depot to that venue.');
  }

  const s = cloneState(state);
  const v = s.vehicles.find(x => x.id === vehicleId)!;
  // The current leg (if already under way) stays first; the rest is kept in show order.
  const locked = v.status === 'driving' || v.status === 'broken' || v.status === 'on-site' ? v.orders.slice(0, 1) : [];
  const rest = [...v.orders.slice(locked.length), gigId].sort(
    (a, b) => (gigById(s, a)?.day ?? 0) - (gigById(s, b)?.day ?? 0),
  );
  v.orders = [...locked, ...rest];
  return ok(s, `${v.name} added to ${gig0.act}.`);
}

export function unassignVehicle(state: TycoonState, vehicleId: string, gigId: string): ActionOutcome {
  const v0 = state.vehicles.find(v => v.id === vehicleId && v.owner === 'player');
  if (!v0 || !v0.orders.includes(gigId)) return fail(state, 'Not assigned.');
  const s = cloneState(state);
  const v = s.vehicles.find(x => x.id === vehicleId)!;
  v.orders = v.orders.filter(id => id !== gigId);
  if (v.status === 'on-site' && v0.orders[0] === gigId) {
    v.status = 'parked';
    v.arrivedHour = undefined;
  }
  return ok(s);
}

export function sendHome(state: TycoonState, vehicleId: string): ActionOutcome {
  const s = cloneState(state);
  const v = s.vehicles.find(x => x.id === vehicleId && x.owner === 'player');
  if (!v) return fail(state, 'Unknown vehicle.');
  v.orders = [];
  if (v.status === 'on-site' || v.status === 'scheduled') v.status = 'parked';
  return ok(s, `${v.name} is heading home.`);
}

export function buyVehicle(state: TycoonState, depotId: string, modelId: string): ActionOutcome {
  const depot = state.depots.find(d => d.id === depotId);
  const model = getModel(modelId);
  if (!depot) return fail(state, 'Unknown depot.');
  if (!state.announcedModels.includes(modelId)) return fail(state, `${model.name} isn't on sale yet.`);
  if (state.company.cash < model.price) return fail(state, `Not enough cash — the ${model.name} costs ${money(model.price)}.`);
  const s = cloneState(state);
  const v = makeVehicle(s, modelId, depot.cityId);
  s.vehicles.push(v);
  book(s, 'purchases', -model.price);
  return ok(s, `Bought ${v.name} (${model.name}).`);
}

export function sellVehicle(state: TycoonState, vehicleId: string): ActionOutcome {
  const v0 = state.vehicles.find(v => v.id === vehicleId && v.owner === 'player');
  if (!v0) return fail(state, 'Unknown vehicle.');
  if (v0.cityId !== v0.homeCityId || !(v0.status === 'parked' || v0.status === 'scheduled')) {
    return fail(state, 'Vehicles can only be sold while parked at their depot.');
  }
  const s = cloneState(state);
  const value = sellValue(v0, s.hour);
  const depot = depotInCity(s, v0.homeCityId);
  if (depot) depot.crew += v0.crew;
  s.vehicles = s.vehicles.filter(v => v.id !== vehicleId);
  book(s, 'sales', value);
  return ok(s, `Sold ${v0.name} for ${money(value)}.`);
}

export function serviceVehicle(state: TycoonState, vehicleId: string): ActionOutcome {
  const v0 = state.vehicles.find(v => v.id === vehicleId && v.owner === 'player');
  if (!v0) return fail(state, 'Unknown vehicle.');
  if (v0.cityId !== v0.homeCityId || !(v0.status === 'parked' || v0.status === 'scheduled')) {
    return fail(state, 'Vehicles are serviced at their depot.');
  }
  const s = cloneState(state);
  serviceNow(s, s.vehicles.find(v => v.id === vehicleId)!);
  return ok(s, `${v0.name} is in the workshop.`);
}

export function rehomeVehicle(state: TycoonState, vehicleId: string, depotId: string): ActionOutcome {
  const depot = state.depots.find(d => d.id === depotId);
  const v0 = state.vehicles.find(v => v.id === vehicleId && v.owner === 'player');
  if (!depot || !v0) return fail(state, 'Unknown vehicle or depot.');
  if (v0.orders.length) return fail(state, 'Finish or clear its orders first.');
  if (v0.status !== 'parked' || v0.cityId !== v0.homeCityId) return fail(state, 'Vehicle must be parked at its depot.');
  const s = cloneState(state);
  const v = s.vehicles.find(x => x.id === vehicleId)!;
  v.homeCityId = depot.cityId;
  return ok(s, `${v.name} is relocating.`);
}

export function buyGear(state: TycoonState, depotId: string, productId: string, qty = 1): ActionOutcome {
  const product = getProduct(productId);
  if (!state.announcedGear.includes(productId)) return fail(state, `${product.brand} ${product.name} isn't out yet.`);
  const cost = product.price * qty;
  if (state.company.cash < cost) return fail(state, `Not enough cash (${money(cost)}).`);
  const s = cloneState(state);
  const depot = s.depots.find(d => d.id === depotId);
  if (!depot) return fail(state, 'Unknown depot.');
  depot.gear[productId] = (depot.gear[productId] ?? 0) + qty;
  book(s, 'purchases', -cost);
  return ok(s);
}

export function sellGear(state: TycoonState, depotId: string, productId: string, qty = 1): ActionOutcome {
  const s = cloneState(state);
  const depot = s.depots.find(d => d.id === depotId);
  if (!depot || (depot.gear[productId] ?? 0) < qty) return fail(state, 'Nothing in the warehouse to sell.');
  depot.gear[productId] -= qty;
  if (!depot.gear[productId]) delete depot.gear[productId];
  book(s, 'sales', Math.round(getProduct(productId).price * GEAR_RESALE_RATE * qty));
  return ok(s);
}

export function hireCrew(state: TycoonState, depotId: string, qty = 1): ActionOutcome {
  const cost = CREW_HIRE_COST * qty;
  if (state.company.cash < cost) return fail(state, 'Not enough cash to hire.');
  const s = cloneState(state);
  const depot = s.depots.find(d => d.id === depotId);
  if (!depot) return fail(state, 'Unknown depot.');
  depot.crew += qty;
  book(s, 'wages', -cost);
  return ok(s);
}

export function fireCrew(state: TycoonState, depotId: string, qty = 1): ActionOutcome {
  const s = cloneState(state);
  const depot = s.depots.find(d => d.id === depotId);
  if (!depot || depot.crew < qty) return fail(state, 'No idle crew at this depot.');
  depot.crew -= qty;
  return ok(s);
}

export function buildDepot(state: TycoonState, cityId: string): ActionOutcome {
  const world = getWorld(state.mapSeed);
  const city = world.cityById.get(cityId);
  if (!city) return fail(state, 'Unknown city.');
  if (depotInCity(state, cityId)) return fail(state, `You already have a warehouse in ${city.name}.`);
  const rival = state.rivals.find(r => r.hqCityId === cityId);
  if (rival) return fail(state, `${rival.name} owns the only warehouse lot in ${city.name}.`);
  if (state.company.cash < DEPOT_BUILD_COST) return fail(state, `A warehouse costs ${money(DEPOT_BUILD_COST)}.`);
  const s = cloneState(state);
  s.depots.push({
    id: newId(s, 'depot'),
    cityId,
    gear: {},
    crew: 0,
    builtHour: s.hour,
  });
  book(s, 'property', -DEPOT_BUILD_COST);
  pushNews(s, `${s.company.name} opens a warehouse in ${city.name}.`, 'good', { cityId });
  return ok(s, `Warehouse built in ${city.name}.`);
}

export function borrow(state: TycoonState): ActionOutcome {
  if (state.company.loan + LOAN_STEP > MAX_LOAN) return fail(state, `The bank won't lend more than ${money(MAX_LOAN)}.`);
  const s = cloneState(state);
  s.company.loan += LOAN_STEP;
  s.company.cash += LOAN_STEP;
  return ok(s);
}

export function repay(state: TycoonState): ActionOutcome {
  if (state.company.loan <= 0) return fail(state, 'No loan to repay.');
  const amount = Math.min(LOAN_STEP, state.company.loan);
  if (state.company.cash < amount) return fail(state, 'Not enough cash.');
  const s = cloneState(state);
  s.company.loan -= amount;
  s.company.cash -= amount;
  return ok(s);
}
