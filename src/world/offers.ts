/**
 * The contract market: every city's venues post show offers at a rate set by
 * population, so the metropolis is busy and villages are quiet — the map's
 * geography *is* the demand curve. Rivals snap up offers they're close to.
 */
import { rollTechSpec } from './techRider';
import { defaultTerms } from './terms';
import { offerBlocked } from './blacklist';
import { rivalTryTake } from './rivalOps';
import { worldOf } from './mapgen';
import { RIVAL_COMPANIES } from './content/companies';
import { traitsOf } from './venueTraits';
import { FIESTA_OFFER_BOOST, councilBooked, isFiestaSeason, needsMeister, needsReliefCrew, ruleCountry } from './rules';
import { priceWarFactor, warWinBonus } from './pricewars';
import { intelFactor } from './rivalry';
import { difficultyOf } from './scenario';
import { offerBuzz } from './marketing';
import { relationFeeBonus, relationOfferWeight } from './promoters';
import { townGrowth } from './towns';
import type { Rng } from '@/lib/rng';
import { tierInfo } from './catalog';
import { TEAM_PACE, dateOfDay, dayOf, newId, pushNews, yearOf } from './core';
import { VENUE_YEARS, closuresIn, openingsIn, reopeningsIn, venueOpenIn } from './content/venueYears';
import { artistsTouringAt, homeWeight } from './content/artists';
import { expectedQuality, productsAvailableIn } from './content/gear';
import { roadDistance } from './pathfinding';
import { actReputationBar, reachWeight } from './standing';
import { marketNow, marketOnDay } from './market';
import { holdsContractAt } from './contracts';
import { salesBoost } from './facilities';
import type { City, CitySize, DeptCounts, Gig, Rider, Rival, TycoonState, Vehicle, Venue, WorldMap } from './types';
import { DEPTS } from './types';

const ACT_ADJ = ['Velvet', 'Electric', 'Midnight', 'Neon', 'Broken', 'Golden', 'Silent', 'Wild', 'Paper', 'Crimson', 'Lunar', 'Static'];
const ACT_NOUN = ['Foxes', 'Engines', 'Harbour', 'Satellites', 'Ravens', 'Tides', 'Machines', 'Daughters', 'Avenue', 'Comets', 'Wolves', 'Choir'];
const SOLO = ['DJ Kestrel', 'Mara Lux', 'Otis Vane', 'Juno Reyes', 'The Okafor Trio', 'Kit Malone', 'Sable', 'Ivo & the Weather'];

export function actName(rng: Rng): string {
  if (rng.chance(0.3)) return rng.pick(SOLO);
  return `${rng.chance(0.6) ? 'The ' : ''}${rng.pick(ACT_ADJ)} ${rng.pick(ACT_NOUN)}`;
}

export function generateOffer(
  state: TycoonState,
  world: WorldMap,
  city: City,
  rng: Rng,
  opts: { minLeadDays?: number; maxTier?: number } = {},
): Gig | null {
  const minLeadDays = opts.minLeadDays ?? 6;
  const leadYear = yearOf(state, state.hour + minLeadDays * 24);
  const venues = city.venues.filter(v => v.kind !== 'airport' && v.tier <= (opts.maxTier ?? 4) && venueOpenIn(v.name, leadYear));
  if (!venues.length) return null;
  // Smaller rooms book far more often than stadiums.
  const weights = venues.map(v => (5 - v.tier) * relationOfferWeight(state, v.id));
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = rng.next() * total;
  let venue = venues[0];
  for (let i = 0; i < venues.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      venue = venues[i];
      break;
    }
  }

  const today = dayOf(state.hour);
  const day = today + rng.nextRange(minLeadDays, minLeadDays + 14);
  if (marketOnDay(state, day).shutdown) return null;
  const year = dateOfDay(state, day).getUTCFullYear();
  const { act, real } = pickAct(state, venue.tier, year, rng);
  const gig = buildGig(state, rng, { venue, day, act, real });
  gig.acceptByDay = Math.min(day - 3, today + rng.nextRange(3, 7));
  gig.fee = Math.round((gig.fee * relationFeeBonus(state, venue.id) * priceWarFactor(state, city.id)) / 10) * 10;
  if (traitsOf(world, venue).loadIn === 'stairs') gig.crewNeeded += 1;
  return gig;
}

