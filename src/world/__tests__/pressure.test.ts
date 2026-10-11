import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { OVERHEAD, monthlyOverheads } from '../facilities';
import { PAYMENT_DAYS, factorDiscount } from '../receivables';
import { DRY_HIRE_IDLE, monthlyRivalOps, opsOf, playRivalShow, rivalOverhead } from '../rivalOps';
import { rivalDryHireIncome } from '../hire';
import { styleOf } from '../strategies';
import type { Gig, TycoonState } from '../types';

const game = (): TycoonState => createTycoonGame({ companyName: 'P', color: '#f00', seed: 5, country: 'GB', startYear: 1995 });
const rng = (chance: boolean) => ({ next: () => 0.5, chance: () => chance, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a }) as never;

describe('financial pressure', () => {
  it('office overheads grow with the company and with last year’s turnover', () => {
    const s = game();
    const base = monthlyOverheads(s);
    expect(base).toBeGreaterThan(0);
    const bigger = { ...s, people: [...s.people, ...s.people] };
    expect(monthlyOverheads(bigger)).toBe(base + s.people.length * OVERHEAD.perPerson);
    const later = { ...s, hour: 24 * 400, ledger: { ...s.ledger, [s.startYear]: { shows: 1_200_000 } } };
    expect(monthlyOverheads(later)).toBe(base + Math.round((1_200_000 * OVERHEAD.turnover) / 12));
  });

  it('factoring costs more the longer the promoter would have taken', () => {
    expect(factorDiscount(PAYMENT_DAYS[4])).toBeGreaterThan(factorDiscount(PAYMENT_DAYS[2]));
    expect(factorDiscount(60)).toBeLessThan(0.06);
  });

  it('promoters pay rivals on the same terms: the fee lands weeks after a big show', () => {
    const s = game();
    const r = s.rivals.find(x => styleOf(x, 1995).label === 'Steady')!;
    const ops = opsOf(s, r);
    const gig = { id: 'g', act: 'A', tier: 3, day: 10, fee: 30000, needs: {}, crewNeeded: 4, status: 'rival', rivalId: r.id } as unknown as Gig;
    s.gigs.push(gig);
    const before = ops.cash;
    playRivalShow(s, r, gig, rng(false));
    expect(ops.cash).toBeLessThan(before); // paid the costs, not yet the fee
    expect(ops.owed?.length).toBe(1);
    expect(ops.owed![0].day).toBe(10 + PAYMENT_DAYS[3]);
    s.hour = 24 * (ops.owed![0].day + 1);
    const mid = ops.cash;
    const fee = ops.owed![0].amount;
    const overhead = rivalOverhead(ops);
    // Idle kit earns a little on dry hire each month too (hire.ts).
    const dry = rivalDryHireIncome(s, ops, r.maxTier, DRY_HIRE_IDLE);
    monthlyRivalOps(s, r, rng(false));
    expect(ops.owed?.length).toBe(0);
    expect(ops.cash).toBe(mid + fee - overhead + dry);
  });
});
