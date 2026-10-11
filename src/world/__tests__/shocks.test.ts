import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { dayOf } from '../core';
import { marketOnDay } from '../market';
import { dailyReceivables } from '../receivables';
import { DOWNTURN, LATE_WAVE, RECALL_DAYS, applyShock, loseClient, recallFleet, recalled, startShock, topClient } from '../shocks';
import { actBanned } from '../blacklist';
import { assignVehicle } from '../actions';
import type { Gig, TycoonState } from '../types';

const game = (): TycoonState => createTycoonGame({ companyName: 'Sh', color: '#f00', seed: 9, country: 'GB', startYear: 1995 });
const fakeGig = (s: TycoonState, act: string, day: number, fee: number, status: Gig['status']): Gig => {
  const base = s.gigs[0] ?? ({} as Gig);
  const g = { ...base, id: `g-${act}-${day}`, act, day, fee, status, result: undefined, tourId: undefined, terms: undefined, depositPaid: undefined } as Gig;
  s.gigs.push(g);
  return g;
};

describe('shocks', () => {
  it('a downturn cuts the work and the fees for its run, and then lifts', () => {
    const s = game();
    const today = dayOf(s.hour);
    const before = marketOnDay(s, today + 10);
    startShock(s, 'downturn');
    const during = marketOnDay(s, today + 10);
    expect(during.demand).toBeCloseTo(before.demand * DOWNTURN.demand);
    expect(during.fees).toBeCloseTo(before.fees * DOWNTURN.fees);
    const after = today + DOWNTURN.months * 30 + 1;
    expect(marketOnDay(s, after).demand).toBeCloseTo(marketOnDay({ ...s, shocks: [] }, after).demand);
  });

  it('a late-payment wave makes promoters slip more often', () => {
    const count = (wave: boolean) => {
      let late = 0;
      for (let i = 0; i < 200; i++) {
        const s = game();
        if (wave) startShock(s, 'late-payers');
        s.receivables.push({ id: 'i', gigId: 'g', act: 'X', amount: 1000, dueDay: dayOf(s.hour), tier: 3, insured: false });
        const r = { next: () => 0.5, chance: (p: number) => (i + 0.5) / 200 < p, nextInt: () => 0, pick: <T,>(a: T[]) => a[0], nextRange: (a: number) => a } as never;
        dailyReceivables(s, r);
        if (s.receivables.length) late++;
      }
      return late;
    };
    expect(LATE_WAVE.late).toBeGreaterThan(1);
    expect(count(true)).toBeGreaterThan(count(false) * 2);
  });

  it('losing the biggest client cancels its booked shows and bans it', () => {
    const s = game();
    const today = dayOf(s.hour);
    s.clientFees = { [s.startYear]: { 'Big Act': 50000, 'Small Act': 5000 } };
    const ahead = fakeGig(s, 'Big Act', today + 30, 40000, 'booked');
    const top = topClient(s)!;
    expect(top.act).toBe('Big Act');
    expect(loseClient(s, top.act)).toBe(1);
    expect(ahead.status).toBe('expired');
    expect(actBanned(s, 'Big Act')).toBe(true);
    expect(s.incidentTally?.causes['lost-client']).toBe(1);
  });

  it('a recall keeps the commonest model in the yard, and it can’t be given new work', () => {
    let s = game();
    const r = recallFleet(s)!;
    expect(r.vehicles).toBeGreaterThan(0);
    const v = s.vehicles.find(x => x.owner === 'player' && x.modelId === r.modelId)!;
    expect(recalled(s, v)).toBe(true);
    const where = v.cityId;
    s = advanceHours(s, 24 * 3);
    const v2 = s.vehicles.find(x => x.id === v.id)!;
    expect(v2.cityId).toBe(where);
    const g = fakeGig(s, 'Someone', dayOf(s.hour) + 2, 3000, 'booked');
    expect(assignVehicle(s, v2.id, g.id).result.ok).toBe(false);
    s = advanceHours(s, 24 * RECALL_DAYS);
    expect(recalled(s, s.vehicles.find(x => x.id === v.id)!)).toBe(false);
  });

  it('applyShock reports what it did', () => {
    const s = game();
    expect(applyShock(s, 'downturn')).toBe('downturn');
    expect(s.shocks?.length).toBe(1);
    expect(applyShock(s, 'recall')).toMatch(/recalled/);
  });
});
