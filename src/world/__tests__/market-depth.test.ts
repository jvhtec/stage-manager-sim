import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { buildDepot, buyRival, setPolicy, transferGear } from '../actions';
import { HOURS_PER_DAY } from '../catalog';
import { freeLot } from '../core';
import { dailyRentOut, subHireFor } from '../hire';
import { worldOf } from '../mapgen';
import { stockSize } from '../loading';
import { monthlyRivals, takeoverPrice } from '../rivals';
import { condition } from '../wear';
import { companyValue } from '../queries';
import type { Gig, TycoonState } from '../types';

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'D', color: '#f00', seed: 41, country: 'GB', startYear: 1995 });
  return { ...s, company: { ...s.company, cash: 3_000_000, reputation: 70 }, gigs: [], tours: [] };
};

describe('rental market', () => {
  it('sub-hires shortfalls from rivals nearby, at a day rate', () => {
    const s = game();
    const world = worldOf(s);
    const r = s.rivals[0];
    const city = world.cityById.get(r.hqCityId)!;
    const gig = { cityId: city.id, tier: 2, day: 10, needs: { audio: 6, console: 2, lighting: 4, video: 1, stage: 2 } } as unknown as Gig;
    const hire = subHireFor(s, world, gig, {});
    expect(hire.units).toBeGreaterThan(0);
    expect(hire.cost).toBeGreaterThan(0);
    expect(subHireFor(setPolicy(s, 'subhire', 'off').state, world, gig, {}).units).toBe(0);
  });

  it('renting idle kit out earns money and wears it', () => {
    const s = setPolicy(game(), 'rentOut', 'on').state;
    const id = Object.keys(s.depots[0].gear)[0];
    const cash = s.company.cash;
    for (let i = 0; i < 30; i++) dailyRentOut(s);
    expect(s.company.cash).toBeGreaterThan(cash);
    expect(condition(s, id)).toBeLessThan(100);
  });
});

describe('moving kit and buying rivals', () => {
  it('couriers kit between bases, arriving after the drive', () => {
    let s = game();
    const world = worldOf(s);
    const city = world.cityById.get(world.cities.find(c => c.id !== s.company.hqCityId && freeLot(s, world, c.id) >= 0)!.id)!;
    s = buildDepot(s, city.id, 'warehouse').state;
    const [from, to] = s.depots;
    const id = Object.keys(from.gear)[0];
    const before = from.gear[id];
    const valueBefore = companyValue(s);
    s = transferGear(s, from.id, to.id, id, 2).state;
    // Kit on the courier is still yours (less the courier's fee).
    expect(companyValue(s)).toBeGreaterThan(valueBefore - 2000);
    expect(s.depots[0].gear[id] ?? 0).toBe(before - 2);
    expect(s.transfers.length).toBe(1);
    s = advanceHours(s, 4 * HOURS_PER_DAY);
    expect(s.transfers.length).toBe(0);
    expect(s.depots.find(d => d.id === to.id)!.gear[id]).toBe(2);
  });

  it('buys a rival outright — and struggling rivals come cheaper, or go under', () => {
    let s = game();
    const r = s.rivals.find(x => x.reputation < 60)!;
    const healthy = takeoverPrice({ ...r, health: 80 });
    const desperate = takeoverPrice({ ...r, health: 10 });
    expect(desperate).toBeLessThan(healthy);
    const bases = s.depots.length;
    const kit = stockSize(s.depots.reduce((all, d) => ({ ...all, ...d.gear }), {}));
    const out = buyRival(s, r.id);
    expect(out.result.ok).toBe(true);
    s = out.state;
    expect(s.rivals.some(x => x.id === r.id)).toBe(false);
    expect(s.goneRivals).toContain(r.id);
    expect(s.depots.length).toBeGreaterThanOrEqual(bases);
    expect(stockSize(s.depots.reduce((all, d) => ({ ...all, ...d.gear }), {}))).toBeGreaterThanOrEqual(kit);

    const weak = createTycoonGame({ companyName: 'D', color: '#f00', seed: 41, country: 'GB', startYear: 1995 });
    const victim = weak.rivals.find(x => x.reputation < 60)!;
    victim.health = 1;
    victim.reputation = 10;
    for (let i = 0; i < 6 && weak.rivals.includes(victim); i++) monthlyRivals(weak, { next: () => 0, chance: () => false, nextInt: () => 0, pick: <T,>(a: T[]) => a[0] } as never);
    expect(weak.goneRivals).toContain(victim.id);
    expect(weak.auctions.some(a => a.seller === victim.name)).toBe(true);
  });
});
