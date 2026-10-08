/**
 * Tours: an artist's run of dates sold as one contract.
 *
 * - National tours: 3-6 dates in different towns, ordered so one convoy can
 *   drive venue to venue (a vehicle's order list *is* the tour route).
 * - World tours: a domestic run (stadium + arenas) then one or two overseas
 *   legs. Each leg is a single gig at the airport: trucks hand the rig over
 *   for air freight, it plays the run abroad, and comes home.
 *
 * Book the whole tour or none of it; play every date for the completion bonus.
 */
import type { Rng } from '@/lib/rng';
import { getModel } from './catalog';
import { actReputationBar, reachWeight, tourBookingBar } from './standing';
import { artistsTouringAt, homeWeight, type Artist } from './content/artists';
import { REGIONS } from './content/world';
import { book, dateOfDay, dayOf, formatMoney, gigById, newId, pushNews } from './core';
import { actName, buildGig } from './offers';
import { roadDistance } from './pathfinding';
import type { Gig, OverseasStop, Tour, TycoonState, Venue, Vehicle, WorldMap } from './types';

const NATIONAL_TOUR_CHANCE = 0.08;
const WORLD_TOUR_CHANCE = 0.035;
const NATIONAL_BONUS = 0.25;
const WORLD_BONUS = 0.3;
/** Planning speed for spacing dates (tiles/hour) — a little slower than a Luton. */
const PLANNING_SPEED = 1.3;

function shuffled<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickTourArtist(state: TycoonState, year: number, tier: number, rng: Rng, reachableOnly = false): Artist | null {
  const touring = artistsTouringAt(year, tier, state.country).filter(a => !reachableOnly || reachWeight(state, a.name) === 1);
  if (!touring.length) return null;
  const weights = touring.map(a => (1 + (state.artistRelations[a.name] ?? 0) * 2) * homeWeight(a) * reachWeight(state, a.name));
  let roll = rng.next() * weights.reduce((x, y) => x + y, 0);
  for (let i = 0; i < touring.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return touring[i];
  }
  return touring[touring.length - 1];
}

/** One venue per town, visited in nearest-neighbour order from a random start. */
function routeVenues(world: WorldMap, venues: Venue[], count: number, rng: Rng): Venue[] {
  const perCity = new Map<string, Venue>();
  venues.forEach(v => {
    if (!perCity.has(v.cityId) || rng.chance(0.5)) perCity.set(v.cityId, v);
  });
  const pool = [...perCity.values()].sort((a, b) => a.id.localeCompare(b.id));
  if (!pool.length) return [];
  const route = [pool.splice(rng.nextInt(pool.length), 1)[0]];
  while (route.length < count && pool.length) {
    const last = route[route.length - 1];
    pool.sort((a, b) => roadDistance(world, last.cityId, a.cityId) - roadDistance(world, last.cityId, b.cityId));
    route.push(pool.shift()!);
  }
  return route;
}

function travelDays(world: WorldMap, from: string, to: string): number {
  return Math.ceil(roadDistance(world, from, to) / PLANNING_SPEED / 24);
}

function domesticRun(state: TycoonState, world: WorldMap, rng: Rng, act: string, tourId: string, route: Venue[], startDay: number, real = true): Gig[] {
  const gigs: Gig[] = [];
  let day = startDay;
  route.forEach((venue, i) => {
    if (i > 0) day += 1 + travelDays(world, route[i - 1].cityId, venue.cityId) + rng.nextInt(2);
    gigs.push(buildGig(state, rng, { venue, day, act, real, tourId }));
  });
  return gigs;
}

