import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { worldOf } from '../mapgen';
import { GROUND_SUPPORT_PER_STAGE, problemEffects, productionProblems, rigLoad, typicalKit, venueLimits } from '../production';
import type { Gig, TycoonState, Venue } from '../types';

const game = (year: number): TycoonState => createTycoonGame({ companyName: 'P', color: '#f00', seed: 7, country: 'GB', startYear: year });
const venueOf = (s: TycoonState, kind: string): Venue => worldOf(s).cities.flatMap(c => c.venues).find(v => v.kind === kind)!;
const gigAt = (v: Venue, extra: Partial<Gig> = {}): Gig => ({ id: 'g', venueId: v.id, cityId: v.cityId, tier: v.tier, needs: { audio: 0, console: 0, lighting: 0, video: 0, stage: 0 }, day: 0, status: 'booked', ...extra }) as unknown as Gig;

describe('venue feasibility', () => {
  it('rooms have power and a roof; stadiums are open air', () => {
    const s = game(2000);
    const w = worldOf(s);
    const arena = venueLimits(w, venueOf(s, 'arena'));
    const club = venueLimits(w, venueOf(s, 'club'));
    expect(arena.powerKw).toBeGreaterThan(club.powerKw);
    expect(arena.roofT).toBeGreaterThan(club.roofT);
    expect(venueLimits(w, venueOf(s, 'stadium')).roofT).toBe(0);
  });

  it('a par-can rig drinks power that an LED rig does not', () => {
    const par = typicalKit({ tier: 2, needs: { audio: 4, console: 2, lighting: 4, video: 0, stage: 1 } }, 1982);
    const led = typicalKit({ tier: 2, needs: { audio: 4, console: 2, lighting: 4, video: 0, stage: 1 } }, 2015);
    expect(rigLoad(par).kw).toBeGreaterThan(rigLoad(led).kw);
  });

  it('too much power, too much weight and an artic at a street load-in are each a problem with a fix', () => {
    const s = game(2000);
    const w = worldOf(s);
    const club = venueOf(s, 'club');
    const lim = venueLimits(w, club);
    const heavy = { 'lacoustics-vdosc': Math.ceil((lim.roofT + 2) / 1.2) + 2 } as never;
    const g = gigAt(club);
    const probs = productionProblems(w, g, heavy, lim.noArtics ? [{ modelId: 'artic-40' }] : []);
    expect(probs.some(p => p.id === 'groundSupport')).toBe(true);
    if (lim.noArtics) expect(probs.some(p => p.id === 'shuttle')).toBe(true);
    probs.forEach(p => expect(p.fixCost).toBeGreaterThan(0));
    // Booked fixes clear the problem.
    const fixed = productionProblems(w, gigAt(club, { fixes: { groundSupport: true, shuttle: true, generator: true } }), heavy, [{ modelId: 'artic-40' }]);
    expect(fixed).toEqual([]);
    const fx = problemEffects(probs);
    expect(fx.quality).toBeGreaterThan(0);
  });

  it('open-air rigs fly from the staging: enough stage units and it fits', () => {
    const s = game(2010);
    const w = worldOf(s);
    const stadium = venueOf(s, 'stadium');
    const array = { 'lacoustics-k1': 8 } as never;
    expect(productionProblems(w, gigAt(stadium), array, []).some(p => p.id === 'groundSupport')).toBe(true);
    const staging = productsStage();
    const withStage = { ...(array as object), [staging]: Math.ceil(10 / GROUND_SUPPORT_PER_STAGE) } as never;
    expect(productionProblems(w, gigAt(stadium, { fixes: { generator: true } }), withStage, []).some(p => p.id === 'groundSupport')).toBe(false);
  });

  it('pub gigs plug into the wall', () => {
    const s = game(1982);
    const w = worldOf(s);
    const pub = venueOf(s, 'pub');
    expect(productionProblems(w, gigAt(pub), typicalKit({ tier: 1, needs: { audio: 2, console: 1, lighting: 2, video: 0, stage: 0 } }, 1982), [{ modelId: 'artic-40' }])).toEqual([]);
  });
});

import { GEAR_PRODUCTS } from '../content/gear';
function productsStage() {
  return GEAR_PRODUCTS.find(p => p.dept === 'stage' && p.kind === 'deck')!.id;
}
