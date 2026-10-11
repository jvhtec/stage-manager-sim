import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { dayOf } from '../core';
import { clientTemper } from '../changes';
import { DAMAGES, MAX_DOCK, contractDock, damagesFor, outcomeOf } from '../outcomes';
import { DEMAND_DAYS, bridgeOffer, dailyLiquidity, inBreach, monthlyLiquidity, overdraftLimit, takeBridge } from '../liquidity';
import { OWNER_SPAN, officeCapacity, officeLoad, officeStretch } from '../office';
import { shareCeiling, shareThrottle } from '../territory';
import { moraleTarget } from '../crew';
import { borrow } from '../actions';
import { DIFFICULTIES } from '../scenario';
import type { Gig, TycoonState } from '../types';

const game = (difficulty: 'easy' | 'normal' | 'hard' = 'normal'): TycoonState => createTycoonGame({ companyName: 'D', color: '#f00', seed: 8, country: 'GB', startYear: 1995, difficulty });
const actOf = (temper: 'easy' | 'fair' | 'pushy') => {
  for (let i = 0; i < 500; i++) if (clientTemper(`Act ${i}`) === temper) return `Act ${i}`;
  throw new Error('no act');
};
const gig = (extra: Partial<Gig> = {}) => ({ act: actOf('fair'), fee: 10000, tier: 3, ...extra }) as Gig;

describe('show outcomes and contract penalties', () => {
  it('bands nights by quality, with the failure line set by difficulty', () => {
    const s = game();
    expect(outcomeOf(s, 0.9)).toBe('triumph');
    expect(outcomeOf(s, 0.7)).toBe('solid');
    expect(outcomeOf(s, 0.55)).toBe('shaky');
    expect(outcomeOf(s, 0.4)).toBe('bad');
    expect(outcomeOf(s, 0.3)).toBe('failed');
    expect(outcomeOf(s, 0.9, false)).toBe('failed');
    expect(outcomeOf(game('easy'), 0.32)).toBe('bad');
    expect(outcomeOf(game('hard'), 0.38)).toBe('failed');
  });

  it('docks money for shaky and bad nights and late doors, more from pushy clients, capped', () => {
    const s = game();
    expect(contractDock(s, gig(), 0.9, 0, 10000).total).toBe(0);
    const shaky = contractDock(s, gig(), 0.55, 0, 10000).total;
    const bad = contractDock(s, gig(), 0.4, 0, 10000).total;
    expect(shaky).toBeGreaterThan(0);
    expect(bad).toBeGreaterThan(shaky);
    const late = contractDock(s, gig(), 0.9, 3, 10000);
    expect(late.late).toBeGreaterThan(0);
    expect(late.quality).toBe(0);
    expect(contractDock(s, gig({ act: actOf('pushy') }), 0.4, 0, 10000).total).toBeGreaterThan(contractDock(s, gig({ act: actOf('easy') }), 0.4, 0, 10000).total);
    expect(contractDock(s, gig(), 0.4, 10, 1000).total).toBeLessThanOrEqual(1000 * MAX_DOCK);
    expect(contractDock(game('hard'), gig(), 0.55, 0, 10000).total).toBeGreaterThan(contractDock(game('easy'), gig(), 0.55, 0, 10000).total);
  });

  it('a failed stadium show costs far more in damages than a failed club night', () => {
    const s = game();
    expect(damagesFor(s, gig({ tier: 4 }))).toBeGreaterThan(damagesFor(s, gig({ tier: 1 })) * 3);
    expect(damagesFor(s, gig({ tier: 4 }))).toBe(Math.round(10000 * DAMAGES[4]));
  });
});