export interface GigSpec {
  venue: Venue;
  day: number;
  act: string;
  real: boolean;
  /** Override the tier used for the rider/fee (overseas legs). */
  tier?: number;
  feeMultiplier?: number;
  tourId?: string;
  days?: number;
  /** Scales gear and crew needs (festival main stages are bigger). */
  needsScale?: number;
  festival?: Gig['festival'];
}

/** Rolls the rider, needs and fee for one show. */
/**
 * Production budgets by country: American promoters pay more (and the haulage across a continent is in
 * the price), so a US company isn't sunk by its distances.
 */
export const COUNTRY_FEES: Record<string, number> = { US: 1.45 };

export function buildGig(state: TycoonState, rng: Rng, spec: GigSpec): Gig {
  const tier = spec.tier ?? spec.venue.tier;
  const info = tierInfo(tier);
  const needs = {} as DeptCounts;
  const showYear = dateOfDay(state, spec.day).getUTCFullYear();
  DEPTS.forEach(d => {
    // Nobody asks for kit that hasn't been invented yet (no video screens in 1975).
    if (!productsAvailableIn(showYear, d).length) {
      needs[d] = 0;
      return;
    }
    const base = info.needs[d];
    if (d === 'console') {
      // FOH always; monitor world from club level up; a spare/broadcast desk at stadiums.
      needs[d] = base;
      return;
    }
    const swing = base === 0 ? (rng.chance(0.15) ? 1 : 0) : rng.nextRange(-1, Math.ceil(base * 0.25) + 1);
    needs[d] = Math.max(0, Math.round((base + swing) * (spec.needsScale ?? 1)));
  });
  const year = dateOfDay(state, spec.day).getUTCFullYear();
  const rating = state.cityRatings[spec.venue.cityId] ?? 50;
  const asksForYou = ((spec.real || !!spec.festival) && (state.artistRelations[spec.act] ?? 0) > 0) || holdsContractAt(state, spec.venue.id);
  const rider = tier >= 2 && rng.chance(spec.real ? 0.55 : 0.25) ? pickRider(needs, tier, year, rng) : undefined;
  const star = spec.real ? 1.15 : 1;
  const loyalty = asksForYou ? 1.1 : 1;
  const fee =
    Math.round((info.baseFee * marketOnDay(state, spec.day).fees * (0.85 + rng.next() * 0.4) * (0.9 + rating / 500) * star * loyalty * (spec.feeMultiplier ?? 1) * (COUNTRY_FEES[state.country ?? ''] ?? 1)) / 50) * 50;

  // National rules (rules.ts): who books, who must be aboard, how many hands.
  const world = worldOf(state);
  const country = ruleCountry(state, world, spec.venue.cityId);
  const town = world.cityById.get(spec.venue.cityId);
  const showDate = dateOfDay(state, spec.day);
  const council = !spec.festival && !spec.tourId && councilBooked(country, town?.size ?? 'city', showDate, tier);
  const meister = needsMeister(country, year, tier);
  const relief = needsReliefCrew(country, year, tier, spec.days ?? 1);
  const baseCrew = Math.round((info.crew + rng.nextInt(tier)) * (spec.needsScale ?? 1));

  const gig: Gig = {
    id: newId(state, 'gig'),
    act: spec.act,
    venueId: spec.venue.id,
    cityId: spec.venue.cityId,
    tier,
    day: spec.day,
    acceptByDay: spec.day - 3,
    needs,
    crewNeeded: baseCrew + (relief ? 1 : 0),
    council: council || undefined,
    meister: meister || undefined,
    relief: relief || undefined,
    fee,
    rider,
    asksForYou: asksForYou || undefined,
    tourId: spec.tourId,
    days: spec.days,
    festival: spec.festival,
    status: 'offer',
  };
  gig.techSpec = rollTechSpec(state.mapSeed, gig, year, spec.real);
  gig.terms = defaultTerms(gig);
  return gig;
}

/** Share of shows at each tier played by real touring acts (the rest are local bands). */
const REAL_ACT_SHARE = [0, 0.3, 0.7, 1, 1];