/** `reachableOnly`: only acts that would actually hire you today (the starter tour). */
export function generateNationalTour(state: TycoonState, world: WorldMap, rng: Rng, forceTier?: number, reachableOnly = false): Tour | null {
  const today = dayOf(state.hour);
  const year = dateOfDay(state, today).getUTCFullYear();
  // Small-room tours for up-and-coming acts, theatre runs, arena tours.
  const roll = rng.next();
  const tier = forceTier ?? (roll < 0.4 ? 1 : roll < 0.8 ? 2 : 3);
  // Club tours by acts nobody's heard of yet, when the real names wouldn't take your call.
  const anyInReach = artistsTouringAt(year, tier, state.country).some(a => reachWeight(state, a.name) === 1);
  const upAndComing = tier === 1 && !anyInReach && (reachableOnly || rng.chance(0.5));
  const artist = upAndComing ? null : pickTourArtist(state, year, tier, rng, reachableOnly);
  if (!artist && !upAndComing) return null;
  const act = artist?.name ?? actName(rng);
  const venues = world.cities.flatMap(c => c.venues).filter(v => v.tier === tier && v.kind !== 'airport');
  const route = routeVenues(world, venues, 3 + rng.nextInt(4), rng);
  if (route.length < 3) return null;

  const tourId = newId(state, 'tour');
  const gigs = domesticRun(state, world, rng, act, tourId, route, today + 12 + rng.nextInt(8), !!artist);
  const total = gigs.reduce((sum, g) => sum + g.fee, 0);
  return finishTour(state, gigs, {
    id: tourId,
    act,
    name: `${act} — ${year} ${['', 'Club', 'Theatre', 'Arena'][tier]} Tour`,
    kind: 'national',
    gigIds: gigs.map(g => g.id),
    bonus: Math.round((total * NATIONAL_BONUS) / 100) * 100,
    acceptByDay: today + 5 + rng.nextInt(4),
    status: 'offer',
  });
}

export function generateWorldTour(state: TycoonState, world: WorldMap, rng: Rng): Tour | null {
  const today = dayOf(state.hour);
  const year = dateOfDay(state, today).getUTCFullYear();
  const tier = rng.chance(0.6) ? 4 : 3;
  const artist = pickTourArtist(state, year, tier, rng);
  if (!artist) return null;
  const airport = world.cities.flatMap(c => c.venues).find(v => v.kind === 'airport');
  if (!airport) return null;

  // Home dates: the stadium (for stadium acts) plus a couple of arenas.
  const stadiums = tier === 4 ? world.cities.flatMap(c => c.venues).filter(v => v.kind === 'stadium') : [];
  const arenas = world.cities.flatMap(c => c.venues).filter(v => v.kind === 'arena');
  const route = [...stadiums.slice(0, 1), ...routeVenues(world, arenas, 1 + rng.nextInt(2), rng)];
  const tourId = newId(state, 'tour');
  const gigs = domesticRun(state, world, rng, artist.name, tourId, route, today + 16 + rng.nextInt(8));

  // Then one or two legs abroad, flown out of the airport.
  // Legs abroad never "fly" to your own country's cities.
  const regions = REGIONS.map(r => ({ ...r, cities: r.cities.filter(c => c.code !== state.country) })).filter(r => r.cities.length >= 3);
  const legs = shuffled(regions, rng).slice(0, rng.chance(0.4) ? 2 : 1);
  let lastDay = gigs[gigs.length - 1].day;
  let lastCity = gigs[gigs.length - 1].cityId;
  let homeFreight = 0;
  legs.forEach(region => {
    const first = lastDay + homeFreight + travelDays(world, lastCity, airport.cityId) + region.freightDays + 2;
    const cities = shuffled(region.cities, rng).slice(0, 3 + rng.nextInt(Math.min(3, region.cities.length - 2)));
    const stops: OverseasStop[] = cities.map((c, i) => ({
      city: c.city,
      country: c.country,
      venue: tier === 4 ? c.stadium : c.arena,
      day: first + i * 2,
    }));
    const gig = buildGig(state, rng, {
      venue: airport,
      day: first,
      act: artist.name,
      real: true,
      tier,
      feeMultiplier: stops.length * 1.3,
      tourId,
    });
    gig.overseas = { regionId: region.id, stops };
    gigs.push(gig);
    lastDay = stops[stops.length - 1].day;
    lastCity = airport.cityId;
    homeFreight = region.freightDays;
  });

  const total = gigs.reduce((sum, g) => sum + g.fee, 0);
  return finishTour(state, gigs, {
    id: tourId,
    act: artist.name,
    name: `${artist.name} — ${year} World Tour`,
    kind: 'world',
    gigIds: gigs.map(g => g.id),
    bonus: Math.round((total * WORLD_BONUS) / 100) * 100,
    acceptByDay: today + 6 + rng.nextInt(5),
    status: 'offer',
  });
}

function finishTour(state: TycoonState, gigs: Gig[], tour: Tour): Tour {
  gigs.forEach(g => {
    g.acceptByDay = tour.acceptByDay;
    state.gigs.push(g);
  });
  state.tours.push(tour);
  return tour;
}

