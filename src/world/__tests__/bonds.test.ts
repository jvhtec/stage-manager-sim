import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { BURNOUT_QUIT, bondAfterShow, burnoutFactor, chemistry, dailyBurnout, loyaltyFactor, pairKey, rapport, REFUSE, TRUSTED, teamEffect } from '../bonds';
import { burnoutLeave, evaluateCrew, pickCrew } from '../people';
import type { CrewMember, Gig, TycoonState } from '../types';

const game = (): TycoonState => createTycoonGame({ companyName: 'B', color: '#f00', seed: 7, country: 'GB', startYear: 1995 });
const gig = { id: 'g', tier: 2, needs: { audio: 2, console: 1, lighting: 2, video: 0, stage: 1 }, crewNeeded: 4 } as unknown as Gig;

describe('crew relationships', () => {
  it('chemistry is fixed per pair and symmetric', () => {
    expect(chemistry('a', 'b')).toBe(chemistry('b', 'a'));
    expect(pairKey('b', 'a')).toBe('a|b');
  });

  it('good nights build rapport into a trusted team that works better together', () => {
    const s = game();
    const [a, b] = s.people;
    for (let i = 0; i < 40; i++) bondAfterShow(s, [a, b], 0.9);
    // Whatever their chemistry, forty great nights together make them closer than strangers — unless they really clash.
    const r = rapport(s, a.id, b.id);
    if (chemistry(a.id, b.id) > -0.5) expect(r).toBeGreaterThanOrEqual(TRUSTED);
    s.bonds = { [pairKey(a.id, b.id)]: 60 };
    const together = evaluateCrew([a, b], gig, s);
    const strangers = evaluateCrew([a, b], gig, { bonds: {} });
    expect(together.effective).toBeGreaterThan(strangers.effective);
    expect(together.failureFactor).toBeLessThan(strangers.failureFactor);
    expect(together.trusted).toBe(1);
  });

  it('a feud costs the show, and past the line they refuse to board together unless named', () => {
    const s = game();
    const [a, b, c] = s.people;
    s.bonds = { [pairKey(a.id, b.id)]: REFUSE - 5 };
    expect(teamEffect(s, [a, b]).quality).toBeLessThan(0);
    expect(evaluateCrew([a, b], gig, s).feuds).toHaveLength(1);
    const pool = [b, c].map(m => ({ ...m, fatigue: 0, depotId: 'd', vehicleId: undefined })) as CrewMember[];
    const picked = pickCrew([...pool], gig, 2, [a], { bonds: s.bonds });
    expect(picked.map(m => m.id)).not.toContain(b.id);
    const forced = pickCrew([...pool], gig, 2, [a], { bonds: s.bonds, prefer: new Set([b.id]) });
    expect(forced.map(m => m.id)).toContain(b.id);
  });

  it('weeks exhausted on the road leave lasting burnout; burnt-out people work worse and leave', () => {
    const s = game();
    const m = s.people[0];
    m.vehicleId = 'v';
    m.depotId = undefined;
    m.fatigue = 90;
    for (let i = 0; i < 60; i++) dailyBurnout(m);
    expect(m.burnout).toBeGreaterThanOrEqual(BURNOUT_QUIT);
    expect(burnoutFactor(m)).toBeLessThan(1);
    m.vehicleId = undefined;
    m.depotId = s.depots[0].id;
    const before = s.people.length;
    const always = { chance: () => true } as never;
    expect(burnoutLeave(s, always)).toBeGreaterThan(0);
    expect(s.people.length).toBeLessThan(before);
  });

  it('long service makes people harder to poach', () => {
    expect(loyaltyFactor({ hiredHour: 0 }, 24 * 365 * 8)).toBeLessThan(loyaltyFactor({ hiredHour: 0 }, 24 * 30));
  });
});
