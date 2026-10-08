/**
 * The clock. `advanceHours` steps the world one game hour at a time:
 * vehicles follow their orders along the road network, break down, get
 * serviced; shows resolve from whatever actually turned up at load-in; and
 * once a day the market, wages, running costs and rivals tick over.
 *
 * Pure and deterministic: same state in → same state out (the only
 * randomness is the seeded rng carried in `state.rngState`).
 */
import type { Rng } from '@/lib/rng';
import {
  DEPOT_UPKEEP_PER_MONTH,
  HOURS_PER_DAY,
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
  totalCrew,
  travelHours,
  vehicleAgeYears,
  withRng,
  yearOf,
} from './core';
import { worldOf } from './mapgen';
import { addStock, baseShowQuality, deptTotals, evaluateGear, pickGear, stockSize } from './loading';
import { GEAR_PRODUCTS, getProduct } from './content/gear';
import { crewWage, dailyCrew, effectiveCrew, mixFatigue, monthlyCrew, moraleBonus } from './crew';
import { dailyWorkshop, monthlyWorkshop, rollFailure, wearFromShow, type Failure } from './wear';
import { rivalsFor } from './content/companies';
import { getTech, techBonus, techsActiveIn } from './content/techs';
import { dailyOffers, pruneGigs, rivalsTakeOffers } from './offers';
import { dailyTours } from './tours';
import { dailyFestivals } from './festivals';
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

export function advanceHours(state: TycoonState, hours: number): TycoonState {
  if (state.gameOver || hours <= 0) return state;
  const s = cloneState(state);
  const world = worldOf(s);
  withRng(s, rng => {
    for (let i = 0; i < hours && !s.gameOver; i++) stepHour(s, world, rng);
  });
  return s;
}

function stepHour(s: TycoonState, world: WorldMap, rng: Rng) {
  s.hour += 1;
  if (s.hour % HOURS_PER_DAY === 0) dailyTick(s, world, rng);
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
    const brought = emptyCounts();
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
  const seats = Math.min(model.crewSeats - v.crew, crewRemaining, depot.crew);
  if (seats > 0) {
    v.crewFatigue = mixFatigue(v.crew, v.crewFatigue ?? 0, seats, depot.fatigue ?? 0);
    depot.crew -= seats;
    v.crew += seats;
  }
}

const isLoaded = (v: Vehicle) => stockSize(v.cargo) + v.crew > 0;