export function tourGigs(state: TycoonState, tour: Tour): Gig[] {
  return tour.gigIds.map(id => gigById(state, id)).filter((g): g is Gig => !!g);
}

export function tourMaxTier(state: TycoonState, tour: Tour): number {
  return Math.max(...tourGigs(state, tour).map(g => g.tier));
}

function rivalTruck(state: TycoonState, rivalId: string, homeCityId: string, tier: number, orders: string[]): Vehicle {
  const modelId = tier >= 4 ? 'artic-40' : tier === 3 ? 'rigid-7t' : 'luton-box';
  return {
    id: newId(state, 'rv'),
    owner: rivalId,
    modelId,
    name: `${getModel(modelId).name}`,
    homeCityId,
    boughtHour: state.hour,
    reliability: 90,
    lastServiceHour: state.hour,
    status: 'parked',
    cityId: homeCityId,
    orders,
    cargo: {},
    crew: 0,
    profitThisYear: 0,
    profitLastYear: 0,
  };
}

/** Daily: new tour offers, rival bids, expiry, and paying out finished tours. */
export function dailyTours(state: TycoonState, world: WorldMap, rng: Rng) {
  const today = dayOf(state.hour);

  if (rng.chance(NATIONAL_TOUR_CHANCE)) {
    const t = generateNationalTour(state, world, rng);
    if (t && canBookTour(state, t)) pushNews(state, `Tour offer: ${t.name} — ${t.gigIds.length} dates. Check Shows → Tours.`, 'big');
    else if (t) pushNews(state, `${t.name} announced — promoters want an established crew.`, 'info');
  }
  if (rng.chance(WORLD_TOUR_CHANCE)) {
    const t = generateWorldTour(state, world, rng);
    if (t && canBookTour(state, t)) pushNews(state, `World tour up for grabs: ${t.name}. Check Shows → Tours.`, 'big');
    else if (t) pushNews(state, `${t.name} announced — the big firms are bidding.`, 'info');
  }

  const crowding = Math.min(1, 5 / Math.max(1, state.rivals.length));
  state.tours.forEach(tour => {
    const gigs = tourGigs(state, tour);
    if (tour.status === 'offer') {
      if (tour.acceptByDay < today) {
        tour.status = 'expired';
        gigs.forEach(g => (g.status = 'expired'));
        return;
      }
      const maxTier = Math.max(...gigs.map(g => g.tier));
      const asked = gigs.some(g => g.asksForYou);
      const actBar = actReputationBar(state, tour.act, false);
      for (const rival of state.rivals) {
        if (maxTier > rival.maxTier || maxTier < rival.minTier) continue; // only tours in their league
        if (rival.reputation < actBar - 5) continue;
        if (!rng.chance(0.07 * crowding * (asked ? 0.25 : 1))) continue;
        tour.status = 'rival';
        tour.rivalId = rival.id;
        gigs.forEach(g => {
          g.status = 'rival';
          g.rivalId = rival.id;
        });
        state.vehicles.push(rivalTruck(state, rival.id, rival.hqCityId, maxTier, gigs.map(g => g.id)));
        pushNews(state, `${rival.name} lands ${tour.name}.`, 'info');
        break;
      }
      return;
    }
    if (tour.status !== 'booked' || gigs.some(g => g.status === 'booked')) return;
    if (gigs.every(g => g.status === 'done')) {
      tour.status = 'done';
      book(state, 'shows', tour.bonus);
      state.artistRelations[tour.act] = (state.artistRelations[tour.act] ?? 0) + 2;
      state.company.reputation = Math.min(100, state.company.reputation + (tour.kind === 'world' ? 3 : 1.5));
      pushNews(state, `Tour complete! ${tour.name} wrapped — completion bonus ${formatMoney(state, tour.bonus)}.`, 'good');
    } else {
      tour.status = 'failed';
      pushNews(state, `${tour.name} finished with dropped dates — no completion bonus.`, 'bad');
    }
  });

  // Forget long-finished tours.
  state.tours = state.tours.filter(t => t.status === 'offer' || t.status === 'booked' || tourGigs(state, t).length > 0);
}

export function canBookTour(state: TycoonState, tour: Tour): boolean {
  return !tourBookingBar(state, tour, tourMaxTier(state, tour)).reason;
}
