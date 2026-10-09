import { describe, expect, it } from 'vitest';
import { generateWorld, getWorld, isFlat } from '../mapgen';
import { KM_PER_UNIT, getCityPath, roadDistance } from '../pathfinding';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { assignVehicle, bookGig, buildDepot, buyVehicle, borrow, repay } from '../actions';
import { HOURS_PER_DAY, LOAD_IN_HOUR, SHOW_END_HOUR } from '../catalog';
import { Terrain, type Gig, type TycoonState } from '../types';
import { projectCoverage } from '../queries';
import { stockSize } from '../loading';

const SEED = 12345;

function newGame(seed = SEED): TycoonState {
  return createTycoonGame({ companyName: 'Test Co', color: '#ff0066', seed });
}

/** Book a fresh, nearby tier-1 show `daysOut` days ahead and return its id. */
function plantGig(state: TycoonState, daysOut: number, cityId?: string): { state: TycoonState; gig: Gig } {
  const world = getWorld(state.mapSeed);
  const city = world.cityById.get(cityId ?? state.company.hqCityId)!;
  const venue = city.venues.find(v => v.tier === 1)!;
  const gig: Gig = {
    id: `test-gig-${daysOut}-${city.id}`,
    act: 'The Testers',
    venueId: venue.id,
    cityId: city.id,
    tier: 1,
    day: Math.floor(state.hour / HOURS_PER_DAY) + daysOut,
    acceptByDay: Math.floor(state.hour / HOURS_PER_DAY) + 1,
    needs: { audio: 2, console: 1, lighting: 1, video: 0, stage: 1 },
    crewNeeded: 2,
    fee: 4000,
    status: 'offer',
  };
  const next = { ...state, gigs: [...state.gigs, gig] };
  return { state: bookGig(next, gig.id).state, gig };
}

describe('world generation', () => {
  it('is deterministic for a seed', () => {
    const a = generateWorld(SEED);
    const b = generateWorld(SEED);
    expect(Array.from(a.heights)).toEqual(Array.from(b.heights));
    expect(Array.from(a.road)).toEqual(Array.from(b.road));
    expect(a.cities.map(c => c.name)).toEqual(b.cities.map(c => c.name));
  });

  it('keeps adjacent corner heights within one level', () => {
    const map = generateWorld(SEED);
    const cw = map.width + 1;
    for (let y = 0; y <= map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        expect(Math.abs(map.heights[y * cw + x] - map.heights[y * cw + x + 1])).toBeLessThanOrEqual(1);
      }
    }
  });

  it.each([1, 2, 3, 99, 4242])('connects every city by road (seed %i)', seed => {
    const map = generateWorld(seed);
    expect(map.cities.length).toBeGreaterThanOrEqual(10);
    map.cities.forEach(c => {
      expect(Number.isFinite(roadDistance(map, map.cities[0].id, c.id))).toBe(true);
    });
  });

  it.each(['ES', 'GB', 'US', 'DE', 'FR', 'IT'])('%s is a connected miniature with every town on dry land', code => {
    const map = generateWorld(SEED, code);
    expect(map.cities).toHaveLength(16);
    const land = map.terrain.reduce((n, t) => n + (t === Terrain.Water ? 0 : 1), 0);
    expect(land).toBeGreaterThan(map.width * map.height * 0.25);
    expect(land).toBeLessThan(map.width * map.height * 0.97); // there is a coast
    map.cities.forEach(c => {
      expect(map.terrain[c.y * map.width + c.x]).not.toBe(Terrain.Water);
      expect(Number.isFinite(roadDistance(map, map.cities[0].id, c.id))).toBe(true);
      expect(c.venues.length).toBeGreaterThan(0);
      // Oversized towns may sprawl into each other, but never sit on top of one another.
      map.cities.forEach(o => {
        if (o !== c) expect(Math.hypot(o.x - c.x, o.y - c.y)).toBeGreaterThanOrEqual(0.4 * (c.radius + o.radius + 1) - 0.01);
      });
    });
    expect(map.cities.find(c => c.size === 'metropolis')!.venues.some(v => v.kind === 'stadium')).toBe(true);
  });

  it('measures distance in real kilometres, whatever the size of the tile', () => {
    const gb = generateWorld(SEED, 'GB');
    const us = generateWorld(SEED, 'US');
    // Britain is drawn on a finer grid than the States...
    expect(gb.kmPerTile).toBeLessThan(us.kmPerTile / 4);
    [gb, us].forEach(map => {
      const [a, b] = [map.cities[0], map.cities[1]];
      const tiles = getCityPath(map, a.id, b.id).length - 1;
      expect(roadDistance(map, a.id, b.id) * KM_PER_UNIT).toBeCloseTo(tiles * map.kmPerTile, 5);
    });
    // ...and the biggest cities are a plausible real distance apart (Madrid-Barcelona ~ 620 km by air).
    const es = generateWorld(SEED, 'ES');
    const km = roadDistance(es, 'city-0', 'city-1') * KM_PER_UNIT;
    expect(km).toBeGreaterThan(500);
    expect(km).toBeLessThan(1100);
    // Finer grids give the cramped countries room.
    expect(gb.width * gb.height).toBeGreaterThan(72 * 56);
  });

  it('gives bigger places bigger venues, on flat dry lots', () => {
    const map = generateWorld(SEED);
    const metro = map.cities.find(c => c.size === 'metropolis')!;
    expect(metro.venues.some(v => v.kind === 'stadium')).toBe(true);
    map.cities.forEach(city =>
      city.venues.forEach(v => {
        for (let j = 0; j < v.h; j++)
          for (let i = 0; i < v.w; i++) {
            expect(map.terrain[(v.y + j) * map.width + v.x + i]).not.toBe(Terrain.Water);
            expect(isFlat(map, v.x + i, v.y + j)).toBe(true);
          }
      }),
    );
  });

  it('routes along road tiles only', () => {
    const map = getWorld(SEED);
    const path = getCityPath(map, map.cities[0].id, map.cities[5].id);
    expect(path.length).toBeGreaterThan(1);
    path.forEach(i => expect(map.road[i]).toBe(1));
  });
});

