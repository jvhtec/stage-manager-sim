import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { hireCrew, setPolicy } from '../actions';
import { HOURS_PER_DAY } from '../catalog';
import { crewEffectiveness, monthlyCrew } from '../crew';
import { dailyPeopleFatigue, fatigueFactor, moveToVehicle, syncCrew } from '../people';
import type { TycoonState } from '../types';

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'C', color: '#f00', seed: 7, country: 'GB', startYear: 1990 });
  return { ...s, company: { ...s.company, cash: 2_000_000 }, gigs: [], tours: [] };
};

describe('crew', () => {
  it('tire on the road, recover at home, and work worse when tired', () => {
    const s = game();
    const v = s.vehicles.find(x => x.owner === 'player')!;
    s.people.slice(0, 3).forEach(m => moveToVehicle(m, v.id));
    v.status = 'on-site';
    for (let i = 0; i < 15; i++) dailyPeopleFatigue(s);
    syncCrew(s);
    expect(v.crewFatigue).toBeGreaterThan(40);
    expect(fatigueFactor(v.crewFatigue!)).toBeLessThan(0.9);
    expect(crewEffectiveness(10)).toBe(1);
    const resting = s.people.find(m => m.depotId)!;
    resting.fatigue = 80;
    for (let i = 0; i < 8; i++) dailyPeopleFatigue(s);
    expect(resting.fatigue).toBe(0);
  });

  it('pay sets wages and morale; badly paid crews quit', () => {
    const base = game();
    const lowPaid = advanceHours(setPolicy(base, 'pay', 'low').state, 120 * HOURS_PER_DAY);
    const highPaid = advanceHours(setPolicy(base, 'pay', 'high').state, 120 * HOURS_PER_DAY);
    expect(highPaid.crewMorale).toBeGreaterThan(80);
    expect(lowPaid.crewMorale).toBeLessThan(50);
    expect(-(highPaid.ledger[1990]?.wages ?? 0)).toBeGreaterThan(-(lowPaid.ledger[1990]?.wages ?? 0));

    let miserable = setPolicy({ ...base, crewMorale: 10 }, 'pay', 'low').state;
    miserable = hireCrew(miserable, miserable.depots[0].id, 15).state;
    const before = miserable.people.length;
    // The month closes with morale still on the floor: people walk (rng stubbed so the test isn't luck).
    monthlyCrew(miserable, { chance: () => true, next: () => 0, pick: <T,>(a: T[]) => a[0] } as never);
    expect(miserable.people.length).toBeLessThan(before);
    expect(miserable.news.some(n => /crew gone/.test(n.text))).toBe(true);
  });
});
