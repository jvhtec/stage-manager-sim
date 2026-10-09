/**
 * The clock. `advanceHours` steps the world one game hour at a time:
 * vehicles follow their orders along the road network, break down, get
 * serviced; shows resolve from whatever actually turned up at load-in; and
 * once a day the market, wages, running costs and rivals tick over.
 *
 * Pure and deterministic: same state in → same state out (the only
 * randomness is the seeded rng carried in `state.rngState`).
 */
import { hypeLabel, showPayout } from './gate';
import { paperworkFor } from './paperwork';
import { chargeZones, yearlyZones } from './regulation';
import { settleRuns } from './runs';
import { dailyTradeShows, monthlyMarketing } from './marketing';
import { difficultyOf, monthlyGoal } from './scenario';
import { monthlyPriceWars } from './pricewars';
import { monthlyShares } from './shares';
import { dailyUtilisation } from './fleetReport';
import { recordVenueNight } from './promoters';
import { dailyAuctions, monthlyAuctions } from './auctions';
import { annualReport, monthlyMilestones } from './milestones';
import { monthlyPartners } from './partners';
import { monthlyTowns } from './towns';
import { breakdownDilemma, dailyCrewDilemmas, hourlyCrises } from './dilemmas';
import type { Rng } from '@/lib/rng';
import {
  HOTEL_NIGHT,
  HOURS_PER_DAY,
  PER_DIEM,
  fuelPerTile,
  NEGATIVE_MONTHS_GAME_OVER,
  NO_SHOW_PENALTY_RATE,
  SERVICE_COST,
  SERVICE_HOURS,
  SERVICE_INTERVAL_DAYS,
  VEHICLE_MODELS,
  getModel,
} from './catalog';
import {
  book,
  cloneState,
  dateOfDay,
  dayOf,
  depotInCity,
  emptyCounts,
  freeLot,
  formatDay,
  formatMoney,
  gigById,
  loadInHour,
  loadOutDoneHour,
  maxReliability,
  plannedDepartureHour,
  pushNews,
  showEndHour,
  showStartHour,
  travelHours,
  vehicleAgeYears,
  withRng,
  yearOf,
} from './core';
import { worldOf } from './mapgen';
import { addStock, baseShowQuality, deptTotals, evaluateGear, pickGear, stockSize } from './loading';
import { GEAR_PRODUCTS, getProduct } from './content/gear';
import { leftBehindChance, monthlyRent, monthlySalaries, prepFailureFactor, prepOf, prepRatio } from './facilities';
import { monthlyTraining, PAY, freelancersFor, monthlyCrew, moraleBonus } from './crew';
import { REST_AT, crewDirectives, aboard, atDepot, dailyPeopleFatigue, dailyPoachBids, dayRate, evaluateCrew, learnFromShow, moveToDepot, moveToVehicle, pickCrew, refreshCandidates, syncCrew } from './people';
import { dailyWorkshop, monthlyWorkshop, rollFailure, wearFromShow, type Failure } from './wear';
import { rivalsFor } from './content/companies';
import { getTech, techBonus, techsActiveIn } from './content/techs';
import { dailyOffers, pruneGigs, rivalsTakeOffers, yearlyVenues } from './offers';
import { dailyTours } from './tours';
import { dailyFestivals } from './festivals';
import { dailyOwnFestival } from './ownfest';
import { dailyEvents, eventStakes } from './events';
import { deliverTransfers } from './transfers';
import { monthlyRivals } from './rivals';
import { monthlyLeases } from './finance';
import { monthlyRnd } from './rnd';
import { BAD_NIGHT, monthlyDeals, strike } from './deals';
import { bookSubHire, dailyRentOut, subHireFor } from './hire';
import { awardsNight, recordEvent, recordShow } from './awards';
import { dailyIncidents, monthlyInsurance, rollWeather } from './incidents';
import { dailyContracts, houseRigAt, monthlyContracts } from './contracts';
import { dailyMarket, marketNow, monthlyInterest } from './market';
import { getRegion } from './content/world';
import { getCityPath } from './pathfinding';
import { DEPTS, type GearStock, type Gig, type TycoonState, type Vehicle, type WorldMap } from './types';
import { findArtist } from './content/artists';

const TIER_WEIGHT = [0, 1, 1.3, 1.7, 2.2];
/** Playing pubs can only get you so far — each venue tier caps the reputation it can earn you. */
const TIER_REP_CEILING = [0, 38, 68, 92, 100];

