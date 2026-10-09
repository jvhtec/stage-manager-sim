import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { makeDecision } from '../actions';
import { ARGUE_WIN, HELD_BACK, SETTLE_SHARE, maybeDisputeClaim, maybeDisputeShow, promoterDisputeChance } from '../disputes';
import { CLEAN_DISCOUNT, CLAIM_LOADING, claimsRecord, premiumFactor, monthlyPremium } from '../incidents';
import type { Gig, TycoonState } from '../types';

const yes = { next: () => 0, chance: () => true, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;
const no = { ...(yes as object), chance: () => false } as never;

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 91, country: 'GB', startYear: 1995 });
  s.company.cash = 500_000;
  return s;
};
const gig = (extra: Partial<Gig> = {}) => ({ id: 'g1', act: 'The Band', tier: 3, fee: 10000, venueId: 'v1', cityId: 'c', ...extra }) as Gig;

describe('promoter disputes', () => {
  it('only poor nights at proper venues, and more likely the worse it was', () => {
    const s = game();
    expect(promoterDisputeChance(s, gig(), 0.9)).toBe(0);
    expect(promoterDisputeChance(s, gig({ tier: 1 }), 0.3)).toBe(0);
    expect(promoterDisputeChance(s, gig(), 0.3)).toBeGreaterThan(promoterDisputeChance(s, gig(), 0.55));
    s.venueRelations = { v1: 6 };
    expect(promoterDisputeChance(s, gig(), 0.55)).toBeLessThan(promoterDisputeChance(game(), gig(), 0.55));
  });

  it('a dispute holds back a share of the payout and asks what to do', () => {
    let held = 0;
    let s = game();
    for (let i = 0; i < 40 && !held; i++) {
      s = game();
      s.hour = i * 24;
      held = maybeDisputeShow(s, gig({ id: `g${i}` }), 8000, 0.2);
    }
    expect(held).toBe(Math.round((8000 * HELD_BACK) / 10) * 10);
    const d = s.dilemmas.find(x => x.kind === 'dispute')!;
    expect(d.defaultOption).toBe('settle');
    expect(d.options.map(o => o.id)).toEqual(['settle', 'argue', 'lawyers']);
    const cash = s.company.cash;
    const out = makeDecision(s, d.id, 'settle').state;
    expect(out.company.cash - cash).toBe(Math.round(held * SETTLE_SHARE));
  });

  it('arguing is a gamble that cools the relationship; lawyers cost up front', () => {
    let wins = 0;
    let losses = 0;
    for (let i = 0; i < 60; i++) {
      let s = game();
      s.hour = i * 24 + 3;
      s.venueRelations = { v1: 3 };
      let held = 0;
      for (let k = 0; k < 40 && !held; k++) {
        s = game();
        s.venueRelations = { v1: 3 };
        s.hour = (i * 40 + k) * 24 + 3;
        held = maybeDisputeShow(s, gig({ id: `x${i}-${k}` }), 8000, 0.1);
      }
      const d = s.dilemmas.find(x => x.kind === 'dispute')!;
      const before = s.company.cash;
      const out = makeDecision(s, d.id, 'argue').state;
      if (out.company.cash > before) wins++;
      else losses++;
      expect(out.venueRelations!.v1).toBeLessThan(3);
    }
    expect(wins).toBeGreaterThan(0);
    expect(losses).toBeGreaterThan(0);
    expect(ARGUE_WIN).toBeGreaterThan(0.5);
  });
});

describe('insurance claims', () => {
  it('a big claim can be disputed, with a settle-or-fight decision', () => {
    const s = game();
    expect(maybeDisputeClaim(s, 800, 600, false, yes)).toBe(false);
    expect(maybeDisputeClaim(s, 5000, 5000, false, no)).toBe(false);
    expect(maybeDisputeClaim(s, 5000, 5000, false, yes)).toBe(true);
    const d = s.dilemmas.find(x => x.kind === 'dispute')!;
    const cash = s.company.cash;
    const out = makeDecision(s, d.id, 'settle').state;
    expect(out.company.cash - cash).toBe(2500);
    const f = makeDecision(s, d.id, 'fight');
    expect(f.result.ok).toBe(true);
    expect(f.state.company.cash).toBeLessThan(cash + 5000 + 1);
  });

  it('claims load the premium for a year, and two clean years earn a discount', () => {
    const s = game();
    s.hour = 24 * 800;
    expect(claimsRecord(s).clean).toBe(true);
    expect(premiumFactor(s)).toBeCloseTo(1 - CLEAN_DISCOUNT);
    s.policies.insurance = 'full';
    const clean = monthlyPremium(s);
    s.claims = [800 - 20, 800 - 100];
    expect(claimsRecord(s).lastYear).toBe(2);
    expect(premiumFactor(s)).toBeCloseTo(1 + 2 * CLAIM_LOADING);
    expect(monthlyPremium(s)).toBeGreaterThan(clean);
    s.claims = [800 - 400];
    expect(claimsRecord(s).lastYear).toBe(0);
    expect(claimsRecord(s).clean).toBe(false);
    expect(premiumFactor(s)).toBe(1);
  });
});