describe('liquidity', () => {
  it('arranges an overdraft from unused credit, and borrowing eats into it', () => {
    const s = game();
    const before = overdraftLimit(s);
    expect(before).toBeGreaterThan(0);
    const t = borrow(s).state;
    expect(overdraftLimit(t)).toBeLessThan(before);
    expect(overdraftLimit(game('easy'))).toBeGreaterThan(overdraftLimit(game('hard')));
  });

  it('inside the overdraft you pay interest; over it, wages go late and freelancers and hire desks want cash', () => {
    const s = game();
    s.company.cash = -Math.round(overdraftLimit(s) / 2);
    const cash = s.company.cash;
    dailyLiquidity(s);
    expect(s.company.cash).toBeLessThan(cash);
    expect(inBreach(s)).toBe(false);
    const target = moraleTarget(s);
    s.company.cash = -overdraftLimit(s) - 50_000;
    dailyLiquidity(s);
    expect(inBreach(s)).toBe(true);
    expect(moraleTarget(s)).toBeLessThan(target);
    expect(s.incidentTally?.causes['over-limit']).toBe(1);
  });

  it('after the bank’s patience it makes a demand; miss it and the administrators come in', () => {
    const s = game();
    const patience = DIFFICULTIES.normal.bankPatience;
    for (let d = 0; d < patience + DEMAND_DAYS + 1 && !s.gameOver; d++) {
      s.company.cash = -overdraftLimit(s) - 100_000;
      s.hour += 24;
      dailyLiquidity(s);
      if (d === patience - 1) expect(s.liquidity?.demandDay).toBe(dayOf(s.hour) + DEMAND_DAYS);
    }
    expect(s.gameOver?.reason).toMatch(/administrators/);
  });

  it('getting back inside the limit clears the demand', () => {
    const s = game();
    for (let d = 0; d < DIFFICULTIES.normal.bankPatience + 2; d++) {
      s.company.cash = -overdraftLimit(s) - 10_000;
      s.hour += 24;
      dailyLiquidity(s);
    }
    expect(s.liquidity?.demandDay).toBeDefined();
    s.company.cash = 10_000;
    dailyLiquidity(s);
    expect(s.liquidity?.demandDay).toBeUndefined();
    expect(inBreach(s)).toBe(false);
  });

  it('months living in the overdraft get it cut in half', () => {
    const s = game();
    const full = overdraftLimit(s);
    for (let m = 0; m < DIFFICULTIES.normal.graceMonths; m++) {
      s.company.cash = -1000;
      monthlyLiquidity(s);
    }
    expect(Math.abs(overdraftLimit(s) - full / 2)).toBeLessThanOrEqual(1000);
    expect(s.liquidity?.history.withdrawn).toBe(1);
  });

  it('bridging finance is there over the limit, once, at a price', () => {
    const s = game();
    expect(bridgeOffer(s)).toBe(0);
    s.company.cash = -overdraftLimit(s) - 20_000;
    dailyLiquidity(s);
    const offer = bridgeOffer(s);
    expect(offer).toBeGreaterThan(0);
    const loan = s.company.loan;
    expect(takeBridge(s)).toBe(offer);
    expect(s.company.loan).toBe(loan + offer);
    expect(bridgeOffer(s)).toBe(0);
  });

  it('a company deep in the red still ends in administration, slower on easy', () => {
    const ended = (d: 'easy' | 'hard') => {
      let s = game(d);
      s.company.cash = -800_000;
      s = advanceHours(s, 24 * 200);
      return s.gameOver ? s.gameOver.hour : Infinity;
    };
    expect(ended('hard')).toBeLessThan(ended('easy'));
  });
});

describe('overexpansion', () => {
  it('the founder runs a few trucks alone; past that the office needs staff and heads', () => {
    const s = game();
    expect(officeCapacity(s)).toBe(OWNER_SPAN);
    expect(officeStretch(s)).toBe(0);
    const big = { ...s, vehicles: Array.from({ length: 12 }, (_, i) => ({ ...s.vehicles[0], id: `v${i}` })), people: [...s.people, ...s.people, ...s.people] };
    expect(officeLoad(big)).toBeGreaterThan(OWNER_SPAN);
    expect(officeStretch(big)).toBeGreaterThan(0);
    const staffed = { ...big, depots: big.depots.map(d => ({ ...d, staff: { ...d.staff, office: 4 } })), managers: { production: true } as never };
    expect(officeStretch(staffed)).toBeLessThan(officeStretch(big));
  });

  it('promoters spread work away from a firm that has too much of a town', () => {
    const s = game();
    const town = s.depots[0].cityId;
    s.townShows = { [town]: { player: 8, r1: 2 } };
    s.company.reputation = 40;
    expect(shareCeiling(s)).toBeLessThan(0.8);
    expect(shareThrottle(s, town)).toBeLessThan(1);
    s.townShows = { [town]: { player: 2, r1: 8 } };
    expect(shareThrottle(s, town)).toBe(1);
    s.townShows = { [town]: { player: 2 } };
    expect(shareThrottle(s, town)).toBe(1); // too few shows to judge
  });
});