export function pickAct(state: TycoonState, tier: number, year: number, rng: Rng): { act: string; real: boolean } {
  const touring = artistsTouringAt(year, tier, state.country);
  if (!touring.length || !rng.chance(REAL_ACT_SHARE[tier])) return { act: actName(rng), real: false };
  // Acts you've done well by are more likely to come back to you.
  const weights = touring.map(a => (1 + (state.artistRelations[a.name] ?? 0) * 2) * homeWeight(a) * reachWeight(state, a.name));
  let roll = rng.next() * weights.reduce((x, y) => x + y, 0);
  for (let i = 0; i < touring.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return { act: touring[i].name, real: true };
  }
  return { act: touring[touring.length - 1].name, real: true };
}

/** Riders name a current, decent brand in one of the show's departments. */
function pickRider(needs: DeptCounts, tier: number, year: number, rng: Rng): Rider | undefined {
  const depts = DEPTS.filter(d => needs[d] > 0 && d !== 'stage');
  if (!depts.length) return undefined;
  const dept = rng.pick(depts);
  const bar = expectedQuality(tier, year) - 1.5;
  const products = productsAvailableIn(year, dept);
  const good = products.filter(p => p.quality >= bar);
  const brands = [...new Set((good.length ? good : products).map(p => p.brand))].sort();
  if (!brands.length) return undefined;
  return { dept, brand: rng.pick(brands) };
}

/** Daily chance of a new show offer, by how much venue a town has (not raw population). */
const OFFER_RATE: Record<CitySize, number> = { village: 0.05, town: 0.075, city: 0.15, metropolis: 0.36 };

/** Towns you've done proud ask for you more; towns you've let down go quiet (rating 50 is neutral). */
export const localFame = (state: TycoonState, cityId: string) => 1 + ((state.cityRatings[cityId] ?? 50) - 50) / 250;

/** New Year: landmark rooms that open, close for rebuilding, or reopen this year. */
export function yearlyVenues(state: TycoonState, world: WorldMap, year: number) {
  const find = (name: string) => world.cities.flatMap(c => c.venues.map(v => ({ v, c }))).find(x => x.v.name === name);
  openingsIn(year).forEach(name => {
    const hit = find(name);
    if (hit) pushNews(state, `${name} opens in ${hit.c.name}${VENUE_YEARS[name].note ? ` — ${VENUE_YEARS[name].note}` : ''}. A new room for ${['', 'club', 'theatre', 'arena', 'stadium'][hit.v.tier]}-sized shows.`, 'big', { cityId: hit.c.id });
  });
  reopeningsIn(year).forEach(name => {
    const hit = find(name);
    if (hit) pushNews(state, `${name} reopens in ${hit.c.name}${VENUE_YEARS[name].note ? ` — ${VENUE_YEARS[name].note}` : ''}.`, 'big', { cityId: hit.c.id });
  });
  closuresIn(year).forEach(name => {
    const hit = find(name);
    if (hit) pushNews(state, `${name} in ${hit.c.name} closes for rebuilding. No shows there until it reopens.`, 'info', { cityId: hit.c.id });
  });
}

export function dailyOffers(state: TycoonState, world: WorldMap, rng: Rng) {
  const { demand } = marketNow(state);
  const season = isFiestaSeason(new Date(Date.UTC(state.startYear, 0, 1) + (dayOf(state.hour) + 10) * 86400000));
  world.cities.forEach(city => {
    const fiesta = season && state.country === 'ES' && (city.size === 'village' || city.size === 'town') ? FIESTA_OFFER_BOOST : 1;
    const chance = OFFER_RATE[city.size] * fiesta * demand * localFame(state, city.id) * townGrowth(state, city.id) * offerBuzz(state) * (1 + salesBoost(state, world, city.id));
    if (rng.chance(chance)) {
      const gig = generateOffer(state, world, city, rng);
      if (gig && !offerBlocked(state, gig)) state.gigs.push(gig);
    }
  });
  // Just over the border: promoters there call foreign crews less often — but they do call.
  world.abroad.forEach(city => {
    const chance = OFFER_RATE[city.size] * ABROAD_OFFER_SHARE * demand * localFame(state, city.id) * offerBuzz(state);
    if (rng.chance(chance)) {
      const gig = generateOffer(state, world, city, rng, { minLeadDays: 9 });
      if (gig && !offerBlocked(state, gig)) state.gigs.push(gig);
    }
  });
}

