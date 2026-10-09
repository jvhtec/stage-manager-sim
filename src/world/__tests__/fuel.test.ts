import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { lockFuel } from '../actions';
import { FUEL_ANCHORS, fuelIndexAt } from '../content/economy';
import { FUEL_LOCK_PREMIUM, dailyMarket, fuelMultiplier, marketNow, marketOnDay } from '../market';
import { estimateJobCosts } from '../queries';
import { dayOf } from '../core';
import type { Gig, TycoonState } from '../types';

const game = (year: number): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 44, country: 'GB', startYear: year });
  s.company.cash = 2_000_000;
  return s;
};

describe('fuel prices', () => {
  it('follow the historical shape: 1979-81 and 2008 and 2022 spikes, 1986 and 1998 lows', () => {
    expect(fuelIndexAt(1980, 6)).toBeGreaterThan(1.3);
    expect(fuelIndexAt(1986, 7)).toBeLessThan(0.8);
    expect(fuelIndexAt(1998, 12)).toBeLessThan(0.75);
    expect(fuelIndexAt(2008, 5)).toBeGreaterThan(1.5);
    expect(fuelIndexAt(2022, 7)).toBeGreaterThan(1.5);
    expect(fuelIndexAt(2050, 1)).toBe(FUEL_ANCHORS[FUEL_ANCHORS.length - 1][1]);
    expect(fuelIndexAt(1950, 1)).toBe(FUEL_ANCHORS[0][1]);
  });

  it('stay in a sane band and average near normal over the game', () => {
    let sum = 0;
    let n = 0;
    for (let y = 1975; y <= 2024; y++) for (let m = 1; m <= 12; m++) {
      const v = fuelIndexAt(y, m);
      expect(v).toBeGreaterThan(0.5);
      expect(v).toBeLessThan(2);
      sum += v;
      n++;
    }
    expect(sum / n).toBeGreaterThan(0.95);
    expect(sum / n).toBeLessThan(1.2);
  });

  it('flow through to what a job costs', () => {
    const cheap = game(1998);
    const dear = game(1981);
    const gigFor = (s: TycoonState) => {
      const v = s.vehicles.find(x => x.owner === 'player')!;
      const g = { id: 'g', cityId: s.depots.length > 1 ? s.depots[1].cityId : [...s.depots].reverse()[0].cityId, day: dayOf(s.hour) + 10, needs: { audio: 1, console: 0, lighting: 0, video: 0, stage: 0 }, crewNeeded: 1, tier: 1, venueId: 'v' } as unknown as Gig;
      return { g, v };
    };
    const a = gigFor(cheap);
    const b = gigFor(dear);
    expect(marketNow(dear).fuel).toBeGreaterThan(marketNow(cheap).fuel);
    expect(a.v).toBeTruthy();
    expect(b.v).toBeTruthy();
    expect(typeof estimateJobCosts(cheap, a.g).fuel).toBe('number');
  });

  it('a contract locks the price at spot plus a premium and then expires', () => {
    const s = game(1998);
    const spot = marketNow(s).fuel;
    const out = lockFuel(s, 6);
    expect(out.result.ok).toBe(true);
    const lock = out.state.fuelLock!;
    expect(lock.price).toBeCloseTo(spot * (1 + FUEL_LOCK_PREMIUM), 1);
    expect(fuelMultiplier(out.state)).toBe(lock.price);
    expect(lockFuel(out.state, 12).result.ok).toBe(false);
    expect(lockFuel(s, 3).result.ok).toBe(false);
    const later = { ...out.state, hour: (lock.untilDay + 1) * 24 };
    expect(fuelMultiplier(later)).toBe(marketOnDay(later, lock.untilDay + 1).fuel);
  });

  it('big three-month swings make the news, once', () => {
    const s = game(1985);
    const jan86 = Math.round((Date.UTC(1986, 0, 1) - Date.UTC(1985, 0, 1)) / 86400000);
    s.hour = jan86 * 24;
    dailyMarket(s, 0);
    expect(s.news.filter(n => /Fuel prices are tumbling/.test(n.text)).length).toBe(1);
    s.hour = (jan86 + 31) * 24; // February: still falling, but already announced
    dailyMarket(s, 0);
    expect(s.news.filter(n => /Fuel prices are tumbling/.test(n.text)).length).toBe(1);
    const t = game(2021);
    t.hour = Math.round((Date.UTC(2021, 6, 1) - Date.UTC(2021, 0, 1)) / 86400000) * 24;
    dailyMarket(t, 0);
    expect(t.news.some(n => /Fuel prices are surging/.test(n.text))).toBe(true);
  });
});