function unloadVehicle(s: TycoonState, v: Vehicle) {
  if (v.owner !== 'player') return;
  const depot = depotInCity(s, v.homeCityId);
  if (!depot) return;
  addStock(depot.gear, v.cargo);
  depot.fatigue = mixFatigue(depot.crew, depot.fatigue ?? 0, v.crew, v.crewFatigue ?? 0);
  depot.crew += v.crew;
  v.crewFatigue = 0;
  v.cargo = {};
  v.crew = 0;
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
        if (v.owner === 'player') pushNews(s, `${v.name} has broken down!`, 'bad', { vehicleId: v.id });
        return;
      }
      break;
  }

  // Driving.
  const route = v.route!;
  const path = getCityPath(world, route.from, route.to);
  route.progress += getModel(v.modelId).speed;
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
  // Worn kit can pack up on the night (once per show day).
  const working: GearStock = { ...delivered };
  const showDays = gig.overseas ? gig.overseas.stops.length : (gig.days ?? 1);
  const failures: Failure[] = [];
  for (let d = 0; d < Math.min(4, showDays); d++) {
    const f = rollFailure(s, working, rng);
    if (f) failures.push(f);
  }
  const gear = evaluateGear(working, gig, yearOf(s, s.hour), s.gearCondition);
  wearFromShow(s, delivered, showDays, !!gig.overseas);
  const failureNote = failures.length
    ? ` ${failures.map(f => `${getProduct(f.productId).brand} ${getProduct(f.productId).name}`).join(' and ')} died mid-set.`
    : '';
  const onSiteIds = new Set(onSite.map(v => v.id));
  const techIds = s.techs.filter(t => t.vehicleId && onSiteIds.has(t.vehicleId)).map(t => t.techId);
  const gearCoverage = gear.coverage;
  // Tired crews are worth less on the night.
  const effCrew = onSite.reduce((sum, v) => sum + effectiveCrew(v), 0);
  const crewCoverage = Math.min(1, effCrew / Math.max(1, gig.crewNeeded));
  const lastArrival = Math.max(...onSite.map(v => v.arrivedHour ?? 0), 0);
  const lateHours = onSite.length ? Math.max(0, lastArrival - loadInHour(gig)) : 0;
  const quality = Math.max(
    0,
    Math.min(
      1,
      baseShowQuality({ gearCoverage, crewCoverage, lateHours, gearQuality: gear.quality, riderMet: gear.riderMet, bonus: techBonus(techIds, gig.act) + moraleBonus(s.crewMorale) }) +
        (rng.next() - 0.5) * 0.08,
    ),
  );
  const resultExtras = { gearQuality: gear.quality, riderMet: gear.riderMet, techs: techIds.length ? techIds : undefined };
  const tw = TIER_WEIGHT[gig.tier];
  const rating = s.cityRatings[gig.cityId] ?? 50;

  if (!onSite.length || quality < 0.3) {
    const penalty = Math.round(gig.fee * NO_SHOW_PENALTY_RATE);
    book(s, 'penalties', -penalty);
    gig.status = 'failed';
    gig.result = { quality, payout: -penalty, lateHours, gearCoverage, crewCoverage, ...resultExtras };
    s.company.reputation = Math.max(0, s.company.reputation - 4 * tw);
    s.cityRatings[gig.cityId] = Math.max(0, rating - 20);
    s.stats.showsFailed += 1;
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

  const payout = Math.round(gig.fee * (0.35 + 0.65 * quality));
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
  s.company.reputation = reputationAfterShow(s.company.reputation, gig.tier, quality);
  s.cityRatings[gig.cityId] = Math.max(0, Math.min(100, rating + (quality - 0.5) * 30));
  s.stats.showsPlayed += 1;
  const verdict = quality >= 0.9 ? 'Storming show' : quality >= 0.7 ? 'Solid show' : 'Rough show';
  const riderNote = gear.riderMet === undefined ? '' : gear.riderMet ? ` Rider (${gig.rider!.brand}) honoured.` : ` They wanted ${gig.rider!.brand} and didn't get it.`;
  const kitNote = gear.quality < 0.8 ? ' Reviewers called the kit dated.' : '';
  const techNote = techIds.length ? ` ${techIds.map(id => getTech(id).name).join(' & ')} on the crew.` : '';
  pushNews(s, `${verdict}: ${gig.act} at ${where} — ${Math.round(quality * 100)}%, earned ${formatMoney(s, payout)}.${failureNote}${riderNote}${kitNote}${techNote}`, quality >= 0.7 ? 'good' : 'info', {
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
  }
  announceModels(s, date.getUTCFullYear());
  announceGear(s, date.getUTCFullYear());
  updateRivals(s, world, date.getUTCFullYear());

  // Running costs and wages land every day — idle trucks and idle crew cost money.
  const wages = Math.round(totalCrew(s) * crewWage(s)) + s.techs.reduce((sum, t) => sum + getTech(t.techId).wagePerDay, 0);
  book(s, 'wages', -wages);
  dailyMarket(s, wages);
  updateTechs(s, date.getUTCFullYear());
  dailyWorkshop(s);
  dailyCrew(s);
  s.vehicles.forEach(v => {
    if (v.owner !== 'player') return;
    const model = getModel(v.modelId);
    const cost = Math.round(model.runningCostPerYear / 365);
    book(s, 'running', -cost);
    v.profitThisYear -= cost;
    const decay = vehicleAgeYears(v, s.hour) > model.lifespanYears ? 0.3 : 0.12;
    v.reliability = Math.max(10, v.reliability - decay);
  });

  dailyOffers(s, world, rng);
  rivalsTakeOffers(s, world, rng);
  dailyTours(s, world, rng);
  dailyFestivals(s, world, rng);
  pruneGigs(s);

  // Nag about booked shows with nothing assigned two days out.
  s.gigs.forEach(gig => {
    if (gig.status !== 'booked' || gig.day - day !== 2) return;
    const assigned = s.vehicles.some(v => v.owner === 'player' && v.orders.includes(gig.id));
    if (!assigned) {
      pushNews(s, `${gig.act} plays in 2 days and no vehicles are assigned!`, 'bad', { cityId: gig.cityId, gigId: gig.id });
    }
  });

  if (date.getUTCDate() === 1 && day > 0) monthlyTick(s, rng);
  s.stats.peakCash = Math.max(s.stats.peakCash, s.company.cash);
}

function monthlyTick(s: TycoonState, rng: Rng) {
  book(s, 'property', -s.depots.length * DEPOT_UPKEEP_PER_MONTH);
  monthlyWorkshop(s);
  monthlyCrew(s, rng);
  if (s.company.loan > 0) book(s, 'interest', -monthlyInterest(s));

  // During a shutdown the banks give everyone a repayment holiday.
  if (s.company.cash < 0 && marketNow(s).shutdown) {
    pushNews(s, 'Month closed in the red — the bank is giving the whole industry breathing room until venues reopen.', 'info');
  } else if (s.company.cash < 0) {
    s.negativeMonths += 1;
    if (s.negativeMonths >= NEGATIVE_MONTHS_GAME_OVER) {
      s.gameOver = {
        hour: s.hour,
        reason: `${s.company.name} spent ${s.negativeMonths} months in the red and the bank has called in the receivers.`,
      };
      pushNews(s, s.gameOver.reason, 'big');
    } else {
      pushNews(
        s,
        `Month closed in the red. ${NEGATIVE_MONTHS_GAME_OVER - s.negativeMonths} more and the bank shuts you down.`,
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