/** How often a town abroad offers you a show, relative to a home town of its size. */
export const ABROAD_OFFER_SHARE = 0.45;

function rivalVehicleModel(tier: number): string {
  if (tier >= 4) return 'artic-40';
  if (tier === 3) return 'rigid-7t';
  return 'luton-box';
}

/** A rival already working an area finds the next date there easier: cluster of dates within these limits. */
export const RIVAL_RUN_TILES = 24;
export const RIVAL_RUN_DAYS = 4;
const RIVAL_RUN_BONUS = 1.45;

/** The dates a rival already holds near `gig` (same area, a few days either side). */
export function rivalNearbyDates(state: TycoonState, world: WorldMap, rivalId: string, gig: Gig): Gig[] {
  const today = dayOf(state.hour);
  return state.gigs.filter(g => {
    if (g.rivalId !== rivalId || g.status !== 'rival' || g.id === gig.id || g.day < today - 1) return false;
    if (Math.abs(g.day - gig.day) > RIVAL_RUN_DAYS) return false;
    const d = roadDistance(world, g.cityId, gig.cityId);
    return Number.isFinite(d) && d <= RIVAL_RUN_TILES;
  });
}

/** Can that rival's existing truck add this date to its run (enough time to get there)? */
function runnableTruck(state: TycoonState, world: WorldMap, rivalId: string, gig: Gig): Vehicle | undefined {
  const dates = rivalNearbyDates(state, world, rivalId, gig);
  return state.vehicles.find(v => {
    if (v.owner !== rivalId || !v.orders.length) return false;
    return v.orders.every(id => {
      const g = state.gigs.find(x => x.id === id);
      if (!g) return false;
      const gap = Math.abs(gig.day - g.day);
      const d = roadDistance(world, g.cityId, gig.cityId);
      return gap >= 1 && Number.isFinite(d) && (gap >= 2 || d <= 8) && dates.some(n => n.id === g.id);
    });
  });
}

/** What a rival can do, by era and size: team drivers, freight between cities, work abroad. */
export function rivalReach(state: TycoonState, world: WorldMap, rival: Rival, gig: Gig) {
  const year = yearOf(state, state.hour);
  const template = RIVAL_COMPANIES.find(t => t.id === rival.id);
  const international = !!template?.countries.includes('*');
  const big = international || rival.reputation >= 55 || rival.maxTier >= 3;
  const hq = world.cityById.get(rival.hqCityId);
  const town = world.cityById.get(gig.cityId);
  const bigTowns = (c?: { size: string }) => c?.size === 'city' || c?.size === 'metropolis';
  return {
    international,
    abroad: !!town?.abroad,
    pace: big && year >= 1990 ? TEAM_PACE / (world.era?.soloPace ?? 1) : 1,
    freight: big && year >= 1995 && bigTowns(hq) && bigTowns(town) && !town?.abroad,
  };
}

