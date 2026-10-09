import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { createRng } from '@/lib/rng';
import { advanceHours } from '../sim';
import { assignVehicleToTour, bookTour } from '../actions';
import { generateWorldTour, tourGigs } from '../tours';
import { worldOf } from '../mapgen';
import { lastShowDay } from '../core';
import { CARNET_FLAT, estimatePaperwork, needsCarnet, paperworkFor, visaPerHead } from '../paperwork';
import type { Gig, Tour } from '../types';

const leg = (cities: [string, string][]): Gig =>
  ({
    needs: { audio: 8, lighting: 10, video: 0, stage: 4, console: 1 },
    crewNeeded: 12,
    overseas: { regionId: 'x', stops: cities.map(([city, country], i) => ({ city, country, venue: 'v', day: i })) },
  }) as unknown as Gig;

describe('visas and carnets', () => {
  it('EU firms move kit freely inside the EU; the UK needs carnets for Europe only from 2021', () => {
    expect(needsCarnet('ES', 'FR', 2005)).toBe(false);
    expect(needsCarnet('DE', 'IT', 2030)).toBe(false);
    expect(needsCarnet('GB', 'FR', 2005)).toBe(false);
    expect(needsCarnet('GB', 'FR', 2021)).toBe(true);
    expect(needsCarnet('ES', 'GB', 2022)).toBe(true);
    expect(needsCarnet('GB', 'US', 1980)).toBe(true);
    expect(needsCarnet('GB', 'GB', 2000)).toBe(false);
  });

  it('visas cost per head outside the home bloc, rising over the decades', () => {
    expect(visaPerHead('GB', 'FR', 2000)).toBe(0);
    expect(visaPerHead('GB', 'MX', 2000)).toBe(0);
    expect(visaPerHead('GB', 'US', 1980)).toBeLessThan(visaPerHead('GB', 'US', 2015));
    expect(visaPerHead('US', 'US', 2000)).toBe(0);
    expect(visaPerHead('GB', 'AU', 2010)).toBeGreaterThan(visaPerHead('GB', 'SG', 2010));
  });

  it('a Europe-only leg from Britain in 1998 costs nothing; Asia-Pacific costs both', () => {
    const state = createTycoonGame({ companyName: 'P', color: '#f00', seed: 1, country: 'GB', startYear: 1998 });
    expect(estimatePaperwork(state, leg([['Paris', 'France'], ['Berlin', 'Germany']]), 1998).total).toBe(0);
    const apac = estimatePaperwork(state, leg([['Tokyo', 'Japan'], ['Sydney', 'Australia'], ['Singapore', 'Singapore']]), 1998);
    expect(apac.carnet).toBeGreaterThan(CARNET_FLAT);
    expect(apac.visas).toBeGreaterThan(0);
    expect(apac.total).toBe(apac.carnet + apac.visas);
    expect(apac.lines.map(l => l.code)).toEqual(['JP', 'AU', 'SG']);
  });

  it('carnets grow with the kit and the countries, visas with the heads', () => {
    const state = createTycoonGame({ companyName: 'P', color: '#f00', seed: 1, country: 'GB', startYear: 2010 });
    const one = paperworkFor(state, leg([['Tokyo', 'Japan']]), {}, 10, 2010, 100_000);
    const two = paperworkFor(state, leg([['Tokyo', 'Japan'], ['Seoul', 'South Korea']]), {}, 10, 2010, 100_000);
    const bigger = paperworkFor(state, leg([['Tokyo', 'Japan']]), {}, 20, 2010, 400_000);
    expect(two.carnet).toBeGreaterThan(one.carnet);
    expect(bigger.carnet).toBeGreaterThan(one.carnet);
    expect(bigger.visas).toBe(one.visas * 2);
  });

  it('domestic shows have no paperwork', () => {
    const state = createTycoonGame({ companyName: 'P', color: '#f00', seed: 1, country: 'GB', startYear: 2010 });
    expect(paperworkFor(state, { needs: {}, crewNeeded: 3 } as unknown as Gig, {}, 3, 2010).total).toBe(0);
  });

  it('a world tour leg books visas and carnets in the ledger when the rig turns up', () => {
    let s = createTycoonGame({ companyName: 'W', color: '#e11d48', seed: 42, country: 'GB', startYear: 1998 });
    s.company.reputation = 90;
    // World tours need a production hall to rehearse in.
    s.depots[0].kind = 'warehouse';
    s.depots[0].size = 4;
    s.depots[0].modules = { rehearsal: 3 };
    const world = worldOf(s);
    let tour: Tour | null = null;
    for (let i = 1; i < 80 && !tour; i++) tour = generateWorldTour(s, world, createRng(i));
    expect(tour).toBeTruthy();
    s = bookTour(s, tour!.id).state;
    s = assignVehicleToTour(s, s.vehicles.find(x => x.owner === 'player')!.id, tour!.id).state;
    const end = Math.max(...tourGigs(s, s.tours.find(x => x.id === tour!.id)!).map(g => lastShowDay(g))) + 3;
    for (let guard = 0; s.hour < end * 24 && guard < 400; guard++) {
      s.company.cash = 9_000_000;
      s = advanceHours(s, 12, true);
      s.dilemmas.forEach(d => (d.expiresHour = 0));
    }
    const paid = Object.values(s.ledger).reduce((sum, y) => sum + (y.paperwork ?? 0), 0);
    expect(paid).toBeLessThan(0);
  });
});
