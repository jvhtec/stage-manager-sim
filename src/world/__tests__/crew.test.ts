import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { setPolicy } from '../actions';
import { HOURS_PER_DAY } from '../catalog';
import { totalCrew } from '../core';
import { crewEffectiveness, dailyCrew } from '../crew';
import type { TycoonState } from '../types';

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'C', color: '#f00', seed: 7, country: 'GB', startYear: 1990 });
  return { ...s, company: { ...s.company, cash: 2_000_000 }, gigs: [], tours: [] };
};

describe('crew', () => {
  it('tire on the road, recover at home, and work worse when tired', () => {
    const s = game();
    const v = s.vehicles.find(x => x.owner === 'player')!;
    v.crew = 3;
    v.status = 'on-site';
    for (let i = 0; i < 15; i++) dailyCrew(s);
    expect(v.crewFatigue).toBeGreaterThan(50);
    expect(crewEffectiveness(v.crewFatigue!)).toBeLessThan(0.9);
    expect(crewEffectiveness(10)).toBe(1);
    s.depots[0].fatigue = 80;
    for (let i = 0; i < 8; i++) dailyCrew(s);
    expect(s.depots[0].fatigue).toBe(0);
  });

  it('pay sets wages and morale; badly paid crews quit', () => {
    const base = game();
    const lowPaid = advanceHours(setPolicy(base, 'pay', 'low').state, 120 * HOURS_PER_DAY);
    const highPaid = advanceHours(setPolicy(base, 'pay', 'high').state, 120 * HOURS_PER_DAY);
    expect(highPaid.crewMorale).toBeGreaterThan(80);
    expect(lowPaid.crewMorale).toBeLessThan(50);
    expect(-(highPaid.ledger[1990]?.wages ?? 0)).toBeGreaterThan(-(lowPaid.ledger[1990]?.wages ?? 0));

    let miserable = setPolicy({ ...base, crewMorale: 10 }, 'pay', 'low').state;
    miserable.depots[0].crew = 20;
    const before = totalCrew(miserable);
    miserable = advanceHours(miserable, 35 * HOURS_PER_DAY);
    expect(totalCrew(miserable)).toBeLessThan(before);
    expect(miserable.news.some(n => /crew quit/.test(n.text))).toBe(true);
  });
});