/** Rivals bid on open offers near their HQ; the player's local standing makes them less likely to win. */
export function rivalsTakeOffers(state: TycoonState, world: WorldMap, rng: Rng) {
  const today = dayOf(state.hour);
  state.gigs.forEach(gig => {
    if (gig.status !== 'offer' || gig.tourId || gig.festival || (gig.event && !gig.event.citywide)) return; // tours are bid on as a whole; festivals and events by tender
    if (gig.acceptByDay < today) {
      gig.status = 'expired';
      return;
    }
    if (holdsContractAt(state, gig.venueId)) return; // the house supplier gets first call
    const rating = state.cityRatings[gig.cityId] ?? 50;
    const actBar = actReputationBar(state, gig.act, false);
    for (const rival of state.rivals) {
      if (rival.reputation < actBar - 5) continue; // the act's management wouldn't call them either
      const rawDist = roadDistance(world, rival.hqCityId, gig.cityId);
      if (!Number.isFinite(rawDist)) continue;
      // The bigger houses run team drivers on the long hauls (from 1990) and fly kit between the cities (from 1995).
      const reach = rivalReach(state, world, rival, gig);
      const dist = rawDist / reach.pace;
      const proximity = Math.max(dist < 14 ? 1.6 : dist < 32 ? 1 : 0.45, reach.freight ? 0.9 : 0);
      // Over the border only the international houses (and neighbours) have the contacts.
      const abroadFactor = reach.abroad ? (reach.international ? 1.3 : rawDist < 30 ? 0.6 : 0.05) : 1;
      const fit = gig.tier >= rival.minTier && gig.tier <= rival.maxTier ? 1 : 0.05;
      const mainDept = DEPTS.reduce((a, b) => (gig.needs[b] > gig.needs[a] ? b : a));
      const specialty = mainDept === rival.specialty ? 1.3 : 1;
      const loyalty = gig.asksForYou ? 0.25 : 1;
      // More firms in the market split the work between them.
      const crowding = Math.min(1, 5 / state.rivals.length);
      // Already working the area? The next date there is easy money (a run, like yours).
      const nearby = rivalNearbyDates(state, world, rival.id, gig);
      const onARun = nearby.length ? RIVAL_RUN_BONUS * (nearby.length > 1 ? 1.15 : 1) : 1;
      const chance = 0.05 * difficultyOf(state).rivals * warWinBonus(state, gig.cityId, rival.id) * intelFactor(state, rival.id) * crowding * proximity * fit * specialty * loyalty * onARun * abroadFactor * (1.15 - (rating / 100) * 0.6);
      if (!rng.chance(chance)) continue;
      // Same rules as you: kit, crew and a truck free; the rider and the room met (or paid for).
      if (!rivalTryTake(state, world, rival, gig)) continue;

      gig.status = 'rival';
      gig.rivalId = rival.id;
      if (reach.freight && rawDist >= 32) {
        // Flown or railed in: no truck on the road, just a line in the news.
        pushNews(state, `${rival.name} is sending kit by ${yearOf(state, state.hour) >= 1995 && world.cityById.get(gig.cityId)?.size !== 'town' ? 'air' : 'rail'} freight for ${gig.act} at ${world.venueById.get(gig.venueId)?.name}, ${world.cityById.get(gig.cityId)?.name}.`, 'info', { cityId: gig.cityId, gigId: gig.id });
        break;
      }
      // The same truck takes it if the timing works; otherwise they send another.
      const sameTruck = nearby.length ? runnableTruck(state, world, rival.id, gig) : undefined;
      if (sameTruck) {
        sameTruck.orders = [...sameTruck.orders, gig.id].sort(
          (a, b) => (state.gigs.find(g => g.id === a)?.day ?? 0) - (state.gigs.find(g => g.id === b)?.day ?? 0),
        );
        pushNews(state, `${rival.name} strings ${gig.act} (${world.cityById.get(gig.cityId)?.name}) onto its run.`, 'info', { cityId: gig.cityId, gigId: gig.id });
        break;
      }
      const venue = world.venueById.get(gig.venueId);
      const city = world.cityById.get(gig.cityId);
      pushNews(state, `${rival.name} landed ${gig.act} at ${venue?.name}, ${city?.name}.`, 'info', {
        cityId: gig.cityId,
        gigId: gig.id,
      });
      const truck: Vehicle = {
        id: newId(state, 'rv'),
        owner: rival.id,
        modelId: rivalVehicleModel(gig.tier),
        name: `${rival.name} truck`,
        homeCityId: rival.hqCityId,
        boughtHour: state.hour,
        reliability: 90,
        lastServiceHour: state.hour,
        status: 'parked',
        cityId: rival.hqCityId,
        orders: [gig.id],
        cargo: {},
        crew: 0,
        profitThisYear: 0,
        profitLastYear: 0,
      };
      state.vehicles.push(truck);
      break;
    }
  });
}

/** Drop long-finished gigs so saves don't grow forever. */
export function pruneGigs(state: TycoonState) {
  const today = dayOf(state.hour);
  const referenced = new Set(state.vehicles.flatMap(v => v.orders));
  state.gigs = state.gigs.filter(gig => {
    if (referenced.has(gig.id)) return true;
    if (gig.status === 'offer' || gig.status === 'booked') return true;
    return today - gig.day < 30;
  });
}
