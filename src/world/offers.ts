/**
 * The contract market: every city's venues post show offers at a rate set by
 * population, so the metropolis is busy and villages are quiet — the map's
 * geography *is* the demand curve. Rivals snap up offers they're close to.
 */
import type { Rng } from '@/lib/rng';
import { tierInfo } from './catalog';
import { dateOfDay, dayOf, newId, pushNews } from './core';
import { artistsTouringAt, homeWeight } from './content/artists';
import { expectedQuality, productsAvailableIn } from './content/gear';
import { roadDistance } from './pathfinding';
import type { City, DeptCounts, Gig, Rider, TycoonState, Vehicle, Venue, WorldMap } from './types';
import { DEPTS } from './types';

const ACT_ADJ = ['Velvet', 'Electric', 'Midnight', 'Neon', 'Broken', 'Golden', 'Silent', 'Wild', 'Paper', 'Crimson', 'Lunar', 'Static'];
const ACT_NOUN = ['Foxes', 'Engines', 'Harbour', 'Satellites', 'Ravens', 'Tides', 'Machines', 'Daughters', 'Avenue', 'Comets', 'Wolves', 'Choir'];
const SOLO = ['DJ Kestrel', 'Mara Lux', 'Otis Vane', 'Juno Reyes', 'The Okafor Trio', 'Kit Malone', 'Sable', 'Ivo & the Weather'];

function actName(rng: Rng): string {
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
  const venues = city.venues.filter(v => v.kind !== 'airport' && v.tier <= (opts.maxTier ?? 4));
  if (!venues.length) return null;
  // Smaller rooms book far more often than stadiums.
  const weights = venues.map(v => 5 - v.tier);
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
  const year = dateOfDay(state, day).getUTCFullYear();
  const { act, real } = pickAct(state, venue.tier, year, rng);
  const gig = buildGig(state, rng, { venue, day, act, real });
  gig.acceptByDay = Math.min(day - 3, today + rng.nextRange(3, 7));
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
}

/** Rolls the rider, needs and fee for one show. */
export function buildGig(state: TycoonState, rng: Rng, spec: GigSpec): Gig {
  const tier = spec.tier ?? spec.venue.tier;
  const info = tierInfo(tier);
  const needs = {} as DeptCounts;
  DEPTS.forEach(d => {
    const base = info.needs[d];
    if (d === 'console') {
      // FOH always; monitor world from club level up; a spare/broadcast desk at stadiums.
      needs[d] = base;
      return;
    }
    const swing = base === 0 ? (rng.chance(0.15) ? 1 : 0) : rng.nextRange(-1, Math.ceil(base * 0.25) + 1);
    needs[d] = Math.max(0, base + swing);
  });
  const year = dateOfDay(state, spec.day).getUTCFullYear();
  const rating = state.cityRatings[spec.venue.cityId] ?? 50;
  const asksForYou = spec.real && (state.artistRelations[spec.act] ?? 0) > 0;
  const rider = tier >= 2 && rng.chance(spec.real ? 0.55 : 0.25) ? pickRider(needs, tier, year, rng) : undefined;
  const star = spec.real ? 1.15 : 1;
  const loyalty = asksForYou ? 1.1 : 1;
  const fee =
    Math.round((info.baseFee * (0.85 + rng.next() * 0.4) * (0.9 + rating / 500) * star * loyalty * (spec.feeMultiplier ?? 1)) / 50) * 50;

  return {
    id: newId(state, 'gig'),
    act: spec.act,
    venueId: spec.venue.id,
    cityId: spec.venue.cityId,
    tier,
    day: spec.day,
    acceptByDay: spec.day - 3,
    needs,
    crewNeeded: info.crew + rng.nextInt(tier),
    fee,
    rider,
    asksForYou: asksForYou || undefined,
    tourId: spec.tourId,
    status: 'offer',
  };
}

/** Share of shows at each tier played by real touring acts (the rest are local bands). */
const REAL_ACT_SHARE = [0, 0.3, 0.7, 1, 1];

export function pickAct(state: TycoonState, tier: number, year: number, rng: Rng): { act: string; real: boolean } {
  const touring = artistsTouringAt(year, tier, state.country);
  if (!touring.length || !rng.chance(REAL_ACT_SHARE[tier])) return { act: actName(rng), real: false };
  // Acts you've done well by are more likely to come back to you.
  const weights = touring.map(a => (1 + (state.artistRelations[a.name] ?? 0) * 2) * homeWeight(a));
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

export function dailyOffers(state: TycoonState, world: WorldMap, rng: Rng) {
  world.cities.forEach(city => {
    const chance = 0.045 + (city.population / 1_300_000) * 0.35;
    if (rng.chance(chance)) {
      const gig = generateOffer(state, world, city, rng);
      if (gig) state.gigs.push(gig);
    }
  });
}

function rivalVehicleModel(tier: number): string {
  if (tier >= 4) return 'artic-40';
  if (tier === 3) return 'rigid-7t';
  return 'luton-box';
}

/** Rivals bid on open offers near their HQ; the player's local standing makes them less likely to win. */
export function rivalsTakeOffers(state: TycoonState, world: WorldMap, rng: Rng) {
  const today = dayOf(state.hour);
  state.gigs.forEach(gig => {
    if (gig.status !== 'offer' || gig.tourId) return; // tours are bid on as a whole
    if (gig.acceptByDay < today) {
      gig.status = 'expired';
      return;
    }
    const rating = state.cityRatings[gig.cityId] ?? 50;
    for (const rival of state.rivals) {
      const dist = roadDistance(world, rival.hqCityId, gig.cityId);
      if (!Number.isFinite(dist)) continue;
      const proximity = dist < 14 ? 1.6 : dist < 32 ? 1 : 0.45;
      const fit = gig.tier >= rival.minTier && gig.tier <= rival.maxTier ? 1 : 0.05;
      const mainDept = DEPTS.reduce((a, b) => (gig.needs[b] > gig.needs[a] ? b : a));
      const specialty = mainDept === rival.specialty ? 1.3 : 1;
      const loyalty = gig.asksForYou ? 0.25 : 1;
      // More firms in the market split the work between them.
      const crowding = Math.min(1, 5 / state.rivals.length);
      const chance = 0.05 * crowding * proximity * fit * specialty * loyalty * (1.15 - (rating / 100) * 0.6);
      if (!rng.chance(chance)) continue;

      gig.status = 'rival';
      gig.rivalId = rival.id;
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