export function reputationAfterShow(rep: number, tier: number, quality: number): number {
  const delta = (quality - 0.6) * 3 * TIER_WEIGHT[tier];
  if (delta <= 0) return Math.max(0, rep + delta);
  const ceiling = TIER_REP_CEILING[tier];
  if (rep >= ceiling) return rep;
  // Diminishing returns as you approach the ceiling.
  return Math.min(ceiling, rep + delta * Math.max(0.25, 1 - rep / 110));
}

/**
 * Runs the world on by `hours`. With `stopForDecisions`, stops early in the
 * hour a new problem needs your call (so the game can pause on it).
 */
export function advanceHours(state: TycoonState, hours: number, stopForDecisions = false): TycoonState {
  if (state.gameOver || hours <= 0) return state;
  const s = cloneState(state);
  const world = worldOf(s);
  const waiting = new Set(s.dilemmas.map(d => d.id));
  withRng(s, rng => {
    for (let i = 0; i < hours && !s.gameOver; i++) {
      stepHour(s, world, rng);
      if (stopForDecisions && s.dilemmas.some(d => !waiting.has(d.id))) break;
    }
  });
  return s;
}

function stepHour(s: TycoonState, world: WorldMap, rng: Rng) {
  s.hour += 1;
  if (s.hour % HOURS_PER_DAY === 0) dailyTick(s, world, rng);
  deliverTransfers(s);
  hourlyCrises(s, rng);
  resolveShows(s, world, rng);
  // Snapshot the list: rival trucks can be removed mid-loop.
  [...s.vehicles].forEach(v => stepVehicle(s, world, v, rng));
  s.vehicles = s.vehicles.filter(v => !(v.owner !== 'player' && v.status === 'parked' && v.cityId === v.homeCityId && !v.orders.length));
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

/** Orders still worth driving to: booked (or rival-held) and not already over. */
function nextGig(s: TycoonState, v: Vehicle): Gig | undefined {
  while (v.orders.length) {
    const gig = gigById(s, v.orders[0]);
    const live = gig && (v.owner === 'player' ? gig.status === 'booked' : gig.status === 'rival' && !gig.result);
    if (gig && live && s.hour < showEndHour(gig)) return gig;
    v.orders.shift();
  }
  return undefined;
}

function startDrive(s: TycoonState, world: WorldMap, v: Vehicle, to: string) {
  const from = v.cityId!;
  if (from === to) return;
  const path = getCityPath(world, from, to);
  if (!path.length) {
    if (v.owner === 'player') pushNews(s, `${v.name} can't find a road to ${world.cityById.get(to)?.name}.`, 'bad', { vehicleId: v.id });
    v.orders = [];
    return;
  }
  v.status = 'driving';
  v.route = { from, to, progress: 0 };
  v.cityId = undefined;
  v.arrivedHour = undefined;
}

function loadVehicle(s: TycoonState, v: Vehicle, gig: Gig) {
  if (v.owner !== 'player') {
    v.crew = gig.crewNeeded;
    return;
  }
  const depot = depotInCity(s, v.homeCityId);
  if (!depot) return;
  const model = getModel(v.modelId);

  // Remaining need across this vehicle's whole tour, net of what other
  // already-loaded trucks are bringing to each show.
  const remaining = emptyCounts();
  let crewRemaining = 0;
  v.orders.forEach(gigId => {
    const g = gigById(s, gigId);
    if (!g || g.status !== 'booked') return;
    const others = s.vehicles.filter(o => o !== v && o.owner === 'player' && o.orders.includes(gigId));
    // A venue where you're the house supplier already has your rig in it.
    const brought = deptTotals(houseRigAt(s, g.venueId) ?? {});
    others.forEach(o => {
      const t = deptTotals(o.cargo);
      DEPTS.forEach(d => (brought[d] += t[d]));
    });
    DEPTS.forEach(d => {
      remaining[d] = Math.max(remaining[d], g.needs[d] - brought[d]);
    });
    const crewBrought = others.reduce((sum, o) => sum + o.crew, 0);
    crewRemaining = Math.max(crewRemaining, g.crewNeeded - crewBrought);
  });

  const picked = pickGear(depot.gear, remaining, model.gearCapacity - stockSize(v.cargo), gig.rider);
  addStock(v.cargo, picked);
  const directives = crewDirectives(s, gig);
  const here = atDepot(s, depot.id);
  const pinned = here.filter(m => m.pinnedVehicleId === v.id || directives.prefer.has(m.id)).length;
  const seats = Math.min(model.crewSeats - v.crew, Math.max(crewRemaining, pinned), depot.crew);
  if (seats > 0) {
    // Pinned and named people first, then the freshest, best-matched people for the job ahead get on board.
    const opts = { vehicleId: v.id, restAt: REST_AT[s.policies.rest], ...directives };
    pickCrew(atDepot(s, depot.id), gig, seats, aboard(s, v.id), opts).forEach(m => moveToVehicle(m, v.id));
    syncCrew(s);
  }
}

const isLoaded = (v: Vehicle) => stockSize(v.cargo) + v.crew > 0;

function unloadVehicle(s: TycoonState, v: Vehicle) {
  if (v.owner !== 'player') return;
  const depot = depotInCity(s, v.homeCityId);
  if (!depot) return;
  addStock(depot.gear, v.cargo);
  aboard(s, v.id).forEach(m => moveToDepot(m, depot.id));
  v.cargo = {};
  syncCrew(s);
}

function maybeService(s: TycoonState, v: Vehicle, freeHours: number) {
  if (v.owner !== 'player') return false;
  const due = s.hour - v.lastServiceHour >= SERVICE_INTERVAL_DAYS * HOURS_PER_DAY;
  if (!due || freeHours < SERVICE_HOURS) return false;
  serviceNow(s, v);
  return true;
}

export function serviceNow(s: TycoonState, v: Vehicle) {
  v.status = 'servicing';
  v.busyUntil = s.hour + SERVICE_HOURS;
  v.lastServiceHour = s.hour;
  v.reliability = maxReliability(v, s.hour);
  book(s, 'servicing', -SERVICE_COST);
  v.profitThisYear -= SERVICE_COST;
}

/** Decide what a stationary vehicle does next. */
function decide(s: TycoonState, world: WorldMap, v: Vehicle) {
  const at = v.cityId!;
  const gig = nextGig(s, v);

  if (!gig) {
    if (at !== v.homeCityId) {
      startDrive(s, world, v, v.homeCityId);
    } else {
      unloadVehicle(s, v);
      v.status = 'parked';
      maybeService(s, v, Infinity);
    }
    return;
  }

  if (at === v.homeCityId && v.owner === 'player' && !isLoaded(v)) {
    const departAt = plannedDepartureHour(world, v, at, gig);
    if (s.hour < departAt) {
      if (!maybeService(s, v, departAt - s.hour)) v.status = 'scheduled';
      return;
    }
    loadVehicle(s, v, gig);
  } else if (at === v.homeCityId && v.owner !== 'player') {
    if (s.hour < plannedDepartureHour(world, v, at, gig)) {
      v.status = 'scheduled';
      return;
    }
    loadVehicle(s, v, gig);
  }

  if (at === gig.cityId) {
    v.status = 'on-site';
    v.arrivedHour ??= s.hour;
    return;
  }

  if (at === v.homeCityId) {
    startDrive(s, world, v, gig.cityId);
    return;
  }

  // Out on the road between shows: go straight on if the next show is soon,
  // otherwise pop home first (unload, service, reload for the next leg).
  const direct = travelHours(world, v.modelId, at, gig.cityId);
  const viaHome = travelHours(world, v.modelId, at, v.homeCityId) + travelHours(world, v.modelId, v.homeCityId, gig.cityId);
  const window = loadInHour(gig) - s.hour;
  if (v.owner === 'player' && window - direct > 48 && viaHome + 24 < window) {
    startDrive(s, world, v, v.homeCityId);
  } else {
    startDrive(s, world, v, gig.cityId);
  }
}

function arrive(s: TycoonState, world: WorldMap, v: Vehicle) {
  v.cityId = v.route!.to;
  v.route = undefined;
  v.status = 'parked';
  if (v.cityId === v.homeCityId) unloadVehicle(s, v);
  decide(s, world, v);
}

function stepVehicle(s: TycoonState, world: WorldMap, v: Vehicle, rng: Rng) {
  switch (v.status) {
    case 'servicing':
      if (s.hour >= (v.busyUntil ?? 0)) {
        v.status = 'parked';
        v.busyUntil = undefined;
        decide(s, world, v);
      }
      return;
    case 'on-site': {
      const gig = gigById(s, v.orders[0]);
      if (!gig || s.hour >= loadOutDoneHour(gig)) {
        v.orders.shift();
        v.arrivedHour = undefined;
        v.status = 'parked';
        decide(s, world, v);
      }
      return;
    }
    case 'parked':
    case 'scheduled':
      decide(s, world, v);
      return;
    case 'broken':
      if (s.hour < (v.brokenUntil ?? 0)) return;
      v.status = 'driving';
      v.brokenUntil = undefined;
      if (v.owner === 'player') pushNews(s, `${v.name} is back on the road.`, 'info', { vehicleId: v.id });
      break;
    case 'driving':
      if (rng.chance((1 - v.reliability / 100) * 0.035)) {
        v.status = 'broken';
        v.brokenUntil = s.hour + 3 + rng.nextInt(6);
        if (v.owner === 'player') {
          pushNews(s, `${v.name} has broken down!`, 'bad', { vehicleId: v.id });
          breakdownDilemma(s, v);
        }
        return;
      }
      break;
  }

  // Driving.
  const route = v.route!;
  const path = getCityPath(world, route.from, route.to);
  const model = getModel(v.modelId);
  route.progress += model.speed;
  if (v.owner === 'player') {
    const fuel = model.speed * fuelPerTile(model);
    book(s, 'fuel', -fuel);
    v.profitThisYear -= fuel;
  }
  if (route.progress >= path.length - 1) arrive(s, world, v);
}

// ---------------------------------------------------------------------------
// Shows
// ---------------------------------------------------------------------------

function resolveShows(s: TycoonState, world: WorldMap, rng: Rng) {
  s.gigs.forEach(gig => {
    if (s.hour !== showEndHour(gig)) return;
    if (gig.status === 'rival' && !gig.result) {
      const rival = s.rivals.find(r => r.id === gig.rivalId);
      if (rival) {
        rival.showsPlayed += 1;
        rival.reputation = Math.min(100, rival.reputation + 0.3 * TIER_WEIGHT[gig.tier]);
      }
      gig.result = { quality: 0.8, payout: gig.fee, lateHours: 0, gearCoverage: 1, crewCoverage: 1 };
      return;
    }
    if (gig.status !== 'booked') return;
    playShow(s, world, gig, rng);
  });
}

function playShow(s: TycoonState, world: WorldMap, gig: Gig, rng: Rng) {
  const venue = world.venueById.get(gig.venueId);
  const city = world.cityById.get(gig.cityId);
  const where = gig.overseas
    ? `the ${getRegion(gig.overseas.regionId).name} (${gig.overseas.stops.map(st => st.city).join(', ')})`
    : gig.festival
      ? `the ${gig.festival.stage}, ${city?.name}`
      : `${venue?.name}, ${city?.name}`;
  const onSite = s.vehicles.filter(
    v =>
      v.owner === 'player' &&
      v.status === 'on-site' &&
      v.cityId === gig.cityId &&
      v.orders[0] === gig.id &&
      (v.arrivedHour ?? Infinity) <= showStartHour(gig),
  );

  const delivered: GearStock = {};
  let crew = 0;
  onSite.forEach(v => {
    addStock(delivered, v.cargo);
    crew += v.crew;
  });
  // Your house rig is already in the room (it still needs a crew to run it).
  const houseRig = onSite.length ? houseRigAt(s, gig.venueId) : undefined;
  if (houseRig) addStock(delivered, houseRig);
  // Short of kit? A rival nearby sends the rest straight to the venue, at a day rate.
  const hire = onSite.length ? subHireFor(s, world, gig, delivered) : { stock: {}, units: 0, cost: 0, from: [] };
  bookSubHire(s, hire);
  if (hire.cost) onSite.forEach(v => (v.profitThisYear -= Math.round(hire.cost / onSite.length)));
  const working: GearStock = { ...delivered };
  addStock(working, hire.stock);
  // Who's working the show, and how well their skills fit its departments.
  const people = onSite.flatMap(v => aboard(s, v.id));
  const crewEval = evaluateCrew(people, gig);
  // Prep: every truck's kit was checked (or not) by its home base's warehouse crew.
  const prep = prepOf(s, onSite);
  const forgotten: string[] = [];
  onSite.forEach(v => {
    const base = depotInCity(s, v.homeCityId);
    const ids = Object.keys(v.cargo).filter(id => working[id] > 0).sort();
    if (!ids.length || !rng.chance(leftBehindChance(base ? prepRatio(s, base) : 0))) return;
    const id = rng.pick(ids);
    working[id] -= 1;
    if (!working[id]) delete working[id];
    forgotten.push(id);
  });
  // Worn kit can pack up on the night (once per show day); prepped kit less so.
  const showDays = gig.overseas ? gig.overseas.stops.length : (gig.days ?? 1);
  const failures: Failure[] = [];
  for (let d = 0; d < Math.min(4, showDays); d++) {
    const f = rollFailure(s, working, rng, prepFailureFactor(prep) * crewEval.failureFactor * (gig.mods?.failureFactor ?? 1));
    if (f) failures.push(f);
  }
  const gear = evaluateGear(working, gig, yearOf(s, s.hour), s.gearCondition);
  const weather = onSite.length ? rollWeather(s, gig, rng) : null;
  wearFromShow(s, delivered, showDays + (weather?.extraWear ?? 0), !!gig.overseas);
  const failureNote =
    (failures.length ? ` ${failures.map(f => `${getProduct(f.productId).brand} ${getProduct(f.productId).name}`).join(' and ')} died mid-set.` : '') +
    (forgotten.length ? ` A case of ${forgotten.map(id => getProduct(id).name).join(' and ')} was left on the warehouse floor.` : '');
  const onSiteIds = new Set(onSite.map(v => v.id));
  const techIds = s.techs.filter(t => t.vehicleId && onSiteIds.has(t.vehicleId)).map(t => t.techId);
  const gearCoverage = gear.coverage;
  // Tired crews are worth less on the night.
  // Short-handed? Local freelancers fill the gap, at a day rate.
  const freelance = onSite.length ? freelancersFor(s, world, gig, crew) : { count: 0, cost: 0, effectiveness: 0, local: false };
  const effCrew = crewEval.effective + freelance.count * freelance.effectiveness;
  const crewCoverage = Math.min(1, effCrew / Math.max(1, gig.crewNeeded));
  if (freelance.cost) {
    book(s, 'freelance', -freelance.cost);
    onSite.forEach(v => (v.profitThisYear -= Math.round(freelance.cost / onSite.length)));
  }
  const freelanceNote = freelance.count ? ` ${freelance.count} local freelancer${freelance.count > 1 ? 's' : ''} filled in.` : '';
  const lastArrival = Math.max(...onSite.map(v => v.arrivedHour ?? 0), 0);
  const lateHours = onSite.length ? Math.max(0, lastArrival - loadInHour(gig)) : 0;
  const rawQuality = Math.max(
    0,
    Math.min(
      1,
      baseShowQuality({ gearCoverage, crewCoverage, lateHours, gearQuality: gear.quality, riderMet: gear.riderMet, bonus: techBonus(techIds, gig.act) + moraleBonus(s.crewMorale) + crewEval.bonus - (weather?.penalty ?? 0) + (gig.mods?.quality ?? 0) }) +
        (rng.next() - 0.5) * 0.08,
    ),
  );
  // Special events: on live TV nothing may be late or break; great nights make careers.
  const stakes = eventStakes(gig, rawQuality, lateHours > 0 || failures.length > 0 || forgotten.length > 0);
  const quality = Math.max(0, rawQuality - stakes.qualityPenalty);
  const resultExtras = { gearQuality: gear.quality, riderMet: gear.riderMet, techs: techIds.length ? techIds : undefined };
  const tw = TIER_WEIGHT[gig.tier];
  const rating = s.cityRatings[gig.cityId] ?? 50;

  // Working a low-emission zone costs the old trucks a daily charge, show or no show.
  if (onSite.length) chargeZones(s, gig, onSite);
  // A rig that crossed a border paid its visas and carnet whether or not the night went well.
  if (gig.overseas && onSite.length) {
    const papers = paperworkFor(s, gig, working, crew, yearOf(s, s.hour));
    if (papers.total) {
      book(s, 'paperwork', -papers.total);
      onSite.forEach(v => (v.profitThisYear -= Math.round(papers.total / onSite.length)));
    }
  }
  if (!onSite.length || quality < 0.3) {
    const penalty = Math.round(gig.fee * NO_SHOW_PENALTY_RATE);
    book(s, 'penalties', -penalty);
    gig.status = 'failed';
    gig.result = { quality, payout: -penalty, lateHours, gearCoverage, crewCoverage, ...resultExtras };
    s.company.reputation = Math.max(0, s.company.reputation - 4 * tw + Math.min(0, stakes.reputation));
    s.cityRatings[gig.cityId] = Math.max(0, rating - 20);
    s.stats.showsFailed += 1;
    strike(s, gig.act, `the show at ${where} fell apart`);
    recordVenueNight(s, gig.venueId, quality, true);
    recordShow(s, yearOf(s, s.hour), quality, true, !!gig.festival);
    pushNews(
      s,
      onSite.length
        ? `Disaster at ${where}: ${gig.act} played to a half-built rig.${failureNote} Penalty ${formatMoney(s, penalty)}.`
        : `No-show! Nobody turned up for ${gig.act} at ${where}. Penalty ${formatMoney(s, penalty)}.`,
      'bad',
      { cityId: gig.cityId, gigId: gig.id },
    );
    return;
  }

  const payout = showPayout(gig, quality);
  book(s, 'shows', payout);
  if (gig.overseas) {
    // Air freight for the rig and flights for the crew, there and back.
    const region = getRegion(gig.overseas.regionId);
    const units = onSite.reduce((sum, v) => sum + stockSize(v.cargo), 0);
    const freight = units * region.freightPerUnit + crew * region.flightPerCrew;
    book(s, 'freight', -freight);
    onSite.forEach(v => (v.profitThisYear -= Math.round(freight / onSite.length)));
  }
  const totalCargo = onSite.reduce((sum, v) => sum + stockSize(v.cargo) + v.crew, 0) || 1;
  onSite.forEach(v => {
    v.profitThisYear += Math.round((payout * (stockSize(v.cargo) + v.crew)) / totalCargo);
  });
  // Acts remember who did them proud — they'll ask for you again.
  if (quality >= 0.75 && (findArtist(gig.act) || gig.festival)) {
    s.artistRelations[gig.act] = (s.artistRelations[gig.act] ?? 0) + 1;
  }
  gig.status = 'done';
  gig.result = { quality, payout, lateHours, gearCoverage, crewCoverage, ...resultExtras };
  s.company.reputation = Math.max(0, Math.min(100, reputationAfterShow(s.company.reputation, gig.tier, quality) + stakes.reputation));
  if (gig.event && !gig.event.citywide) recordEvent(s, yearOf(s, s.hour), quality);
  if (quality < BAD_NIGHT) strike(s, gig.act, `a bad night at ${where}`);
  recordVenueNight(s, gig.venueId, quality, false);
  s.cityRatings[gig.cityId] = Math.max(0, Math.min(100, rating + (quality - 0.5) * 30));
  s.stats.showsPlayed += 1;
  learnFromShow(s, people, crewEval.assigned, gig.tier >= 3 || !!gig.festival || !!gig.event);
  recordShow(s, yearOf(s, s.hour), quality, false, !!gig.festival);
  const verdict = quality >= 0.9 ? 'Storming show' : quality >= 0.7 ? 'Solid show' : 'Rough show';
  const riderNote = gear.riderMet === undefined ? '' : gear.riderMet ? ` Rider (${gig.rider!.brand}) honoured.` : ` They wanted ${gig.rider!.brand} and didn't get it.`;
  const kitNote = gear.quality < 0.8 ? ' Reviewers called the kit dated.' : '';
  const techNote = techIds.length ? ` ${techIds.map(id => getTech(id).name).join(' & ')} on the crew.` : '';
  const gateNote = gig.gate ? ` Tickets: ${hypeLabel(gig.gate.hype)} (gate deal).` : '';
  pushNews(s, `${verdict}: ${gig.act} at ${where} — ${Math.round(quality * 100)}%, earned ${formatMoney(s, payout)}.${gateNote}${weather?.note ?? ''}${failureNote}${freelanceNote}${hire.units ? ` Sub-hired ${hire.units} unit${hire.units > 1 ? 's' : ''} from ${hire.from.join(' & ')}.` : ''}${stakes.note}${riderNote}${kitNote}${techNote}`, quality >= 0.7 ? 'good' : 'info', {
    cityId: gig.cityId,
    gigId: gig.id,
  });
}

// ---------------------------------------------------------------------------
// Daily / monthly / yearly
// ---------------------------------------------------------------------------

function dailyTick(s: TycoonState, world: WorldMap, rng: Rng) {
  const day = dayOf(s.hour);
  const date = dateOfDay(s, day);

  if (date.getUTCMonth() === 0 && date.getUTCDate() === 1) {
    s.vehicles.forEach(v => {
      v.profitLastYear = v.profitThisYear;
      v.profitThisYear = 0;
    });
    pushNews(s, `It's ${date.getUTCFullYear()}. Last year's books are closed — check the finances.`, 'info');
    if (s.hour > HOURS_PER_DAY) awardsNight(s, date.getUTCFullYear() - 1);
    yearlyVenues(s, world, date.getUTCFullYear());
    annualReport(s, date.getUTCFullYear() - 1);
    yearlyZones(s, date.getUTCFullYear());
  }
  announceModels(s, date.getUTCFullYear());
  announceGear(s, date.getUTCFullYear());
  updateRivals(s, world, date.getUTCFullYear());

  // Running costs and wages land every day — idle trucks and idle crew cost money.
  const wages = Math.round(s.people.reduce((sum, m) => sum + dayRate(m), 0) * PAY[s.policies.pay].wage) + s.techs.reduce((sum, t) => sum + getTech(t.techId).wagePerDay, 0);
  book(s, 'wages', -wages);
  dailyMarket(s, wages);
  updateTechs(s, date.getUTCFullYear());
  dailyWorkshop(s);
  dailyRentOut(s);
  dailyPeopleFatigue(s);
  dailyPoachBids(s);
  dailyAuctions(s, rng);
  settleRuns(s);
  dailyTradeShows(s);
  dailyUtilisation(s);
  dailyCrewDilemmas(s, rng, s.crewMorale);
  syncCrew(s);
  dailyIncidents(s, rng);
  s.vehicles.forEach(v => {
    if (v.owner !== 'player') return;
    const model = getModel(v.modelId);
    // A night away from base: meals for the crew, and beds unless it's a sleeper bus.
    const away = v.crew > 0 && (v.cityId !== v.homeCityId || v.status === 'driving' || v.status === 'broken');
    if (away) {
      const night = Math.round(v.crew * (PER_DIEM + (model.kind === 'bus' ? 0 : HOTEL_NIGHT)));
      book(s, 'travel', -night);
      v.profitThisYear -= night;
    }
    // Tax, insurance and maintenance (fuel is paid by the mile).
    const cost = Math.round((model.runningCostPerYear * 0.7) / 365);
    book(s, 'running', -cost);
    v.profitThisYear -= cost;
    const decay = vehicleAgeYears(v, s.hour) > model.lifespanYears ? 0.3 : 0.12;
    v.reliability = Math.max(10, v.reliability - decay);
  });

  dailyOffers(s, world, rng);
  rivalsTakeOffers(s, world, rng);
  dailyTours(s, world, rng);
  dailyFestivals(s, world, rng);
  dailyOwnFestival(s, rng);
  dailyEvents(s, world, rng);
  dailyContracts(s, world);
  pruneGigs(s);

  // Nag about booked shows with nothing assigned two days out.
  s.gigs.forEach(gig => {
    if (gig.status !== 'booked' || gig.day - day !== 2) return;
    const assigned = s.vehicles.some(v => v.owner === 'player' && v.orders.includes(gig.id));
    if (!assigned) {
      pushNews(s, `${gig.act} plays in 2 days and no vehicles are assigned!`, 'bad', { cityId: gig.cityId, gigId: gig.id });
    }
  });

  if (date.getUTCDate() === 1 && day > 0) {
    monthlyTick(s, rng);
    monthlyContracts(s, world, rng);
    monthlyRivals(s, rng);
    monthlyAuctions(s, rng);
    monthlyMilestones(s);
    monthlyPartners(s);
    monthlyTowns(s, world);
    monthlyMarketing(s);
    monthlyGoal(s);
    monthlyPriceWars(s, rng);
    monthlyShares(s, p => rng.chance(p));
    monthlyRnd(s, rng);
    monthlyDeals(s, rng);
  }
  s.stats.peakCash = Math.max(s.stats.peakCash, s.company.cash);
}

function monthlyTick(s: TycoonState, rng: Rng) {
  const world = worldOf(s);
  book(s, 'property', -s.depots.reduce((sum, d) => sum + monthlyRent(world, d), 0));
  book(s, 'salaries', -monthlySalaries(s, PAY[s.policies.pay].wage));
  // Sales staff keep the local scene sweet.
  s.depots.forEach(d => {
    if (d.staff.office) s.cityRatings[d.cityId] = Math.min(100, (s.cityRatings[d.cityId] ?? 50) + 0.6 * d.staff.office);
  });
  monthlyWorkshop(s);
  monthlyCrew(s, rng);
  monthlyTraining(s);
  refreshCandidates(s, rng);
  syncCrew(s);
  monthlyInsurance(s);
  monthlyLeases(s);
  if (s.company.loan > 0) book(s, 'interest', -monthlyInterest(s));

  // During a shutdown the banks give everyone a repayment holiday.
  if (s.company.cash < 0 && marketNow(s).shutdown) {
    pushNews(s, 'Month closed in the red — the bank is giving the whole industry breathing room until venues reopen.', 'info');
  } else if (s.company.cash < 0) {
    s.negativeMonths += 1;
    const grace = difficultyOf(s).graceMonths;
    if (s.negativeMonths >= grace) {
      s.gameOver = {
        hour: s.hour,
        reason: `${s.company.name} spent ${s.negativeMonths} months in the red and the bank has called in the receivers.`,
      };
      pushNews(s, s.gameOver.reason, 'big');
    } else {
      pushNews(
        s,
        `Month closed in the red. ${grace - s.negativeMonths} more and the bank shuts you down.`,
        'big',
      );
    }
  } else {
    s.negativeMonths = 0;
  }
}

function announceModels(s: TycoonState, year: number) {
  VEHICLE_MODELS.forEach(model => {
    if (model.introYear > year || s.announcedModels.includes(model.id)) return;
    s.announcedModels.push(model.id);
    pushNews(s, `New vehicle available: the ${model.name} (${model.gearCapacity} gear, ${model.crewSeats} seats).`, 'big');
  });
}

function announceGear(s: TycoonState, year: number) {
  GEAR_PRODUCTS.forEach(p => {
    if (p.introYear > year || s.announcedGear.includes(p.id)) return;
    s.announcedGear.push(p.id);
    pushNews(s, `${p.brand} launches the ${p.name} — now in the gear catalogue (quality ${p.quality}/10).`, 'big');
  });
}

/** New companies set up shop and old ones rebrand as the years go by. */
export function updateRivals(s: TycoonState, world: WorldMap, year: number) {
  rivalsFor(s.country).forEach(t => {
    if (s.goneRivals.includes(t.id)) return;
    const rival = s.rivals.find(r => r.id === t.id);
    const gone = t.exits && year >= t.exits.year;
    if (rival && gone) {
      s.rivals = s.rivals.filter(r => r.id !== t.id);
      s.vehicles = s.vehicles.filter(v => v.owner !== t.id);
      if (s.hour > 24) pushNews(s, t.exits!.news, 'big', { cityId: rival.hqCityId });
      return;
    }
    if (!rival) {
      if (t.enters > year || gone) return;
      // Their real home town if it's on the map with a free lot; otherwise
      // spread out to the emptiest big town.
      const candidates = world.cities
        .map(c => ({ c, lot: freeLot(s, world, c.id), crowd: s.rivals.filter(r => r.hqCityId === c.id).length }))
        .filter(x => x.lot >= 0 && x.c.id !== s.company.hqCityId)
        .sort((a, b) => Number(b.c.name === t.hq) - Number(a.c.name === t.hq) || a.crowd - b.crowd || b.c.population - a.c.population);
      const pick = candidates[0];
      if (!pick) return;
      s.rivals.push({
        id: t.id,
        // Already renamed by the time they show up? Use the current name.
        name: (t.renames ?? []).filter(r => r.year <= year).pop()?.name ?? t.name,
        color: t.color,
        specialty: t.specialty,
        minTier: t.minTier,
        maxTier: t.maxTier,
        hqCityId: pick.c.id,
        lot: pick.lot,
        reputation: t.startingReputation,
        showsPlayed: 0,
      });
      if (s.hour > 24) pushNews(s, `${t.name} opens a base in ${pick.c.name} and starts bidding for work.`, 'big', { cityId: pick.c.id });
      return;
    }
    const latest = (t.renames ?? []).filter(r => r.year <= year).pop();
    if (latest && rival.name !== latest.name) {
      rival.name = latest.name;
      if (s.hour > 24) pushNews(s, latest.news, 'big', { cityId: rival.hqCityId });
    }
  });
}

/** Star techs retire at the end of their career; new names come onto the market. */
function updateTechs(s: TycoonState, year: number) {
  s.techs = s.techs.filter(h => {
    const t = getTech(h.techId);
    if (year <= t.to) return true;
    pushNews(s, `${t.name} hangs up the headphones — thanks for the shows.`, 'big');
    return false;
  });
  if (s.hour <= 24) return;
  const first = dateOfDay(s, dayOf(s.hour));
  if (first.getUTCMonth() !== 0 || first.getUTCDate() !== 1) return;
  techsActiveIn(year, s.country)
    .filter(t => t.from === year)
    .forEach(t => pushNews(s, `${t.name} (${t.role}) is taking calls — see Star techs.`, 'big'));
}

export function describeDate(s: TycoonState): string {
  return formatDay(s, dayOf(s.hour));
}
