/**
 * Player commands. Each takes the current state and returns
 * `{ state, result }` — a new state on success, the untouched one on failure.
 */
import { dispatchFreight, freightLabel, freightQuote, type FreightMode } from './freight';
import { gateBlocker, hypeLabel, rollGate } from './gate';
import { retrofitBlocker, retrofitCost, vehicleClass } from './regulation';
import { openRun, planRun } from './runs';
import { haggle, haggleBlocker } from './negotiate';
import { PARTNER_DISCOUNT, PARTNER_SHARE, endPartner, partnerBlocker, partnerPrice, signPartner } from './partners';
import { lotBlocker, lotName, takeLot } from './auctions';
import { resolveDilemma } from './dilemmas';
import {
  CREW_HIRE_COST,
  STAFF_HIRE_COST,
  DEPT_LABELS,
  getModel,
  tierInfo,
} from './catalog';
import {
  book,
  cloneState,
  dayOf,
  depotInCity,
  formatDay,
  freeLot,
  formatMoney,
  gigById,
  loadInHour,
  newId,
  pushNews,
  sellValue,
  yearOf,
  showEndHour,
  withRng,
} from './core';
import { worldOf } from './mapgen';
import { roadDistance } from './pathfinding';
import { serviceNow } from './sim';
import { makeVehicle } from './state';
import { tourMaxTier } from './tours';
import { gigBookingBar, tourBookingBar } from './standing';
import { getTech, techsActiveIn } from './content/techs';
import { BID_LEVELS } from './events';
import { borrowStep, creditLimit, leaseMonthly, leaseReturnPenalty } from './finance';
import { absorbRival, takeoverBlocker } from './rivals';
import { bookTransfer, canReceive, describeQuote, transferQuote } from './transfers';
import { AMBITIONS, rndBlocker, startProject } from './rnd';
import { DEAL_YEARS } from './deals';
import { headhuntBlocker, headhuntFee, headhuntRivalHealthAfter, headhuntTarget, HEADHUNT_REP_COST } from './headhunt';
import { festBlocker, planFestival } from './ownfest';
import { courseBlocker, startCourse } from './certs';
import { merchBlocker, orderMerch } from './merch';
import { FUEL_LOCK_MONTHS, FUEL_LOCK_PREMIUM, fuelLockBlocker, marketNow } from './market';
import { MODULES, buildModule, moduleBlocker, rehearsalBlocker, rehearse } from './annexes';
import { HEAT_HEADHUNT, addHeat, hireInvestigator, investigatorBlocker } from './rivalry';
import { buyBlocker, buyVenue, ownedOf, sellVenue } from './owned';
import { IPO_FLOAT, buybackCost, ipoProceeds, listingBlocker, tradingTotal } from './shares';
import { DEPTS, type ActionOutcome, type MerchLevel, type CertId, type ModuleId, type VenueProgramme, type DividendLevel, type FestHeadliner, type FestTicket, type FestTier, type BidLevel, type Dept, type RndAmbition, type Vehicle, type FacilityKind, type Policies, type StaffRole, type TycoonState } from './types';
import { STAFF, canBaseVehicle, facilitySpec, nextUpgrade } from './facilities';
import { aboard, hireFee, levelOf, makePerson, moveToDepot, roleOf, settlePoachBid, syncCrew, unpinFrom } from './people';
import { BREAK_MONTHS, contractShortfall, installKit } from './contracts';
import { addStock } from './loading';
import { onBought, ownedStock, refurbishCost, resaleValue } from './wear';
import { getProduct } from './content/gear';

const fail = (state: TycoonState, message: string): ActionOutcome => ({ state, result: { ok: false, message } });
const ok = (state: TycoonState, message?: string): ActionOutcome => ({ state, result: { ok: true, message } });

export function bookTour(state: TycoonState, tourId: string): ActionOutcome {
  const tour = state.tours.find(t => t.id === tourId);
  if (!tour || tour.status !== 'offer') return fail(state, 'That tour is no longer on offer.');
  if (tour.acceptByDay < dayOf(state.hour)) return fail(state, 'The booking deadline has passed.');
  const { reason } = tourBookingBar(state, tour, tourMaxTier(state, tour));
  if (reason) return fail(state, reason);
  const s = cloneState(state);
  const t = s.tours.find(x => x.id === tourId)!;
  t.status = 'booked';
  t.gigIds.forEach(id => {
    const g = gigById(s, id);
    if (g) g.status = 'booked';
  });
  return ok(s, `Booked ${tour.name}! Assign vehicles to the dates — or the whole tour at once.`);
}

/** Puts one vehicle on every date of a booked tour (in order), skipping dates it's already on. */
export function assignVehicleToTour(state: TycoonState, vehicleId: string, tourId: string): ActionOutcome {
  const tour = state.tours.find(t => t.id === tourId);
  if (!tour || tour.status !== 'booked') return fail(state, 'Book the tour first.');
  let s = state;
  let added = 0;
  tour.gigIds.forEach(id => {
    const g = gigById(s, id);
    const v = s.vehicles.find(x => x.id === vehicleId);
    if (!g || !v || v.orders.includes(id) || g.status !== 'booked' || s.hour >= showEndHour(g)) return;
    const out = assignVehicle(s, vehicleId, id);
    if (out.result.ok) {
      s = out.state;
      added += 1;
    }
  });
  if (!added) return fail(state, 'Nothing left on this tour to assign.');
  const v = s.vehicles.find(x => x.id === vehicleId)!;
  return ok(s, `${v.name} is on ${added} date${added > 1 ? 's' : ''} of ${tour.name}.`);
}

export function bookGig(state: TycoonState, gigId: string): ActionOutcome {
  const gig = gigById(state, gigId);
  if (gig?.tourId) return bookTour(state, gig.tourId);
  if (!gig || gig.status !== 'offer') return fail(state, 'That offer is no longer available.');
  if (gig.acceptByDay < dayOf(state.hour)) return fail(state, 'The booking deadline has passed.');
  if (gig.event && !gig.event.citywide) return fail(state, 'Special events are won by sealed bid — choose your price.');
  const { reason } = gigBookingBar(state, gig);
  if (reason) return fail(state, reason);
  const s = cloneState(state);
  gigById(s, gigId)!.status = 'booked';
  return ok(s, `Booked ${gig.act}. Now assign vehicles to get the gear there.`);
}

