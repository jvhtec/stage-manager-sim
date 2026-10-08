import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { answerDeal, buyGear, hireStaff, leaseVehicle, sellVehicle, setPolicy, startRnd } from '../actions';
import { HOURS_PER_DAY } from '../catalog';
import { creditLimit, leaseMonthly } from '../finance';
import { getProduct, isOwnProduct } from '../content/gear';
import { monthlyRnd, rndBlocker } from '../rnd';
import { activeDealFor, monthlyDeals, strike } from '../deals';
import { monthlyTraining } from '../crew';
import type { TycoonState } from '../types';

const game = (rep = 70): TycoonState => {
  const s = createTycoonGame({ companyName: 'Acme Audio', color: '#f00', seed: 51, country: 'GB', startYear: 1995 });
  return { ...s, company: { ...s.company, cash: 5_000_000, reputation: rep }, gigs: [], tours: [] };
};
const always = { next: () => 0.99, chance: () => false, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;
const yes = { next: () => 0, chance: () => true, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;

describe('finance', () => {
  it('the credit line grows with what you own', () => {
    const s = game();
    const base = creditLimit(s);
    const richer = buyGear(s, s.depots[0].id, Object.keys(s.depots[0].gear)[0], 30).state;
    expect(creditLimit(richer)).toBeGreaterThan(base);
  });

  it('leasing costs a month up front, monthly after, and a penalty to hand back early', () => {
    let s = game();
    const cash = s.company.cash;
    s = leaseVehicle(s, s.depots[0].id, 'luton-box').state;
    expect(cash - s.company.cash).toBe(leaseMonthly('luton-box'));
    const v = s.vehicles[s.vehicles.length - 1];
    expect(v.lease).toBeDefined();
    s = advanceHours(s, 40 * HOURS_PER_DAY);
    expect(s.ledger[1995]?.leasing ?? 0).toBeLessThan(-leaseMonthly('luton-box'));
    const before = s.company.cash;
    s = sellVehicle(s, v.id).state;
    expect(s.vehicles.some(x => x.id === v.id)).toBe(false);
    expect(before - s.company.cash).toBe(leaseMonthly('luton-box') * 2);
  });
});

describe('R&D', () => {
  it('needs standing and engineers, then delivers your own product with royalties', () => {
    expect(rndBlocker(game(10), 'audio')).toMatch(/reputation/);
    let s = game();
    expect(rndBlocker(s, 'audio')).toMatch(/prep staff/);
    s = hireStaff(s, s.depots[0].id, 'warehouse').state;
    s = startRnd(s, 'audio', 'refine').state;
    expect(s.projects.length).toBe(1);
    for (let m = 0; m < 9; m++) monthlyRnd(s, always);
    expect(s.projects[0].status).toBe('done');
    const id = s.ownProducts[0];
    expect(isOwnProduct(id)).toBe(true);
    const p = getProduct(id);
    expect(p.brand).toBe('Acme Audio');
    expect(p.dept).toBe('audio');
    expect(buyGear(s, s.depots[0].id, id, 2).result.ok).toBe(true);
    const cash = s.company.cash;
    monthlyRnd(s, always);
    expect(s.company.cash).toBeGreaterThan(cash);
  });
});

describe('production deals', () => {
  it('acts you love offer exclusivity; two strikes and they walk', () => {
    const s = game();
    s.artistRelations['Oasis'] = 4;
    monthlyDeals(s, yes);
    const offer = s.deals.find(d => d.act === 'Oasis');
    expect(offer?.status).toBe('offer');
    const signed = answerDeal(s, offer!.id, true).state;
    expect(activeDealFor(signed, 'Oasis')).toBeDefined();
    strike(signed, 'Oasis', 'test');
    expect(activeDealFor(signed, 'Oasis')).toBeDefined();
    strike(signed, 'Oasis', 'test');
    expect(activeDealFor(signed, 'Oasis')).toBeUndefined();
    expect(signed.artistRelations['Oasis']).toBe(0);
  });
});

describe('crew training', () => {
  it('training improves the people at base', () => {
    let s = game();
    const before = s.people.reduce((sum, m) => sum + m.xp[m.primary], 0);
    s = setPolicy(s, 'training', 'academy').state;
    monthlyTraining(s);
    const after = s.people.reduce((sum, m) => sum + m.xp[m.primary] + m.skills[m.primary] * 100, 0);
    expect(after).toBeGreaterThan(before + s.people.reduce((sum, m) => sum + m.skills[m.primary] * 100, 0) - 1);
  });
});
