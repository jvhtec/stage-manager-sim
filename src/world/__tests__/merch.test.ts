import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { orderTourMerch } from '../actions';
import { MERCH, MERCH_LEVELS, merchBlocker, merchCost, popularity, settleMerch, tourFees } from '../merch';
import { dayOf } from '../core';
import type { Gig, Tour, TycoonState } from '../types';

const mid = { next: () => 0.5, chance: () => false, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;

const setup = (act = 'Oasis') => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 61, country: 'GB', startYear: 1995 });
  s.company.cash = 2_000_000;
  const legs: Gig[] = [0, 1, 2, 3].map(
    i => ({ id: 'g' + i, act, status: 'booked', fee: 10000, tier: 2, day: dayOf(s.hour) + 10 + i * 3, cityId: s.depots[0].cityId, venueId: 'v', result: undefined }) as unknown as Gig,
  );
  s.gigs.push(...legs);
  const tour = { id: 'T', act, name: 'Big Tour', kind: 'national', gigIds: legs.map(l => l.id), bonus: 0, acceptByDay: 0, status: 'booked' } as Tour;
  s.tours.push(tour);
  return { s, tour, legs };
};
const play = (s: TycoonState, legs: Gig[], quality: number) => legs.forEach(g => {
  g.status = 'done';
  g.result = { quality } as never;
});

describe('tour merchandise', () => {
  it('costs a share of the tour fees, more for bigger orders', () => {
    const { s, tour } = setup();
    expect(tourFees(s, tour)).toBe(40000);
    const costs = MERCH_LEVELS.map(l => merchCost(s, tour, l));
    expect(costs[0]).toBeLessThan(costs[1]);
    expect(costs[1]).toBeLessThan(costs[2]);
    expect(costs[0]).toBe(Math.round((40000 * MERCH.small.rate) / 10) * 10);
  });

  it('can be ordered once, in good time, with the cash', () => {
    const { s, tour } = setup();
    const cash = s.company.cash;
    const out = orderTourMerch(s, tour.id, 'medium');
    expect(out.result.ok).toBe(true);
    expect(cash - out.state.company.cash).toBe(merchCost(s, tour, 'medium'));
    expect(out.state.tours.find(x => x.id === 'T')!.merch?.level).toBe('medium');
    expect(orderTourMerch(out.state, tour.id, 'small').result.ok).toBe(false);
    s.gigs.forEach(g => (g.day = dayOf(s.hour) + 1));
    expect(merchBlocker(s, tour, 'small')).toMatch(/Too late/);
    const t2 = setup();
    t2.s.company.cash = 10;
    expect(merchBlocker(t2.s, t2.tour, 'small')).toMatch(/costs/);
    t2.tour.status = 'offer';
    expect(merchBlocker(t2.s, t2.tour, 'small')).toMatch(/Book the tour/);
  });

  it('real names sell far more than local bands', () => {
    const { s } = setup();
    expect(popularity(s, 'Oasis')).toBeGreaterThan(popularity(s, 'Some Local Band') * 2);
  });

  it('a small order sells out and profits; an oversized one on an average tour loses', () => {
    const run = (level: 'small' | 'medium' | 'large') => {
      const { s, tour, legs } = setup();
      const out = orderTourMerch(s, tour.id, level).state;
      const t = out.tours.find(x => x.id === 'T')!;
      play(out, out.gigs.filter(g => t.gigIds.includes(g.id)), 0.85);
      settleMerch(out, t, mid);
      return { revenue: t.merch!.revenue!, invested: t.merch!.invested, legs: legs.length };
    };
    const small = run('small');
    const large = run('large');
    expect(small.revenue - small.invested).toBeGreaterThan(0);
    expect(large.revenue - large.invested).toBeLessThan(small.revenue - small.invested);
  });

  it('settles only once, books the takings, and tells you how it went', () => {
    const { s, tour } = setup();
    const out = orderTourMerch(s, tour.id, 'medium').state;
    const t = out.tours.find(x => x.id === 'T')!;
    play(out, out.gigs.filter(g => t.gigIds.includes(g.id)), 0.9);
    settleMerch(out, t, mid);
    const cash = out.company.cash;
    settleMerch(out, t, mid);
    expect(out.company.cash).toBe(cash);
    expect(out.news.some(n => /Big Tour merchandise/.test(n.text))).toBe(true);
    expect(Object.values(out.ledger).reduce((a, y) => a + (y.merch ?? 0), 0)).not.toBe(0);
  });

  it('a tour with nothing played sells nothing', () => {
    const { s, tour } = setup();
    const out = orderTourMerch(s, tour.id, 'small').state;
    const tt = out.tours.find(x => x.id === 'T')!;
    settleMerch(out, tt, mid);
    expect(tt.merch?.revenue).toBe(0);
  });
});
