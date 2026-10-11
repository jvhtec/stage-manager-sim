import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { HOURS_PER_DAY } from '../catalog';
import { worldOf } from '../mapgen';
import { monthlyRivalOps, opsOf, playRivalShow, rivalOverhead, rivalQuote, rivalTryTake } from '../rivalOps';
import { createRng } from '@/lib/rng';
import type { Gig, TycoonState } from '../types';

const game = (year = 2005): TycoonState => createTycoonGame({ companyName: 'R', color: '#f00', seed: 7, country: 'GB', startYear: year });
const offerFor = (s: TycoonState, tier: number) => s.gigs.find(g => g.status === 'offer' && g.tier === tier) ?? s.gigs.find(g => g.status === 'offer')!;

describe('rivals run the same business', () => {
  it('every rival has kit, crew, trucks and books', () => {
    const s = game();
    s.rivals.forEach(r => {
      const ops = opsOf(s, r);
      expect(ops.crew).toBeGreaterThan(0);
      expect(ops.trucks).toBeGreaterThan(1);
      expect(ops.inputs).toBeGreaterThan(0);
      expect(Object.values(ops.kit).some(n => n > 0)).toBe(true);
    });
  });

  it('a rival can’t take a show when its kit, crew or trucks are already out on those days', () => {
    const s = game();
    const w = worldOf(s);
    const r = s.rivals[0];
    const ops = opsOf(s, r);
    const gig = { ...offerFor(s, 2), techSpec: undefined } as Gig;
    ops.trucks = 1;
    s.gigs.push({ ...gig, id: 'busy', status: 'rival', rivalId: r.id, result: undefined } as Gig);
    expect(rivalQuote(s, w, r, gig)).toMatchObject({ ok: false, reason: 'trucks' });
    ops.trucks = 9;
    ops.crew = gig.crewNeeded;
    expect(rivalQuote(s, w, r, gig)).toMatchObject({ ok: false, reason: 'crew' });
  });

  it('it meets the rider by cross-hiring, at the same price you pay — or passes when that costs too much', () => {
    const s = game();
    const w = worldOf(s);
    const r = s.rivals[0];
    const ops = opsOf(s, r);
    ops.kit = { audio: 99, console: 99, lighting: 99, video: 99, stage: 99 };
    ops.crew = 999;
    ops.trucks = 99;
    ops.inputs = 16;
    ops.desk = 'Yamaha';
    const gig = { ...offerFor(s, 2), techSpec: { inputs: 96, consoleFamily: 'DiGiCo' }, fee: 1_000_000 } as Gig;
    const q = rivalQuote(s, w, r, gig);
    expect(q.ok).toBe(true);
    expect(q.cost).toBeGreaterThan(0);
    expect(q.crossHires).toBe(1);
    const cheap = { ...gig, fee: 500 } as Gig;
    expect(rivalQuote(s, w, r, cheap)).toMatchObject({ ok: false, reason: 'rider' });
    const cash = ops.cash;
    expect(rivalTryTake(s, w, r, gig)).toBe(true);
    expect(ops.cash).toBe(cash - q.cost);
    expect(rivalTryTake(s, w, r, cheap)).toBe(false);
    expect(ops.record.declined.rider).toBe(1);
  });

  it('shows are judged on its kit: dated, worn kit plays worse and can fail', () => {
    const s = game();
    const r = s.rivals[0];
    const ops = opsOf(s, r);
    const gig = { ...offerFor(s, 3) } as Gig;
    const rng = createRng(1);
    ops.quality = 9;
    ops.condition = 100;
    const good = Array.from({ length: 30 }, () => playRivalShow(s, r, { ...gig } as Gig, rng));
    ops.quality = 2;
    ops.condition = 25;
    const bad = Array.from({ length: 30 }, () => playRivalShow(s, r, { ...gig } as Gig, rng));
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    expect(avg(good)).toBeGreaterThan(avg(bad) + 0.2);
    expect(ops.record.failed).toBeGreaterThan(0);
  });

  it('overheads come out every month, and rivals reinvest in what keeps costing them work', () => {
    const s = game();
    const r = s.rivals[0];
    const ops = opsOf(s, r);
    ops.cash = 10_000_000;
    ops.record.declined = { trucks: 9 };
    const trucks = ops.trucks;
    const before = ops.cash;
    monthlyRivalOps(s, r, createRng(2));
    expect(ops.cash).toBeLessThan(before - rivalOverhead(ops) + 1);
    expect(ops.trucks).toBe(trucks + 1);
  });

  it('in a running game rivals play shows on their own books', () => {
    let s = game(1995);
    s.company.cash = 50_000_000;
    s = advanceHours(s, 120 * HOURS_PER_DAY);
    const played = s.rivals.reduce((n, r) => n + (r.ops?.record.shows ?? 0), 0);
    expect(played).toBeGreaterThan(10);
    const results = s.gigs.filter(g => g.status === 'rival' && g.result).map(g => g.result!.quality);
    expect(new Set(results.map(q => q.toFixed(2))).size).toBeGreaterThan(3);
  });
});
