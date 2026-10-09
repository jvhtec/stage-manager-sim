import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { headhunt, investigate, makeDecision } from '../actions';
import { HEAT_DIRTY, applyTrick, HEAT_HEADHUNT, INTEL_DAYS, INTEL_OFFER_FACTOR, RETALIATE_SUCCESS, addHeat, aggression, hasIntel, heatOf, intelFactor, monthlyRivalry, securityCost } from '../rivalry';
import { dayOf } from '../core';
import { rivalHealth } from '../rivals';
import type { TycoonState } from '../types';

const yes = { next: () => 0, chance: () => true, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;
const no = { ...(yes as object), chance: () => false } as never;

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 13, country: 'GB', startYear: 1995 });
  s.company.cash = 1_000_000;
  s.company.reputation = 60;
  s.rivals.forEach(r => (r.health = 80));
  return s;
};
const hostile = () => {
  const s = game();
  addHeat(s, s.rivals[0].id, 60);
  monthlyRivalry(s, yes);
  const d = s.dilemmas.find(x => x.kind === 'dirty');
  expect(d).toBeTruthy();
  return { s, d: d! };
};

describe('rivalry', () => {
  it('each rival has a stable grudge', () => {
    const s = game();
    s.rivals.forEach(r => {
      expect(aggression(r)).toBe(aggression(r));
      expect(aggression(r)).toBeGreaterThanOrEqual(0.2);
      expect(aggression(r)).toBeLessThanOrEqual(0.9);
    });
    expect(new Set(s.rivals.map(aggression)).size).toBeGreaterThan(1);
  });

  it('headhunting a rival heats things up; heat cools by itself', () => {
    const s = game();
    const r = s.rivals[0];
    const out = headhunt(s, r.id).state;
    expect(heatOf(out, r.id)).toBe(HEAT_HEADHUNT);
    const cool = game();
    cool.depots = []; // nobody to resent
    addHeat(cool, r.id, 20);
    monthlyRivalry(cool, no);
    expect(heatOf(cool, r.id)).toBeLessThan(20);
  });

  it('a hot rival plays dirty, one decision at a time', () => {
    const { s } = hostile();
    monthlyRivalry(s, yes);
    expect(s.dilemmas.filter(d => d.kind === 'dirty').length).toBe(1);
    const cold = game();
    monthlyRivalry(cold, yes);
    expect(cold.dilemmas.some(d => d.kind === 'dirty')).toBe(false);
    expect(HEAT_DIRTY).toBeGreaterThan(0);
  });

  it('ignoring a trick takes the damage', () => {
    const { s, d } = hostile();
    expect(d.payload).toMatch(/\|rumours$/);
    const rep = s.company.reputation;
    const out = makeDecision(s, d.id, 'ignore').state;
    expect(out.company.reputation).toBe(rep - 2);
    expect(out.dilemmas.some(x => x.id === d.id)).toBe(false);
  });

  it('the other tricks hit kit and the next show', () => {
    const s = game();
    s.depots[0].gear['meyer-upa1'] = 4;
    s.gearCondition['meyer-upa1'] = 90;
    const msg = applyTrick(s, 'tamper', yes);
    expect(s.gearCondition['meyer-upa1']).toBe(60);
    expect(msg).toMatch(/condition/);
    const t = game();
    t.gigs.push({ id: 'g1', act: 'X', status: 'booked', day: dayOf(t.hour) + 5 } as never);
    applyTrick(t, 'tipoff', yes);
    expect(t.gigs[t.gigs.length - 1].mods?.quality).toBeCloseTo(-0.05);
  });

  it('security costs money, stops the trick and cools things down', () => {
    const { s, d } = hostile();
    const rep = s.company.reputation;
    const id = s.rivals[0].id;
    const heat = heatOf(s, id);
    const out = makeDecision(s, d.id, 'security').state;
    expect(s.company.cash - out.company.cash).toBe(securityCost(s));
    expect(out.company.reputation).toBe(rep);
    expect(heatOf(out, id)).toBeLessThan(heat);
  });

  it('hitting back is a gamble: expose them, or it backfires', () => {
    let exposed = 0;
    let backfired = 0;
    for (let i = 0; i < 40; i++) {
      const { s, d } = hostile();
      s.hour += i * 24;
      const r = s.rivals[0];
      const health = rivalHealth(r);
      const out = makeDecision(s, d.id, 'retaliate').state;
      if (rivalHealth(out.rivals[0]) < health) exposed++;
      else backfired++;
    }
    expect(exposed).toBeGreaterThan(0);
    expect(backfired).toBeGreaterThan(0);
    expect(RETALIATE_SUCCESS).toBeGreaterThan(0.5);
  });

  it('an investigator gives intel for a while and makes that rival take fewer of your offers', () => {
    const s = game();
    const r = s.rivals[0];
    const cash = s.company.cash;
    const out = investigate(s, r.id);
    expect(out.result.ok).toBe(true);
    expect(out.state.company.cash).toBeLessThan(cash);
    expect(hasIntel(out.state, r.id)).toBe(true);
    expect(intelFactor(out.state, r.id)).toBe(INTEL_OFFER_FACTOR);
    expect(intelFactor(out.state, s.rivals[1].id)).toBe(1);
    expect(investigate(out.state, r.id).result.ok).toBe(false);
    const later = out.state;
    later.hour += 24 * (INTEL_DAYS + 1);
    expect(hasIntel(later, r.id)).toBe(false);
    expect(dayOf(later.hour)).toBeGreaterThan(INTEL_DAYS);
  });
});