/** Name exactly who works a booked show (at most as many as it needs). */
export function setCrewPicks(state: TycoonState, gigId: string, personIds: string[]): ActionOutcome {
  const gig0 = gigById(state, gigId);
  if (!gig0 || gig0.status !== 'booked') return fail(state, 'Book the show first.');
  const unique = [...new Set(personIds)];
  if (unique.some(id => !state.people.some(m => m.id === id))) return fail(state, 'Unknown crew member.');
  if (unique.length > gig0.crewNeeded) return fail(state, `This show only needs ${gig0.crewNeeded} crew.`);
  const s = cloneState(state);
  const gig = gigById(s, gigId)!;
  gig.crewPicks = unique.length ? unique : undefined;
  return ok(s, unique.length ? `${unique.length} named for ${gig.act}.` : `Crew for ${gig.act} back to automatic.`);
}

/** Book a whole planned run onto one truck: all of it, or none. */
export function bookRun(state: TycoonState, vehicleId: string, gigIds: string[]): ActionOutcome {
  const v = state.vehicles.find(x => x.id === vehicleId && x.owner === 'player');
  if (!v) return fail(state, 'Unknown vehicle.');
  if (!gigIds.length) return fail(state, 'Pick some shows first.');
  const plan = planRun(state, v, gigIds);
  const bad = plan.stops.find(s => s.blocker || s.spare < 0);
  if (bad) return fail(state, bad.blocker ?? `${v.name} can't make ${bad.gig.act} in time.`);
  let s = state;
  for (const g of plan.stops) {
    const booked = bookGig(s, g.gig.id);
    if (!booked.result.ok) return fail(state, booked.result.message ?? 'A booking failed.');
    const assigned = assignVehicle(booked.state, vehicleId, g.gig.id);
    if (!assigned.result.ok) return fail(state, assigned.result.message ?? 'The truck can’t take it.');
    s = assigned.state;
  }
  s = cloneState(s);
  openRun(s, vehicleId, plan.stops.map(x => x.gig.id));
  const bonus = plan.bonusRate ? ` Deliver all of it well for a ${Math.round(plan.bonusRate * 100)}% run bonus.` : '';
  return ok(s, `${v.name} booked on ${plan.stops.length} date${plan.stops.length > 1 ? 's' : ''}.${bonus}`);
}

/** Fit a filter to an older truck: one emission class up, at its depot. */
export function retrofitVehicle(state: TycoonState, vehicleId: string): ActionOutcome {
  const v0 = state.vehicles.find(v => v.id === vehicleId && v.owner === 'player');
  if (!v0) return fail(state, 'Unknown vehicle.');
  const blocker = retrofitBlocker(state, v0);
  if (blocker) return fail(state, blocker);
  const s = cloneState(state);
  const v = s.vehicles.find(x => x.id === vehicleId)!;
  const cost = retrofitCost(v);
  v.retrofit = (v.retrofit ?? 0) + 1;
  book(s, 'servicing', -cost);
  v.profitThisYear -= cost;
  serviceNow(s, v);
  return ok(s, `${v.name} fitted with a filter: emission class ${vehicleClass(v, s)}.`);
}

/** Book a single show on a share of the gate rather than a flat fee. */
export function bookGate(state: TycoonState, gigId: string): ActionOutcome {
  const gig0 = gigById(state, gigId);
  if (!gig0) return fail(state, 'That offer is no longer available.');
  const blocker = gateBlocker(gig0);
  if (blocker) return fail(state, blocker);
  const booked = bookGig(state, gigId);
  if (!booked.result.ok) return booked;
  const s = cloneState(booked.state);
  const gig = gigById(s, gigId)!;
  const { hype, forecast } = withRng(s, rng => rollGate(s, gig, rng));
  gig.gate = { hype, forecast };
  return ok(s, `Booked ${gig.act} on a share of the gate. Ticket sales are forecast as ${hypeLabel(forecast)}.`);
}

/** One tap: book the offer and put this truck on it. */
export function bookAndAssign(state: TycoonState, vehicleId: string, gigId: string): ActionOutcome {
  const booked = bookGig(state, gigId);
  if (!booked.result.ok) return booked;
  const assigned = assignVehicle(booked.state, vehicleId, gigId);
  // If the truck can't take it after all, leave everything as it was.
  if (!assigned.result.ok) return fail(state, assigned.result.message ?? 'That truck can’t take the job.');
  return ok(assigned.state, `Booked and assigned: ${gigById(state, gigId)?.act}.`);
}

export function assignVehicle(state: TycoonState, vehicleId: string, gigId: string): ActionOutcome {
  const v0 = state.vehicles.find(v => v.id === vehicleId && v.owner === 'player');
  const gig0 = gigById(state, gigId);
  if (!v0 || !gig0) return fail(state, 'Unknown vehicle or show.');
  if (gig0.status !== 'booked') return fail(state, 'Book the show first.');
  if (v0.orders.includes(gigId)) return fail(state, `${v0.name} is already on that job.`);
  if (state.hour >= showEndHour(gig0)) return fail(state, 'That show is already over.');
  const world = worldOf(state);
  if (!Number.isFinite(roadDistance(world, v0.homeCityId, gig0.cityId))) {
    return fail(state, 'There is no road from this vehicle’s depot to that venue.');
  }

  const s = cloneState(state);
  const v = s.vehicles.find(x => x.id === vehicleId)!;
  // The current leg (if already under way) stays first; the rest is kept in show order.
  const locked = v.status === 'driving' || v.status === 'broken' || v.status === 'on-site' ? v.orders.slice(0, 1) : [];
  const loadIn = (id: string) => {
    const g = gigById(s, id);
    return g ? loadInHour(g) : 0;
  };
  const rest = [...v.orders.slice(locked.length), gigId].sort((a, b) => loadIn(a) - loadIn(b));
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
  if (!canBaseVehicle(depot, model.kind)) return fail(state, `A delegation has no loading dock — vans and crew buses only. Upgrade to a warehouse for trucks.`);
  if (state.company.cash < model.price) return fail(state, `Not enough cash — the ${model.name} costs ${formatMoney(state, model.price)}.`);
  const s = cloneState(state);
  const v = makeVehicle(s, modelId, depot.cityId);
  s.vehicles.push(v);
  book(s, 'purchases', -model.price);
  return ok(s, `Bought ${v.name} (${model.name}).`);
}

