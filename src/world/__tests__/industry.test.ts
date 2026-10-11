import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { dayOf } from '../core';
import { worldOf } from '../mapgen';
import { roadDistance } from '../pathfinding';
import { CLIENT_WALK, RECALL_MIN_TRUCKS, RECALL_PER_TRUCK, TENDER_THRESHOLD, monthlyIndustry, promoterCollapse, rivalTrucksToday } from '../industry';
import { COVERED_RECALL_DAYS, FRAMEWORK_DISCOUNT, FRAMEWORK_HOLD, STANDBY_DAY_RATE, areaExposure, dailyStandby, fleetExposure, frameworkBlocker, frameworkFeeFactor, grounded, signFramework, topClient } from '../risk';
import { RECALL_DAYS, recallFleet } from '../shocks';
import { opsOf } from '../rivalOps';
import type { Gig, TycoonState } from '../types';

const game = (): TycoonState => createTycoonGame({ companyName: 'I', color: '#f00', seed: 12, country: 'GB', startYear: 1995 });
const rng = (chance: (p: number) => boolean) => ({ next: () => 0.5, chance, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a }) as never;
/** A fleet of n trucks of the starting truck's model. */
const fleet = (s: TycoonState, n: number) => {
  const v = s.vehicles.find(x => x.owner === 'player')!;
  s.vehicles = [...s.vehicles.filter(x => x.owner !== 'player'), ...Array.from({ length: n }, (_, i) => ({ ...v, id: `t${i}`, orders: [] }))];
};

describe('concentration risk', () => {
  it('measures how much of the fleet is one model', () => {
    const s = game();
    fleet(s, 8);
    const f = fleetExposure(s);
    expect(f.count).toBe(8);
    expect(f.share).toBe(1);
  });

  it('a small fleet is beneath a maker’s notice; a big single-model fleet is recalled more often', () => {
    const odds = (n: number) => {
      const s = game();
      fleet(s, n);
      const ps: number[] = [];
      monthlyIndustry(s, rng(p => (ps.push(p), false)));
      return ps.find(p => Math.abs(p - RECALL_PER_TRUCK * n) < 1e-12) ?? 0;
    };
    expect(odds(RECALL_MIN_TRUCKS - 1)).toBe(0);
    expect(odds(4)).toBeCloseTo(RECALL_PER_TRUCK * 4);
    expect(odds(20)).toBeCloseTo(odds(4) * 5);
  });

  it('a service contract shortens a recall; standby hire keeps recalled trucks working, at a day rate', () => {
    const s = game();
    fleet(s, 6);
    recallFleet(s, RECALL_DAYS);
    const v = s.vehicles.find(x => x.owner === 'player')!;
    expect((v.recalledUntil! - s.hour) / 24).toBe(RECALL_DAYS);
    expect(grounded(s, v)).toBe(true);

    const c = game();
    fleet(c, 6);
    c.policies.fleetCover = 'priority';
    recallFleet(c, RECALL_DAYS);
    expect((c.vehicles.find(x => x.owner === 'player')!.recalledUntil! - c.hour) / 24).toBe(COVERED_RECALL_DAYS);

    s.policies.standby = 'on';
    expect(grounded(s, v)).toBe(false);
    const cash = s.company.cash;
    dailyStandby(s);
    expect(s.company.cash).toBe(cash - 6 * STANDBY_DAY_RATE);
  });

  it('only big accounts go out to tender; a framework agreement makes them far less likely to walk', () => {
    const s = game();
    s.clientFees = { [s.startYear]: { Big: TENDER_THRESHOLD * 2, Small: TENDER_THRESHOLD } };
    expect(topClient(s)?.act).toBe('Big');
    const walkOdds = () => {
      const ps: number[] = [];
      monthlyIndustry(s, rng(p => (ps.push(p), false)));
      return ps.find(p => p > 0 && p !== 0.006 && p !== 0.003) ?? 0;
    };
    const open = walkOdds();
    expect(open).toBeGreaterThan(0);
    expect(open).toBeLessThanOrEqual(CLIENT_WALK * 4);
    expect(signFramework(s, 'Big')).toBe(true);
    expect(walkOdds()).toBeCloseTo(open * FRAMEWORK_HOLD);
    expect(frameworkFeeFactor(s, 'Big')).toBe(1 - FRAMEWORK_DISCOUNT);
    expect(frameworkBlocker(s, 'Big')).toMatch(/already/);

    const small = game();
    small.clientFees = { [small.startYear]: { Tiny: 5000 } };
    const ps: number[] = [];
    monthlyIndustry(small, rng(p => (ps.push(p), false)));
    expect(ps.some(p => p > 0.006)).toBe(false); // too small to be reviewed at all
  });

  it('a promoter going under takes uninsured invoices and arena dates in its area; insured ones are paid', () => {
    const s = game();
    const world = worldOf(s);
    const here = s.depots[0].cityId;
    const far = world.cities.filter(c => !c.abroad && c.id !== here).sort((a, b) => roadDistance(world, here, b.id) - roadDistance(world, here, a.id)).find(c => Number.isFinite(roadDistance(world, here, c.id)))!.id;
    s.receivables = [
      { id: 'a', gigId: 'g1', act: 'A', amount: 10000, dueDay: 99, tier: 3, insured: false, cityId: here },
      { id: 'b', gigId: 'g2', act: 'B', amount: 5000, dueDay: 99, tier: 3, insured: true, cityId: here },
      { id: 'c', gigId: 'g3', act: 'C', amount: 7000, dueDay: 99, tier: 3, insured: false, cityId: far },
    ];
    const show = { ...(s.gigs[0] ?? {}), id: 'arena', act: 'X', cityId: here, tier: 3, fee: 20000, day: dayOf(s.hour) + 10, status: 'booked', result: undefined } as Gig;
    s.gigs.push(show);
    const r = s.rivals[0];
    opsOf(s, r).owed = [{ day: 99, amount: 3000, cityId: here }];
    const cash = s.company.cash;
    const out = promoterCollapse(s, rng(() => false), here)!;
    expect(out.lostInvoices).toBe(10000);
    expect(out.lostBookings).toBe(20000);
    expect(s.company.cash).toBe(cash + 5000);
    expect(s.receivables.map(i => i.id)).toEqual(['c']);
    expect(show.status).toBe('expired');
    expect(opsOf(s, r).owed).toEqual([]);
    expect(s.stats.industry?.collapses).toBe(1);
  });

  it('measures how much of your work sits in one area', () => {
    const s = game();
    const here = s.depots[0].cityId;
    s.townShows = { [here]: { player: 9 } };
    expect(areaExposure(s, worldOf(s)).share).toBe(1);
  });

  it('a rival’s recall takes trucks off the road for a while', () => {
    const s = game();
    const ops = opsOf(s, s.rivals[0]);
    ops.down = { until: dayOf(s.hour) + 5, trucks: 2 };
    expect(rivalTrucksToday(s, ops)).toBe(ops.trucks - 2);
    s.hour += 24 * 6;
    expect(rivalTrucksToday(s, ops)).toBe(ops.trucks);
  });
});