describe('simulation', () => {
  it('drives a booked show and gets paid', () => {
    const planted = plantGig(newGame(), 3);
    const gig = planted.gig;
    let state = planted.state;
    const van = state.vehicles.find(v => v.modelId === 'luton-box')!;
    state = assignVehicle(state, van.id, gig.id).state;
    const cashBefore = state.company.cash;

    const untilShowEnd = gig.day * HOURS_PER_DAY + SHOW_END_HOUR - state.hour;
    state = advanceHours(state, untilShowEnd);
    const played = state.gigs.find(g => g.id === gig.id)!;
    expect(played.status).toBe('done');
    expect(played.result!.payout).toBeGreaterThan(0);
    expect(state.company.cash).toBeGreaterThan(cashBefore - 3000); // fee minus a few days' wages
    expect(state.stats.showsPlayed).toBe(1);

    // After teardown the truck heads home and unloads.
    state = advanceHours(state, 24 * 4);
    const back = state.vehicles.find(v => v.id === van.id)!;
    expect(back.cityId).toBe(back.homeCityId);
    expect(stockSize(back.cargo)).toBe(0);
  });

  it('penalises a booked show nobody drives to', () => {
    const planted = plantGig(newGame(), 3);
    const gig = planted.gig;
    let state = planted.state;
    state = advanceHours(state, gig.day * HOURS_PER_DAY + SHOW_END_HOUR - state.hour);
    const g = state.gigs.find(x => x.id === gig.id)!;
    expect(g.status).toBe('failed');
    expect(g.result!.payout).toBeLessThan(0);
    expect(state.stats.showsFailed).toBe(1);
  });

  it('a truck that cannot make load-in arrives late and earns less', () => {
    // Start late in the evening so the far show's load-in is only hours away.
    const base = advanceHours(newGame(), 14);
    const world = getWorld(base.mapSeed);
    const hq = world.cityById.get(base.company.hqCityId)!;
    const far = [...world.cities].sort((a, b) => roadDistance(world, hq.id, b.id) - roadDistance(world, hq.id, a.id))[0];
    const planted = plantGig(base, 1, far.id);
    const gig = planted.gig;
    let state = planted.state;
    state = assignVehicle(state, state.vehicles[1].id, gig.id).state;
    const projection = projectCoverage(state, gig);
    expect(projection.onTime).toBe(false);
    expect(projection.latestArrival).toBeGreaterThan(gig.day * HOURS_PER_DAY + LOAD_IN_HOUR);
  });

  it('is deterministic', () => {
    const a = advanceHours(newGame(), 24 * 40);
    const b = advanceHours(newGame(), 24 * 40);
    expect(a.gigs.map(g => `${g.id}:${g.status}`)).toEqual(b.gigs.map(g => `${g.id}:${g.status}`));
    expect(a.company.cash).toBe(b.company.cash);
  });

  it('charges wages and running costs while idle', () => {
    const s0 = newGame();
    const s1 = advanceHours(s0, 24 * 10);
    expect(s1.company.cash).toBeLessThan(s0.company.cash);
    expect(s1.ledger[1990]?.wages).toBeLessThan(0);
    expect(s1.ledger[1990]?.running).toBeLessThan(0);
  });

  it('ends the game after three months in the red', () => {
    let s = newGame();
    s = { ...s, company: { ...s.company, cash: -200000 } };
    s = advanceHours(s, 24 * 120);
    expect(s.gameOver).toBeDefined();
  });

  it('announces new vehicle models as the years pass', () => {
    const rich = newGame();
    const s = advanceHours({ ...rich, company: { ...rich.company, cash: 10_000_000 } }, 24 * 365 * 4);
    expect(s.announcedModels).toContain('artic-40');
  });
});

describe('actions', () => {
  it('blocks booking above the company tier', () => {
    const s = newGame();
    const world = getWorld(s.mapSeed);
    const metro = world.cities.find(c => c.size === 'metropolis')!;
    const stadium = metro.venues.find(v => v.kind === 'stadium')!;
    const gig: Gig = {
      id: 'big',
      act: 'Megastars',
      venueId: stadium.id,
      cityId: metro.id,
      tier: 4,
      day: 20,
      acceptByDay: 10,
      needs: { audio: 16, console: 0, lighting: 14, video: 10, stage: 12 },
      crewNeeded: 16,
      fee: 100000,
      status: 'offer',
    };
    expect(bookGig({ ...s, gigs: [gig] }, 'big').result.ok).toBe(false);
  });

  it('buys vehicles, builds depots and handles the loan', () => {
    let s = newGame();
    const depot = s.depots[0];
    s = borrow(s).state;
    expect(s.company.loan).toBe(10000);
    s = repay(s).state;
    expect(s.company.loan).toBe(0);
    s = borrow(s).state;
    const fleet = s.vehicles.length;
    s = buyVehicle(s, depot.id, 'rigid-7t').state;
    expect(s.vehicles.length).toBe(fleet + 1);
    expect(buyVehicle(s, depot.id, 'megaliner').result.ok).toBe(false); // not invented yet
    const world = getWorld(s.mapSeed);
    const other = world.cities.find(c => c.id !== s.company.hqCityId)!;
    const built = buildDepot(s, other.id);
    expect(built.result.ok).toBe(s.company.cash >= 35000);
  });
});
