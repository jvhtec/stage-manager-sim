import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createTycoonGame } from '../state';
import { getWorld } from '../mapgen';
import { generateNationalTour, generateWorldTour, tourGigs } from '../tours';
import { assignVehicle, assignVehicleToTour, bookGig, bookTour } from '../actions';
import { advanceHours } from '../sim';
import { loadInHour, loadOutDoneHour, showEndHour } from '../core';
import { getRegion } from '../content/world';
import { HOURS_PER_DAY } from '../catalog';
import type { Gig, Tour, TycoonState } from '../types';

const newGame = (seed = 4242) => createTycoonGame({ companyName: 'Test Co', color: '#ff0066', seed });

describe('tour generation', () => {
  it('builds national tours as a drivable run of towns', () => {
    const s = newGame();
    const world = getWorld(s.mapSeed);
    const rng = createRng(9);
    let tour: Tour | null = null;
    for (let i = 0; i < 20 && !tour; i++) tour = generateNationalTour(s, world, rng);
    expect(tour).not.toBeNull();
    const gigs = tourGigs(s, tour!);
    expect(gigs.length).toBeGreaterThanOrEqual(3);
    expect(new Set(gigs.map(g => g.cityId)).size).toBe(gigs.length);
    gigs.forEach((g, i) => {
      expect(g.tourId).toBe(tour!.id);
      expect(g.act).toBe(tour!.act);
      if (i > 0) expect(g.day).toBeGreaterThan(gigs[i - 1].day);
    });
    expect(tour!.bonus).toBeGreaterThan(0);
  });

  it('builds world tours with overseas legs flown from the airport', () => {
    const s = newGame();
    const world = getWorld(s.mapSeed);
    const airport = world.cities.flatMap(c => c.venues).find(v => v.kind === 'airport')!;
    expect(airport).toBeDefined();
    const rng = createRng(3);
    let tour: Tour | null = null;
    for (let i = 0; i < 20 && !tour; i++) tour = generateWorldTour(s, world, rng);
    const legs = tourGigs(s, tour!).filter(g => g.overseas);
    expect(legs.length).toBeGreaterThanOrEqual(1);
    legs.forEach(leg => {
      expect(leg.venueId).toBe(airport.id);
      expect(leg.overseas!.stops.length).toBeGreaterThanOrEqual(3);
      const freight = getRegion(leg.overseas!.regionId).freightDays;
      expect(loadInHour(leg)).toBe((leg.day - freight) * HOURS_PER_DAY + 10);
      expect(loadOutDoneHour(leg)).toBeGreaterThan(showEndHour(leg));
    });
  });
});

/** A two-date tour of tier-1 rooms in the player's home town, a few days out. */
function plantTour(state: TycoonState): { state: TycoonState; tour: Tour } {
  const world = getWorld(state.mapSeed);
  const hq = world.cityById.get(state.company.hqCityId)!;
  const venues = hq.venues.filter(v => v.tier === 1);
  const today = Math.floor(state.hour / HOURS_PER_DAY);
  const gigs: Gig[] = [0, 1].map(i => ({
    id: `tg-${i}`,
    act: 'Nirvana',
    venueId: venues[i % venues.length].id,
    cityId: hq.id,
    tier: 1,
    day: today + 3 + i * 2,
    acceptByDay: today + 1,
    needs: { audio: 2, lighting: 1, video: 0, stage: 1 },
    crewNeeded: 2,
    fee: 3000,
    status: 'offer',
    tourId: 'tour-test',
  }));
  const tour: Tour = {
    id: 'tour-test',
    act: 'Nirvana',
    name: 'Nirvana — test tour',
    kind: 'national',
    gigIds: gigs.map(g => g.id),
    bonus: 1500,
    acceptByDay: today + 1,
    status: 'offer',
  };
  return { state: { ...state, gigs: [...state.gigs, ...gigs], tours: [...state.tours, tour] }, tour };
}

describe('playing tours', () => {
  it('books the whole tour from any date, and pays the completion bonus', () => {
    const planted = plantTour(newGame());
    let s = bookGig(planted.state, 'tg-1').state;
    expect(s.tours.find(t => t.id === 'tour-test')!.status).toBe('booked');
    expect(s.gigs.filter(g => g.tourId === 'tour-test').every(g => g.status === 'booked')).toBe(true);

    const truck = s.vehicles.find(v => v.modelId === 'luton-box')!;
    const assigned = assignVehicleToTour(s, truck.id, 'tour-test');
    expect(assigned.result.ok).toBe(true);
    s = assigned.state;
    expect(s.vehicles.find(v => v.id === truck.id)!.orders).toEqual(['tg-0', 'tg-1']);

    const end = showEndHour(s.gigs.find(g => g.id === 'tg-1')!);
    s = advanceHours(s, end - s.hour + 24);
    expect(s.gigs.filter(g => g.tourId === 'tour-test').map(g => g.status)).toEqual(['done', 'done']);
    expect(s.tours.find(t => t.id === 'tour-test')!.status).toBe('done');
    expect(s.artistRelations.Nirvana).toBeGreaterThanOrEqual(2);
  });

  it('refuses tours above your reputation tier', () => {
    const s = newGame();
    const world = getWorld(s.mapSeed);
    let tour: Tour | null = null;
    const rng = createRng(5);
    for (let i = 0; i < 20 && !tour; i++) tour = generateWorldTour(s, world, rng);
    expect(bookTour(s, tour!.id).result.ok).toBe(false);
  });

  it('flies an overseas leg out and back, charging freight', () => {
    let s = newGame();
    const world = getWorld(s.mapSeed);
    const airport = world.cities.flatMap(c => c.venues).find(v => v.kind === 'airport')!;
    const today = Math.floor(s.hour / HOURS_PER_DAY);
    const leg: Gig = {
      id: 'leg',
      act: 'Test',
      venueId: airport.id,
      cityId: airport.cityId,
      tier: 1,
      day: today + 8,
      acceptByDay: today + 1,
      needs: { audio: 2, lighting: 1, video: 0, stage: 1 },
      crewNeeded: 2,
      fee: 9000,
      status: 'booked',
      overseas: {
        regionId: 'europe',
        stops: [
          { city: 'Madrid', country: 'Spain', venue: 'WiZink Center', day: today + 8 },
          { city: 'Paris', country: 'France', venue: 'Bercy', day: today + 10 },
        ],
      },
    };
    s = { ...s, gigs: [...s.gigs, leg] };
    const truck = s.vehicles.find(v => v.modelId === 'luton-box')!;
    s = assignTo(s, truck.id, 'leg');
    s = advanceHours(s, showEndHour(leg) - s.hour);
    const played = s.gigs.find(g => g.id === 'leg')!;
    expect(played.status).toBe('done');
    expect(s.ledger[1990]?.freight).toBeLessThan(0);
    // The truck waits at the airport for the gear to come home, then drives back.
    expect(s.vehicles.find(v => v.id === truck.id)!.cityId).toBe(airport.cityId);
    s = advanceHours(s, loadOutDoneHour(leg) - s.hour + 24 * 4);
    const home = s.vehicles.find(v => v.id === truck.id)!;
    expect(home.cityId).toBe(home.homeCityId);
  });
});

function assignTo(s: TycoonState, vehicleId: string, gigId: string): TycoonState {
  const out = assignVehicle(s, vehicleId, gigId);
  if (!out.result.ok) throw new Error(out.result.message);
  return out.state;
}