/** Lease a vehicle: no capital up front, a monthly bill instead. */
export function leaseVehicle(state: TycoonState, depotId: string, modelId: string): ActionOutcome {
  const depot = state.depots.find(d => d.id === depotId);
  const model = getModel(modelId);
  if (!depot) return fail(state, 'Unknown depot.');
  if (!state.announcedModels.includes(modelId)) return fail(state, `${model.name} isn't available yet.`);
  if (!canBaseVehicle(depot, model.kind)) return fail(state, 'A delegation can only base vans and crew buses.');
  const monthly = leaseMonthly(modelId);
  if (state.company.cash < monthly) return fail(state, `The first month's lease is ${formatMoney(state, monthly)}.`);
  const s = cloneState(state);
  const v = makeVehicle(s, modelId, depot.cityId);
  v.lease = { monthly, sinceHour: s.hour };
  s.vehicles.push(v);
  book(s, 'leasing', -monthly);
  return ok(s, `Leased ${v.name} (${model.name}) at ${formatMoney(s, monthly)}/month.`);
}

export function sellVehicle(state: TycoonState, vehicleId: string): ActionOutcome {
  const v0 = state.vehicles.find(v => v.id === vehicleId && v.owner === 'player');
  if (!v0) return fail(state, 'Unknown vehicle.');
  if (v0.lease) return returnLeased(state, v0);
  if (v0.cityId !== v0.homeCityId || !(v0.status === 'parked' || v0.status === 'scheduled')) {
    return fail(state, 'Vehicles can only be sold while parked at their depot.');
  }
  const s = cloneState(state);
  const value = sellValue(v0, s.hour);
  const depot = depotInCity(s, v0.homeCityId);
  if (depot) aboard(s, v0.id).forEach(m => moveToDepot(m, depot.id));
  unpinFrom(s, v0.id);
  s.vehicles = s.vehicles.filter(v => v.id !== vehicleId);
  syncCrew(s);
  s.techs = s.techs.map(t => (t.vehicleId === vehicleId ? { techId: t.techId } : t));
  book(s, 'sales', value);
  return ok(s, `Sold ${v0.name} for ${formatMoney(state, value)}.`);
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

/** Send a booked show's kit from one of your bases by rail or air instead of a truck. */
export function sendFreight(state: TycoonState, gigId: string, depotId: string, mode: FreightMode): ActionOutcome {
  const g0 = state.gigs.find(g => g.id === gigId);
  const d0 = state.depots.find(d => d.id === depotId);
  if (!g0 || g0.status !== 'booked') return fail(state, 'Book the show first.');
  if (!d0) return fail(state, 'Unknown base.');
  if (g0.freight) return fail(state, 'The kit is already on its way by freight.');
  const q = freightQuote(state, g0, d0, mode);
  if (!q.ok) return fail(state, q.reason ?? 'Not possible.');
  if (state.company.cash < q.cost) return fail(state, 'Not enough cash for the freight.');
  const s = cloneState(state);
  dispatchFreight(s, s.gigs.find(g => g.id === gigId)!, s.depots.find(d => d.id === depotId)!, mode);
  return ok(s, `Sent by ${freightLabel(mode)}.`);
}

/** Put a second driver in the cab (or take them off): quicker long hauls for a driver's pay while rolling. */
export function setTeamDrivers(state: TycoonState, vehicleId: string, on: boolean): ActionOutcome {
  const v0 = state.vehicles.find(v => v.id === vehicleId && v.owner === 'player');
  if (!v0) return fail(state, 'Unknown vehicle.');
  if (on && getModel(v0.modelId).kind === 'van') return fail(state, 'A van has no sleeper cab — team drivers need a truck, artic or bus.');
  const s = cloneState(state);
  s.vehicles.find(v => v.id === vehicleId)!.teamDrivers = on || undefined;
  return ok(s, on ? `${v0.name} now runs with two drivers taking turns.` : `${v0.name} is back to one driver.`);
}

export function rehomeVehicle(state: TycoonState, vehicleId: string, depotId: string): ActionOutcome {
  const depot = state.depots.find(d => d.id === depotId);
  const v0 = state.vehicles.find(v => v.id === vehicleId && v.owner === 'player');
  if (!depot || !v0) return fail(state, 'Unknown vehicle or depot.');
  if (v0.orders.length) return fail(state, 'Finish or clear its orders first.');
  if (!canBaseVehicle(depot, getModel(v0.modelId).kind)) return fail(state, 'A delegation can only base vans and crew buses.');
  if (v0.status !== 'parked' || v0.cityId !== v0.homeCityId) return fail(state, 'Vehicle must be parked at its depot.');
  const s = cloneState(state);
  const v = s.vehicles.find(x => x.id === vehicleId)!;
  v.homeCityId = depot.cityId;
  return ok(s, `${v.name} is relocating.`);
}

export function buyGear(state: TycoonState, depotId: string, productId: string, qty = 1): ActionOutcome {
  const product = getProduct(productId);
  if (!state.announcedGear.includes(productId) && !state.ownProducts.includes(productId)) return fail(state, `${product.brand} ${product.name} isn't out yet.`);
  const cost = partnerPrice(state, productId) * qty;
  if (state.company.cash < cost) return fail(state, `Not enough cash (${formatMoney(state, cost)}).`);
  const d0 = state.depots.find(d => d.id === depotId);
  if (!d0) return fail(state, 'Unknown depot.');
  const spec = facilitySpec(d0);
  if (!canReceive(state, d0, qty)) return fail(state, `The ${spec.label.toLowerCase()} is full (${spec.capacity} units). Sell some kit, or upgrade.`);
  const s = cloneState(state);
  const depot = s.depots.find(d => d.id === depotId)!;
  depot.gear[productId] = (depot.gear[productId] ?? 0) + qty;
  onBought(s, productId, qty);
  book(s, 'purchases', -cost);
  return ok(s, `Bought ${qty > 1 ? `${qty} × ` : ''}${product.brand} ${product.name} for ${formatMoney(s, cost)}.`);
}

export function sellGear(state: TycoonState, depotId: string, productId: string, qty = 1): ActionOutcome {
  const s = cloneState(state);
  const depot = s.depots.find(d => d.id === depotId);
  if (!depot || (depot.gear[productId] ?? 0) < qty) return fail(state, 'Nothing in the warehouse to sell.');
  depot.gear[productId] -= qty;
  if (!depot.gear[productId]) delete depot.gear[productId];
  book(s, 'sales', resaleValue(state, productId) * qty);
  if (!ownedStock(s)[productId]) delete s.gearCondition[productId];
  return ok(s, `Sold ${qty > 1 ? `${qty} × ` : ''}${getProduct(productId).brand} ${getProduct(productId).name} for ${formatMoney(s, resaleValue(state, productId) * qty)}.`);
}

/** Restores a whole product line to as-new condition. */
export function refurbishGear(state: TycoonState, productId: string): ActionOutcome {
  const cost = refurbishCost(state, productId);
  if (cost <= 0) return fail(state, 'That kit is already in perfect condition.');
  if (state.company.cash < cost) return fail(state, `Refurbishing costs ${formatMoney(state, cost)} — not enough cash.`);
  const s = cloneState(state);
  s.gearCondition[productId] = 100;
  book(s, 'workshop', -cost);
  const p = getProduct(productId);
  return ok(s, `Every ${p.brand} ${p.name} is back to as-new (${formatMoney(state, cost)}).`);
}

export function setPolicy<K extends keyof Policies>(state: TycoonState, key: K, value: Policies[K]): ActionOutcome {
  const s = cloneState(state);
  s.policies[key] = value;
  return ok(s);
}

/** Take on green (1★) techs straight off the street — quick and cheap. */
export function hireCrew(state: TycoonState, depotId: string, qty = 1): ActionOutcome {
  const cost = CREW_HIRE_COST * qty;
  if (state.company.cash < cost) return fail(state, 'Not enough cash to hire.');
  const s = cloneState(state);
  const depot = s.depots.find(d => d.id === depotId);
  if (!depot) return fail(state, 'Unknown depot.');
  withRng(s, rng => {
    for (let i = 0; i < qty; i++) {
      const m = makePerson(s, rng, 1);
      m.depotId = depot.id;
      s.people.push(m);
    }
  });
  syncCrew(s);
  book(s, 'wages', -cost);
  return ok(s, qty === 1 ? `${s.people[s.people.length - 1].name} joins the crew.` : `${qty} new techs join the crew.`);
}

/** Hire someone from this month's hiring market. */
export function hireCandidate(state: TycoonState, candidateId: string): ActionOutcome {
  const c = state.candidates.find(x => x.id === candidateId);
  if (!c) return fail(state, 'They’ve taken another job.');
  const fee = hireFee(c);
  if (state.company.cash < fee) return fail(state, `Signing ${c.name} costs ${formatMoney(state, fee)}.`);
  const s = cloneState(state);
  const m = s.candidates.find(x => x.id === candidateId)!;
  s.candidates = s.candidates.filter(x => x.id !== candidateId);
  m.hiredHour = s.hour;
  s.people.push(m);
  syncCrew(s);
  book(s, 'wages', -fee);
  return ok(s, `${m.name} (${levelOf(m)}★ ${roleOf(m)}) joins the crew.`);
}

/** Let someone go (only between jobs, at base). Defaults to your least experienced. */
export function fireCrew(state: TycoonState, depotId: string, qty = 1): ActionOutcome {
  const atBase = state.people.filter(m => m.depotId === depotId).sort((a, b) => levelOf(a) - levelOf(b) || a.hiredHour - b.hiredHour);
  if (atBase.length < qty) return fail(state, 'Nobody idle at this base.');
  return fireMember(state, atBase.slice(0, qty).map(m => m.id));
}

export function fireMember(state: TycoonState, ids: string | string[]): ActionOutcome {
  const list = Array.isArray(ids) ? ids : [ids];
  const leaving = state.people.filter(m => list.includes(m.id));
  if (!leaving.length) return fail(state, 'Nobody to let go.');
  if (leaving.some(m => !m.depotId)) return fail(state, 'They’re out on a job — let them go when they’re back at base.');
  const s = cloneState(state);
  s.people = s.people.filter(m => !list.includes(m.id));
  s.poachBids = s.poachBids.filter(b => !list.includes(b.personId));
  syncCrew(s);
  return ok(s, leaving.length === 1 ? `${leaving[0].name} has left the company.` : `${leaving.length} crew let go.`);
}

/** Pin someone to a truck (they always ride it from its base), or unpin them with `vehicleId` undefined. */
export function pinCrew(state: TycoonState, personId: string, vehicleId?: string): ActionOutcome {
  const m0 = state.people.find(m => m.id === personId);
  if (!m0) return fail(state, 'Unknown crew member.');
  const v = vehicleId ? state.vehicles.find(x => x.id === vehicleId && x.owner === 'player') : undefined;
  if (vehicleId && !v) return fail(state, 'Unknown vehicle.');
  const s = cloneState(state);
  s.people.find(m => m.id === personId)!.pinnedVehicleId = vehicleId;
  return ok(s, v ? `${m0.name} now rides ${v.name}.` : `${m0.name} goes wherever they’re needed.`);
}

/** Push an offer for a better fee — once. The promoter may fold, dig in, or walk. */
export function haggleGig(state: TycoonState, gigId: string): ActionOutcome {
  const gig0 = gigById(state, gigId);
  if (!gig0) return fail(state, 'That offer is no longer available.');
  const blocker = haggleBlocker(state, gig0);
  if (blocker) return fail(state, blocker);
  const s = cloneState(state);
  const gig = gigById(s, gigId)!;
  const fee0 = gig.fee;
  const result = withRng(s, rng => haggle(s, gig, rng));
  if (result === 'won') return ok(s, `${gig.act}'s promoter gives way: ${formatMoney(state, fee0)} → ${formatMoney(state, gig.fee)}.`);
  if (result === 'walked') return { state: s, result: { ok: false, message: `${gig.act}'s promoter walks away and books someone else.` } };
  return { state: s, result: { ok: false, message: `${gig.act}'s promoter won't budge — the fee stands at ${formatMoney(state, gig.fee)}.` } };
}

/** Sign, switch or (with no brand) end a manufacturer partnership for a department. */
export function setPartner(state: TycoonState, dept: Dept, brand?: string): ActionOutcome {
  if (!brand) {
    const current = state.partners[dept];
    if (!current) return fail(state, 'No partnership to end.');
    const s = cloneState(state);
    endPartner(s, dept);
    return ok(s, `Ended the ${current.brand} partnership.`);
  }
  const blocker = partnerBlocker(state, dept, brand);
  if (blocker) return fail(state, blocker);
  const s = cloneState(state);
  signPartner(s, dept, brand);
  return ok(s, `${brand} are now your ${dept} partner: ${Math.round(PARTNER_DISCOUNT * 100)}% off their kit, sponsorship while ${Math.round(PARTNER_SHARE * 100)}%+ of your racks wear their name.`);
}

/** Buy a lot at today's asking price, sent to one of your bases. */
export function bidAuction(state: TycoonState, auctionId: string, lotId: string, depotId: string): ActionOutcome {
  const a0 = state.auctions.find(a => a.id === auctionId);
  const lot0 = a0?.lots.find(l => l.id === lotId);
  if (!a0 || !lot0) return fail(state, 'Someone else got there first.');
  const blocker = lotBlocker(state, a0, lot0, depotId);
  if (blocker) return fail(state, blocker);
  const s = cloneState(state);
  const a = s.auctions.find(x => x.id === auctionId)!;
  const price = takeLot(s, a, a.lots.find(l => l.id === lotId)!, depotId);
  book(s, 'purchases', -price);
  return ok(s, `Bought ${lotName(lot0)} for ${formatMoney(state, price)}.`);
}

/** Make the call on a problem (dilemmas.ts). */
export function makeDecision(state: TycoonState, dilemmaId: string, optionId: string): ActionOutcome {
  const d = state.dilemmas.find(x => x.id === dilemmaId);
  if (!d) return fail(state, 'That’s already been dealt with.');
  const option = d.options.find(o => o.id === optionId);
  if (!option) return fail(state, 'Unknown choice.');
  if (option.cost && state.company.cash < option.cost) return fail(state, 'Not enough cash.');
  const s = cloneState(state);
  return ok(s, resolveDilemma(s, dilemmaId, optionId) ?? undefined);
}

/** Answer a rival's offer to one of your people: match it, or let them go. */
export function answerPoach(state: TycoonState, bidId: string, keep: boolean): ActionOutcome {
  if (!state.poachBids.some(b => b.id === bidId)) return fail(state, 'That offer is gone.');
  const s = cloneState(state);
  const msg = settlePoachBid(s, bidId, keep);
  syncCrew(s);
  return ok(s, msg ?? undefined);
}

/** Open a delegation (branch office) or build a small warehouse in a town. */
export function buildDepot(state: TycoonState, cityId: string, kind: FacilityKind = 'warehouse'): ActionOutcome {
  const world = worldOf(state);
  const city = world.cityById.get(cityId);
  if (!city) return fail(state, 'Unknown city.');
  if (depotInCity(state, cityId)) return fail(state, `You already have a base in ${city.name}.`);
  const lot = freeLot(state, world, cityId);
  if (lot < 0) return fail(state, `Every lot in ${city.name} is taken.`);
  const spec = facilitySpec({ kind, size: 1 });
  if (state.company.cash < spec.build) return fail(state, `A ${spec.label.toLowerCase()} costs ${formatMoney(state, spec.build)}.`);
  const s = cloneState(state);
  s.depots.push({
    id: newId(s, 'depot'),
    kind,
    size: 1,
    staff: { warehouse: 0, office: kind === 'delegation' ? 1 : 0 },
    cityId,
    lot,
    gear: {},
    crew: 0,
    builtHour: s.hour,
  });
  book(s, 'property', -spec.build);
  pushNews(s, `${s.company.name} opens a ${spec.label.toLowerCase()} in ${city.name}.`, 'good', { cityId });
  return ok(s, `${spec.label} opened in ${city.name}.`);
}

/** Delegation → small warehouse → medium → large. */
export function upgradeDepot(state: TycoonState, depotId: string): ActionOutcome {
  const d0 = state.depots.find(d => d.id === depotId);
  if (!d0) return fail(state, 'Unknown base.');
  const next = nextUpgrade(d0);
  if (!next) return fail(state, 'This is already as big as it gets.');
  if (state.company.reputation < next.spec.minReputation) return fail(state, `A ${next.spec.label.toLowerCase()} needs reputation ${next.spec.minReputation}+.`);
  if (state.company.cash < next.cost) return fail(state, `Upgrading costs ${formatMoney(state, next.cost)}.`);
  const s = cloneState(state);
  const d = s.depots.find(x => x.id === depotId)!;
  d.kind = next.kind;
  d.size = next.size;
  book(s, 'property', -next.cost);
  const city = worldOf(s).cityById.get(d.cityId)?.name;
  pushNews(s, `${s.company.name}'s ${city} base is now a ${next.spec.label.toLowerCase()}.`, 'good', { cityId: d.cityId });
  return ok(s, `Upgraded to a ${next.spec.label.toLowerCase()}.`);
}

/** Hire or let go one full-time staff member (letting go costs a month's salary). */
export function hireStaff(state: TycoonState, depotId: string, role: StaffRole): ActionOutcome {
  const d0 = state.depots.find(d => d.id === depotId);
  if (!d0) return fail(state, 'Unknown base.');
  const max = facilitySpec(d0).maxStaff[role];
  if (d0.staff[role] >= max) return fail(state, `This ${facilitySpec(d0).label.toLowerCase()} has room for ${max} ${STAFF[role].label.toLowerCase()} staff.`);
  if (state.company.cash < STAFF_HIRE_COST) return fail(state, 'Not enough cash to recruit.');
  const s = cloneState(state);
  s.depots.find(d => d.id === depotId)!.staff[role] += 1;
  book(s, 'salaries', -STAFF_HIRE_COST);
  return ok(s);
}

export function fireStaff(state: TycoonState, depotId: string, role: StaffRole): ActionOutcome {
  const d0 = state.depots.find(d => d.id === depotId);
  if (!d0 || d0.staff[role] <= 0) return fail(state, 'Nobody in that role here.');
  const s = cloneState(state);
  s.depots.find(d => d.id === depotId)!.staff[role] -= 1;
  book(s, 'salaries', -STAFF[role].salary);
  return ok(s, `Let go with a month's pay (${formatMoney(s, STAFF[role].salary)}).`);
}

/** Float a slice of the company on the stock market. */
export function goPublic(state: TycoonState): ActionOutcome {
  const why = listingBlocker(state);
  if (why) return fail(state, why);
  const s = cloneState(state);
  const raised = ipoProceeds(s);
  book(s, 'equity', raised);
  s.listing = { day: dayOf(s.hour), float: IPO_FLOAT, confidence: 60, dividend: 'modest', mark: tradingTotal(s), weakMonths: 0, raised, paid: 0 };
  pushNews(s, `${s.company.name} floats on the stock exchange, raising ${formatMoney(s, raised)}. Shareholders will expect results.`, 'big');
  return ok(s, `Listed — ${formatMoney(s, raised)} raised.`);
}

export function setDividend(state: TycoonState, level: DividendLevel): ActionOutcome {
  if (!state.listing) return fail(state, 'You are not listed.');
  const s = cloneState(state);
  s.listing!.dividend = level;
  return ok(s);
}

/** Buy the public out and go private again — at a premium. */
export function takePrivate(state: TycoonState): ActionOutcome {
  if (!state.listing) return fail(state, 'You are not listed.');
  const cost = buybackCost(state);
  if (state.company.cash < cost) return fail(state, `Buying the public out costs ${formatMoney(state, cost)}.`);
  const s = cloneState(state);
  book(s, 'equity', -cost);
  s.listing = undefined;
  pushNews(s, `${s.company.name} buys out its shareholders and delists for ${formatMoney(s, cost)}.`, 'big');
  return ok(s, 'Taken private.');
}


/** Lure a rival's standout tech away — at a premium, and it costs you both. */
export function headhunt(state: TycoonState, rivalId: string, depotId?: string): ActionOutcome {
  const rival = state.rivals.find(r => r.id === rivalId);
  if (!rival) return fail(state, 'Unknown rival.');
  const why = headhuntBlocker(state, rival);
  if (why) return fail(state, why);
  const s = cloneState(state);
  const r = s.rivals.find(x => x.id === rivalId)!;
  const m = headhuntTarget(s, r);
  const fee = headhuntFee(m);
  m.id = newId(s, 'crew');
  m.hiredHour = s.hour;
  m.depotId = (s.depots.find(d => d.id === depotId) ?? s.depots[0]).id;
  s.people.push(m);
  syncCrew(s);
  book(s, 'wages', -fee);
  r.health = headhuntRivalHealthAfter(r);
  s.company.reputation = Math.max(0, s.company.reputation - HEADHUNT_REP_COST);
  (s.headhunted ??= {})[r.id] = dayOf(s.hour);
  addHeat(s, r.id, HEAT_HEADHUNT);
  pushNews(s, `${s.company.name} lures ${m.name} away from ${r.name}.`, 'big');
  return ok(s, `${m.name} (${levelOf(m)}★ ${roleOf(m)}) leaves ${r.name} to join you.`);
}

/** Put on a festival of your own this summer. */
export function promoteFestival(state: TycoonState, tier: FestTier, headliner: FestHeadliner, ticket: FestTicket, cityId: string): ActionOutcome {
  const why = festBlocker(state, tier, headliner);
  if (why) return fail(state, why);
  if (!state.depots.some(d => d.cityId === cityId)) return fail(state, 'Host it from one of your bases.');
  const s = cloneState(state);
  planFestival(s, tier, headliner, ticket, cityId);
  return ok(s, 'Festival announced.');
}

export function buyOwnedVenue(state: TycoonState, venueId: string): ActionOutcome {
  const venue = worldOf(state).venueById.get(venueId);
  if (!venue) return fail(state, 'Unknown venue.');
  const why = buyBlocker(state, venue);
  if (why) return fail(state, why);
  const s = cloneState(state);
  buyVenue(s, venue);
  return ok(s, `${venue.name} is yours.`);
}

export function sellOwnedVenue(state: TycoonState, venueId: string): ActionOutcome {
  if (!ownedOf(state, venueId)) return fail(state, 'You do not own it.');
  const s = cloneState(state);
  const proceeds = sellVenue(s, venueId);
  return ok(s, `Sold for ${formatMoney(s, proceeds)}.`);
}

export function setVenueProgramme(state: TycoonState, venueId: string, programme: VenueProgramme): ActionOutcome {
  if (!ownedOf(state, venueId)) return fail(state, 'You do not own it.');
  const s = cloneState(state);
  ownedOf(s, venueId)!.programme = programme;
  return ok(s);
}

/** Pay for an investigator to watch a rival: you see their heat, and they take fewer of your offers. */
export function investigate(state: TycoonState, rivalId: string): ActionOutcome {
  const rival = state.rivals.find(r => r.id === rivalId);
  if (!rival) return fail(state, 'Unknown rival.');
  const why = investigatorBlocker(state, rival);
  if (why) return fail(state, why);
  const s = cloneState(state);
  const target = s.rivals.find(r => r.id === rivalId)!;
  return ok(s, withRng(s, rng => hireInvestigator(s, target, rng)));
}

/** Add or upgrade an annex at a warehouse. */
export function buildAnnex(state: TycoonState, depotId: string, module: ModuleId): ActionOutcome {
  const d0 = state.depots.find(d => d.id === depotId);
  if (!d0) return fail(state, 'Unknown base.');
  const why = moduleBlocker(state, d0, module);
  if (why) return fail(state, why);
  const s = cloneState(state);
  buildModule(s, s.depots.find(d => d.id === depotId)!, module);
  return ok(s, `${MODULES[module].label} built.`);
}

/** Run a booked show, or a whole tour, through your rehearsal stage. */
export function rehearseShow(state: TycoonState, targetId: string): ActionOutcome {
  const why = rehearsalBlocker(state, targetId);
  if (why) return fail(state, why);
  const s = cloneState(state);
  return ok(s, rehearse(s, targetId));
}

/** Lock the fuel price for 6 or 12 months at today's pump price plus a premium. */
export function lockFuel(state: TycoonState, months: number): ActionOutcome {
  const why = fuelLockBlocker(state);
  if (why) return fail(state, why);
  if (!FUEL_LOCK_MONTHS.includes(months)) return fail(state, 'Contracts run for 6 or 12 months.');
  const s = cloneState(state);
  const spot = marketNow(s).fuel;
  const price = Math.round(spot * (1 + FUEL_LOCK_PREMIUM) * 100) / 100;
  s.fuelLock = { price, untilDay: dayOf(s.hour) + months * 30 };
  pushNews(s, `${s.company.name} signs a ${months}-month fuel contract at ${Math.round((price - 1) * 100)}% ${price >= 1 ? 'above' : 'below'} the normal price.`, 'info');
  return ok(s, `Fuel locked at ${price.toFixed(2)}× for ${months} months.`);
}

/** Send someone on a course for a ticket. */
export function trainCrew(state: TycoonState, personId: string, cert: CertId): ActionOutcome {
  const m0 = state.people.find(m => m.id === personId);
  if (!m0) return fail(state, 'Unknown crew member.');
  const why = courseBlocker(state, m0, cert);
  if (why) return fail(state, why);
  const s = cloneState(state);
  return ok(s, startCourse(s, s.people.find(m => m.id === personId)!, cert));
}

/** Order merchandise for a booked tour. */
export function orderTourMerch(state: TycoonState, tourId: string, level: MerchLevel): ActionOutcome {
  const tour = state.tours.find(t => t.id === tourId);
  if (!tour) return fail(state, 'Unknown tour.');
  const why = merchBlocker(state, tour, level);
  if (why) return fail(state, why);
  const s = cloneState(state);
  return ok(s, orderMerch(s, s.tours.find(t => t.id === tourId)!, level));
}

export function borrow(state: TycoonState): ActionOutcome {
  const limit = creditLimit(state);
  const step = Math.min(borrowStep(state), limit - state.company.loan);
  if (step <= 0) return fail(state, `The bank won't lend more than ${formatMoney(state, limit)} against what you own.`);
  const s = cloneState(state);
  s.company.loan += step;
  s.company.cash += step;
  return ok(s);
}

export function repay(state: TycoonState): ActionOutcome {
  if (state.company.loan <= 0) return fail(state, 'No loan to repay.');
  const amount = Math.min(borrowStep(state), state.company.loan);
  if (state.company.cash < amount) return fail(state, 'Not enough cash.');
  const s = cloneState(state);
  s.company.loan -= amount;
  s.company.cash -= amount;
  return ok(s);
}

export function hireTech(state: TycoonState, techId: string): ActionOutcome {
  const tech = getTech(techId);
  const year = yearOf(state, state.hour);
  if (!techsActiveIn(year, state.country).some(t => t.id === techId)) return fail(state, `${tech.name} isn't taking work right now.`);
  if (state.techs.some(t => t.techId === techId)) return fail(state, `${tech.name} already works for you.`);
  if (state.company.cash < tech.fee) return fail(state, `${tech.name} wants ${formatMoney(state, tech.fee)} to sign.`);
  const s = cloneState(state);
  s.techs.push({ techId });
  book(s, 'wages', -tech.fee);
  pushNews(s, `${tech.name} joins ${s.company.name} as ${tech.role.replace(/^[A-Z][a-z]/, m => m.toLowerCase())}.`, 'good');
  return ok(s, `${tech.name} signed. Put them on a truck to bring them to the shows.`);
}

export function releaseTech(state: TycoonState, techId: string): ActionOutcome {
  if (!state.techs.some(t => t.techId === techId)) return fail(state, 'Not on your payroll.');
  const s = cloneState(state);
  s.techs = s.techs.filter(t => t.techId !== techId);
  return ok(s, `${getTech(techId).name} has moved on.`);
}

/** Put a star tech on a truck (or back at base with `vehicleId` null). */
export function assignTech(state: TycoonState, techId: string, vehicleId: string | null): ActionOutcome {
  if (!state.techs.some(t => t.techId === techId)) return fail(state, 'Not on your payroll.');
  if (vehicleId && !state.vehicles.some(v => v.id === vehicleId && v.owner === 'player')) return fail(state, 'Unknown vehicle.');
  const s = cloneState(state);
  s.techs = s.techs.map(t => (t.techId === techId ? { ...t, vehicleId: vehicleId ?? undefined } : t));
  return ok(s);
}

/** Sign a venue's house contract: the rig is installed from your warehouse in that town. */
export function signContract(state: TycoonState, contractId: string): ActionOutcome {
  const c = state.contracts.find(x => x.id === contractId);
  if (!c || c.status !== 'offer') return fail(state, 'That contract is no longer on offer.');
  if (c.acceptByDay < dayOf(state.hour)) return fail(state, 'Bids have closed.');
  const needed = tierInfo(c.tier);
  if (state.company.reputation < needed.minReputation) return fail(state, `The venue wants reputation ${needed.minReputation}+ for its house supplier.`);
  const world = worldOf(state);
  const city = world.cityById.get(c.cityId);
  const short = contractShortfall(state, c);
  if (!short) return fail(state, `You need a warehouse in ${city?.name} to supply a house rig there.`);
  const missing = DEPTS.filter(d => short[d] > 0);
  if (missing.length) return fail(state, `Your ${city?.name} warehouse is short: ${missing.map(d => `${short[d]} ${DEPT_LABELS[d]}`).join(', ')}.`);
  const s = cloneState(state);
  const sc = s.contracts.find(x => x.id === contractId)!;
  installKit(s, sc);
  sc.status = 'active';
  const venue = world.venueById.get(c.venueId);
  pushNews(s, `${s.company.name} is the new house supplier at ${venue?.name} — ${formatMoney(s, c.monthly)}/month for a year.`, 'good', { cityId: c.cityId });
  return ok(s, `Signed. The house rig is installed at ${venue?.name}.`);
}

/** Walk away from a house contract early: the kit comes home, the penalty doesn't. */
export function breakContract(state: TycoonState, contractId: string): ActionOutcome {
  const c = state.contracts.find(x => x.id === contractId);
  if (!c || c.status !== 'active') return fail(state, 'No active contract to end.');
  const penalty = c.monthly * BREAK_MONTHS;
  const s = cloneState(state);
  const sc = s.contracts.find(x => x.id === contractId)!;
  const depot = depotInCity(s, sc.cityId) ?? s.depots[0];
  if (depot) addStock(depot.gear, sc.installed);
  sc.installed = {};
  sc.status = 'ended';
  sc.endDay = dayOf(s.hour);
  book(s, 'penalties', -penalty);
  s.cityRatings[sc.cityId] = Math.max(0, (s.cityRatings[sc.cityId] ?? 50) - 15);
  return ok(s, `Contract ended early — ${formatMoney(s, penalty)} penalty. The kit is back in the warehouse.`);
}

/** Put in (or change) a sealed bid on a special event's department lot. */
export function bidEvent(state: TycoonState, gigId: string, level: BidLevel | null): ActionOutcome {
  const gig = gigById(state, gigId);
  if (!gig?.event || gig.event.citywide || gig.status !== 'offer') return fail(state, 'That tender is closed.');
  if (gig.acceptByDay < dayOf(state.hour)) return fail(state, 'Bidding has closed.');
  const { reason } = gigBookingBar(state, gig);
  if (level && reason) return fail(state, reason);
  const s = cloneState(state);
  const g = gigById(s, gigId)!;
  if (level) g.bid = level;
  else delete g.bid;
  return ok(s, level ? `${BID_LEVELS[level].label} bid in for the ${DEPT_LABELS[gig.event.lot].toLowerCase()} at ${gig.event.name} — decided ${formatDay(s, gig.acceptByDay + 1)}.` : 'Bid withdrawn.');
}

/** Send units of a product line from one base to another by courier. */
export function transferGear(state: TycoonState, fromDepotId: string, toDepotId: string, productId: string, qty = 1): ActionOutcome {
  const from = state.depots.find(d => d.id === fromDepotId);
  const to = state.depots.find(d => d.id === toDepotId);
  if (!from || !to || from === to) return fail(state, 'Pick two different bases.');
  const have = from.gear[productId] ?? 0;
  if (have < 1) return fail(state, 'None of that on the racks here.');
  const n = Math.min(qty, have);
  if (!canReceive(state, to, n)) return fail(state, `The ${facilitySpec(to).label.toLowerCase()} there has no room for it.`);
  const quote = transferQuote(state, from, to, n);
  if (!Number.isFinite(quote.cost)) return fail(state, 'No road between those bases.');
  if (state.company.cash < quote.cost) return fail(state, `The courier wants ${formatMoney(state, quote.cost)}.`);
  const s = cloneState(state);
  const src = s.depots.find(d => d.id === fromDepotId)!;
  src.gear[productId] -= n;
  if (!src.gear[productId]) delete src.gear[productId];
  s.transfers.push({ id: newId(s, 'tx'), fromDepotId, toDepotId, stock: { [productId]: n }, arriveHour: s.hour + quote.hours });
  bookTransfer(s, quote.cost);
  return ok(s, `${n}× ${getProduct(productId).name} on the way (${describeQuote(s, quote)}).`);
}

/** Buy a rival outright (TT-style): their base, kit and crew become yours. */
export function buyRival(state: TycoonState, rivalId: string): ActionOutcome {
  const r = state.rivals.find(x => x.id === rivalId);
  if (!r) return fail(state, 'That firm is no longer trading.');
  const blocker = takeoverBlocker(state, r);
  if (blocker) return fail(state, blocker);
  const s = cloneState(state);
  const price = absorbRival(s, s.rivals.find(x => x.id === rivalId)!);
  return ok(s, `${r.name} is yours for ${formatMoney(s, price)}.`);
}

function returnLeased(state: TycoonState, v0: Vehicle): ActionOutcome {
  if (v0.cityId !== v0.homeCityId || !(v0.status === 'parked' || v0.status === 'scheduled')) {
    return fail(state, 'Leased vehicles go back from their depot.');
  }
  const penalty = leaseReturnPenalty(state, v0);
  const s = cloneState(state);
  const depot = depotInCity(s, v0.homeCityId);
  if (depot) aboard(s, v0.id).forEach(m => moveToDepot(m, depot.id));
  unpinFrom(s, v0.id);
  s.vehicles = s.vehicles.filter(v => v.id !== v0.id);
  syncCrew(s);
  s.techs = s.techs.map(t => (t.vehicleId === v0.id ? { techId: t.techId } : t));
  if (penalty) book(s, 'leasing', -penalty);
  return ok(s, penalty ? `${v0.name} handed back early — ${formatMoney(s, penalty)} penalty.` : `${v0.name} handed back at the end of its lease.`);
}

/** Fund an R&D project in a department. */
export function startRnd(state: TycoonState, dept: Dept, ambition: RndAmbition): ActionOutcome {
  const blocker = rndBlocker(state, dept);
  if (blocker) return fail(state, blocker);
  const s = cloneState(state);
  startProject(s, dept, ambition);
  const p = s.projects[s.projects.length - 1];
  return ok(s, `${AMBITIONS[ambition].label} project started: ${formatMoney(s, p.budget)} over ${AMBITIONS[ambition].months} months.`);
}

export function cancelRnd(state: TycoonState, projectId: string): ActionOutcome {
  const p0 = state.projects.find(p => p.id === projectId && p.status === 'running');
  if (!p0) return fail(state, 'No such project running.');
  const s = cloneState(state);
  s.projects.find(p => p.id === projectId)!.status = 'failed';
  return ok(s, 'Project shelved. What was spent is spent.');
}

/** Accept or decline an act's production deal. */
export function answerDeal(state: TycoonState, dealId: string, accept: boolean): ActionOutcome {
  const d0 = state.deals.find(d => d.id === dealId && d.status === 'offer');
  if (!d0) return fail(state, 'That offer has lapsed.');
  const s = cloneState(state);
  const d = s.deals.find(x => x.id === dealId)!;
  if (!accept) {
    d.status = 'ended';
    return ok(s, `You turned down ${d.act}.`);
  }
  d.status = 'active';
  d.startDay = dayOf(s.hour);
  d.endDay = d.startDay + DEAL_YEARS * 365;
  pushNews(s, `${s.company.name} signs an exclusive production deal with ${d.act}.`, 'good');
  return ok(s, `Signed with ${d.act}: their tours come to you for ${DEAL_YEARS} years.`);
}
