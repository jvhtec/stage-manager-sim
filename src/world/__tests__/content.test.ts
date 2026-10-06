import { describe, expect, it } from 'vitest';
import { ARTISTS, artistTierIn, artistsTouringAt, findArtist } from '../content/artists';
import { GEAR_PRODUCTS, expectedQuality, getProduct } from '../content/gear';
import { RIVAL_COMPANIES } from '../content/companies';
import { baseShowQuality, evaluateGear, pickGear } from '../loading';
import { createTycoonGame } from '../state';
import { advanceHours, updateRivals } from '../sim';
import { generateOffer } from '../offers';
import { getWorld } from '../mapgen';
import { createRng } from '@/lib/rng';
import { assignVehicle, bookGig } from '../actions';
import { HOURS_PER_DAY, SHOW_END_HOUR } from '../catalog';
import type { Gig, TycoonState } from '../types';

const newGame = () => createTycoonGame({ companyName: 'Test Co', color: '#ff0066', seed: 777 });

const baseGig = (over: Partial<Gig> = {}): Gig => ({
  id: 'g',
  act: 'Test',
  venueId: 'v',
  cityId: 'c',
  tier: 2,
  day: 10,
  acceptByDay: 5,
  needs: { audio: 4, lighting: 2, video: 0, stage: 0 },
  crewNeeded: 4,
  fee: 8000,
  status: 'booked',
  ...over,
});

describe('artists', () => {
  it('follows career arcs, including splits and reunions', () => {
    const oasis = findArtist('Oasis')!;
    expect(artistTierIn(oasis, 1992)).toBe(0);
    expect(artistTierIn(oasis, 1993)).toBe(1);
    expect(artistTierIn(oasis, 1996)).toBe(4);
    expect(artistTierIn(oasis, 2015)).toBe(0);
    expect(artistTierIn(oasis, 2025)).toBe(4);
  });

  it('has real stadium acts in 1990 and every artist has sane tiers', () => {
    expect(artistsTouringAt(1990, 4).map(a => a.name)).toContain('U2');
    ARTISTS.forEach(a => a.career.forEach(([year, tier]) => {
      expect(year).toBeGreaterThan(1950);
      expect(tier).toBeGreaterThanOrEqual(0);
      expect(tier).toBeLessThanOrEqual(4);
    }));
  });

  it('books real acts at big venues, at the size their career is at', () => {
    const s = newGame();
    const world = getWorld(s.mapSeed);
    const metro = world.cities.find(c => c.size === 'metropolis')!;
    const rng = createRng(1);
    for (let i = 0; i < 40; i++) {
      const gig = generateOffer(s, world, metro, rng)!;
      if (gig.tier >= 3) {
        const artist = findArtist(gig.act);
        expect(artist).toBeDefined();
        expect(artistTierIn(artist!, 1990)).toBe(gig.tier);
      }
    }
  });

  it('remembers acts you did proud', () => {
    let s: TycoonState = newGame();
    const world = getWorld(s.mapSeed);
    const hq = world.cityById.get(s.company.hqCityId)!;
    const venue = hq.venues.find(v => v.tier === 1)!;
    const gig = baseGig({
      id: 'loyal',
      act: 'Nirvana',
      tier: 1,
      venueId: venue.id,
      cityId: hq.id,
      day: 3,
      needs: { audio: 2, lighting: 1, video: 0, stage: 1 },
      crewNeeded: 2,
      status: 'offer',
    });
    s = { ...s, gigs: [...s.gigs, gig] };
    s = bookGig(s, 'loyal').state;
    s = assignVehicle(s, s.vehicles.find(v => v.modelId === 'luton-box')!.id, 'loyal').state;
    s = advanceHours(s, 3 * HOURS_PER_DAY + SHOW_END_HOUR - s.hour);
    expect(s.gigs.find(g => g.id === 'loyal')!.status).toBe('done');
    expect(s.artistRelations.Nirvana).toBe(1);
  });
});

describe('gear', () => {
  it('has unique ids and sensible launch years', () => {
    expect(new Set(GEAR_PRODUCTS.map(p => p.id)).size).toBe(GEAR_PRODUCTS.length);
    GEAR_PRODUCTS.forEach(p => expect(p.quality).toBeGreaterThan(0));
  });

  it('makes old kit look dated as expectations rise', () => {
    const stadium = baseGig({ tier: 4 });
    const old = evaluateGear({ 'martin-f2': 4, par64: 2 }, stadium, 2015);
    const modern = evaluateGear({ 'lacoustics-k2': 4, 'robe-bmfl': 2 }, stadium, 2015);
    expect(old.quality).toBeLessThan(0.8);
    expect(modern.quality).toBeGreaterThanOrEqual(1);
    expect(expectedQuality(4, 2015)).toBeGreaterThan(expectedQuality(4, 1990));
  });

  it('loads the rider brand first and checks the rider', () => {
    const stock = { 'meyer-msl3': 4, 'martin-f2': 4 };
    const rider = { dept: 'audio' as const, brand: 'Martin Audio' };
    const picked = pickGear(stock, { audio: 4, lighting: 0, video: 0, stage: 0 }, 4, rider);
    expect(picked['martin-f2']).toBe(4);
    const gig = baseGig({ rider });
    expect(evaluateGear(picked, gig, 1990).riderMet).toBe(true);
    expect(evaluateGear({ 'meyer-msl3': 4 }, gig, 1990).riderMet).toBe(false);
    const q = (riderMet?: boolean) => baseShowQuality({ gearCoverage: 0.9, crewCoverage: 1, lateHours: 0, gearQuality: 1, riderMet });
    expect(q(true)).toBeGreaterThan(q(undefined));
    expect(q(false)).toBeLessThan(q(undefined));
  });

  it('starts the company with real 1990 kit', () => {
    const s = newGame();
    Object.keys(s.depots[0].gear).forEach(id => expect(getProduct(id).introYear).toBeLessThanOrEqual(1990));
  });
});

describe('rival companies', () => {
  it('starts with the real firms already trading in 1990', () => {
    const s = newGame();
    const expected = RIVAL_COMPANIES.filter(r => r.enters <= 1990).map(r => r.name).sort();
    expect(s.rivals.map(r => r.name).sort()).toEqual(expected);
    expect(new Set(s.rivals.map(r => r.hqCityId)).size).toBe(s.rivals.length);
  });

  it('renames and adds companies as the years pass', () => {
    const s = newGame();
    const world = getWorld(s.mapSeed);
    updateRivals(s, world, 2006);
    expect(s.rivals.find(r => r.id === 'lsd')!.name).toBe('PRG');
    expect(s.rivals.some(r => r.id === 'solotech')).toBe(true);
    updateRivals(s, world, 2011);
    expect(s.rivals.find(r => r.id === 'clair')!.name).toBe('Clair Global');
  });
});
