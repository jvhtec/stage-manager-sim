/**
 * The contract market: every city's venues post show offers at a rate set by
 * population, so the metropolis is busy and villages are quiet — the map's
 * geography *is* the demand curve. Rivals snap up offers they're close to.
 */
import type { Rng } from '@/lib/rng';
import { companyTier, tierInfo } from './catalog';
import { dayOf, newId, pushNews } from './core';
import { roadDistance } from './pathfinding';
import type { City, DeptCounts, Gig, TycoonState, Vehicle, WorldMap } from './types';
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
  const venues = city.venues.filter(v => v.tier <= (opts.maxTier ?? 4));
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

  const info = tierInfo(venue.tier);
  const needs = {} as DeptCounts;
  DEPTS.forEach(d => {
    const base = info.needs[d];
    const swing = base === 0 ? (rng.chance(0.15) ? 1 : 0) : rng.nextRange(-1, Math.ceil(base * 0.25) + 1);
    needs[d] = Math.max(0, base + swing);
  });
  const today = dayOf(state.hour);
  const day = today + rng.nextRange(minLeadDays, minLeadDays + 14);
  const rating = state.cityRatings[city.id] ?? 50;
  const fee = Math.round((info.baseFee * (0.85 + rng.next() * 0.4) * (0.9 + rating / 500)) / 50) * 50;

  return {
    id: newId(state, 'gig'),
    act: actName(rng),
    venueId: venue.id,
    cityId: city.id,
    tier: venue.tier,
    day,
    acceptByDay: Math.min(day - 3, today + rng.nextRange(3, 7)),
    needs,
    crewNeeded: info.crew + rng.nextInt(venue.tier),
    fee,
    status: 'offer',
  };
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
    if (gig.status !== 'offer') return;
    if (gig.acceptByDay < today) {
      gig.status = 'expired';
      return;
    }
    const rating = state.cityRatings[gig.cityId] ?? 50;
    for (const rival of state.rivals) {
      const dist = roadDistance(world, rival.hqCityId, gig.cityId);
      if (!Number.isFinite(dist)) continue;
      const proximity = dist < 14 ? 1.6 : dist < 32 ? 1 : 0.45;
      const fit = companyTier(rival.reputation) >= gig.tier ? 1 : 0.12;
      const chance = 0.06 * proximity * fit * (1.15 - (rating / 100) * 0.6);
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
        cargo: { audio: 0, lighting: 0, video: 0, stage: 0 },
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
