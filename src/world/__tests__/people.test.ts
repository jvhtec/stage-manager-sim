import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createTycoonGame, migrate } from '../state';
import { advanceHours } from '../sim';
import { fireMember, hireCandidate } from '../actions';
import { HOURS_PER_DAY } from '../catalog';
import { NAMES } from '../content/names';
import { crewSlots, evaluateCrew, learnFromShow, levelOf, makePerson, peopleLeave, pickCrew, syncCrew } from '../people';
import type { CrewMember, Gig, TycoonState } from '../types';

const game = (country: TycoonState['country'] = 'ES'): TycoonState => {
  const s = createTycoonGame({ companyName: 'P', color: '#f00', seed: 61, country, startYear: 1995 });
  return { ...s, company: { ...s.company, cash: 1_000_000 } };
};
const person = (s: TycoonState, primary: CrewMember['primary'], level: number): CrewMember => {
  const m = makePerson(s, createRng(level * 7 + primary.length), level, primary);
  m.skills = { audio: 0, lighting: 0, video: 0, stage: 0, [primary]: level };
  m.trait = undefined;
  return m;
};
const lightShow = { tier: 3, needs: { audio: 2, console: 0, lighting: 10, video: 0, stage: 0 }, crewNeeded: 4 } as unknown as Gig;

describe('named crew', () => {
  it('start with five named people from your country', () => {
    const s = game('ES');
    expect(s.people.length).toBe(5);
    const [first, last] = [s.people[0].name.split(' ')[0], s.people[0].name.split(' ').slice(1).join(' ')];
    expect(NAMES.ES.first).toContain(first);
    expect(NAMES.ES.last).toContain(last);
    expect(s.depots[0].crew).toBe(5);
  });

  it('fill a show’s department slots with the best-matched people', () => {
    const s = game();
    expect(crewSlots(lightShow).lighting).toBeGreaterThan(crewSlots(lightShow).audio);
    const lx = [person(s, 'lighting', 4), person(s, 'lighting', 4), person(s, 'lighting', 3), person(s, 'audio', 2)];
    const wrong = [person(s, 'stage', 4), person(s, 'stage', 4), person(s, 'stage', 3), person(s, 'audio', 2)];
    expect(evaluateCrew(lx, lightShow).effective).toBeGreaterThan(evaluateCrew(wrong, lightShow).effective + 1);
    const pool = [...wrong, ...lx];
    const picked = pickCrew(pool, lightShow, 3);
    expect(picked.filter(m => m.primary === 'lighting').length).toBeGreaterThanOrEqual(2);
  });

  it('level up in the department they work', () => {
    const s = game();
    const m = person(s, 'audio', 1);
    const assigned = new Map([[m.id, 'audio' as const]]);
    for (let i = 0; i < 12; i++) learnFromShow(s, [m], assigned, false);
    expect(levelOf(m)).toBeGreaterThanOrEqual(2);
  });

  it('stars get poached when morale is low', () => {
    const s = game();
    const star = person(s, 'audio', 5);
    star.depotId = s.depots[0].id;
    s.people.push(star);
    const rng = { next: () => 0, chance: () => true, pick: <T,>(a: T[]) => a[0] } as never;
    peopleLeave(s, rng, 20);
    expect(s.people.some(m => m.id === star.id)).toBe(false);
    expect(s.news[0].text).toMatch(/poach/);
  });

  it('hire from the market and let people go', () => {
    let s = game();
    expect(s.candidates.length).toBeGreaterThan(0);
    const c = s.candidates[0];
    s = hireCandidate(s, c.id).state;
    expect(s.people.some(m => m.id === c.id)).toBe(true);
    expect(s.candidates.some(m => m.id === c.id)).toBe(false);
    s = fireMember(s, c.id).state;
    expect(s.people.some(m => m.id === c.id)).toBe(false);
    s = advanceHours(s, 40 * HOURS_PER_DAY);
    expect(s.candidates.length).toBeGreaterThan(0); // refreshed monthly
  });

  it('old saves turn headcounts into people', () => {
    const s = game() as Partial<TycoonState>;
    const old = { ...s, people: undefined, candidates: undefined, depots: s.depots!.map(d => ({ ...d, crew: 7, experience: 60 })) } as unknown as Partial<TycoonState>;
    const m = migrate(structuredClone(old));
    expect(m.people.length).toBe(7);
    expect(m.people.every(p => levelOf(p) >= 2)).toBe(true);
    syncCrew(m);
    expect(m.depots[0].crew).toBe(7);
  });
});
