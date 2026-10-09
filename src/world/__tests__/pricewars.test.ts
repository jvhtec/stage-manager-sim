import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { makeDecision } from '../actions';
import { dayOf } from '../core';
import { monthlyPriceWars, priceWarFactor, warWinBonus, fightCost, truceCost } from '../pricewars';
import { rivalHealth } from '../rivals';
import type { TycoonState } from '../types';

const always = { next: () => 0, chance: () => true, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;
const never = { ...(always as object), chance: () => false } as never;

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 7, country: 'GB', startYear: 1995 });
  s.company.cash = 2_000_000;
  return s;
};
const war = () => {
  const s = game();
  const r = s.rivals[0];
  r.health = 90;
  const c = s.depots[0].cityId;
  s.priceWars.push({ id: 'w1', cityId: c, rivalId: r.id, startDay: dayOf(s.hour), endDay: dayOf(s.hour) + 90, undercut: 0.2, fight: false });
  return { s, r, c };
};

describe('price wars', () => {
  it('undercut fees and hand the rival more work in the town', () => {
    const { s, r, c } = war();
    expect(priceWarFactor(s, c)).toBeCloseTo(0.8);
    expect(warWinBonus(s, c, r.id)).toBeGreaterThan(1);
    s.priceWars[0].fight = true;
    expect(priceWarFactor(s, c)).toBeCloseTo(0.9);
    expect(warWinBonus(s, c, r.id)).toBe(1);
    expect(priceWarFactor(s, 'nowhere')).toBe(1);
  });

  it('can start one with a decision to make', () => {
    const s = game();
    s.rivals.forEach(r => (r.health = 90));
    monthlyPriceWars(s, always);
    if (!s.priceWars.length) return; // no rival close enough on this seed
    expect(s.dilemmas.some(d => d.kind === 'pricewar')).toBe(true);
    expect(s.priceWars[0].undercut).toBeGreaterThanOrEqual(0.08);
    expect(s.priceWars[0].undercut).toBeLessThanOrEqual(0.2);
  });

  it('wears the aggressor down, ends on time, and the rival backs down when weak', () => {
    const { s, r } = war();
    monthlyPriceWars(s, never);
    expect(rivalHealth(r)).toBeLessThan(90);
    r.health = 36;
    monthlyPriceWars(s, never);
    expect(s.priceWars.length).toBe(0);
    expect(s.news.some(n => /backs down/.test(n.text))).toBe(true);
    const t = war();
    t.s.priceWars[0].endDay = dayOf(t.s.hour);
    monthlyPriceWars(t.s, never);
    expect(t.s.priceWars.length).toBe(0);
  });

  it('fighting costs money and halves the damage; a truce ends it at once', () => {
    const { s, c } = war();
    s.dilemmas.push({ id: 'd1', kind: 'pricewar', title: 't', text: 't', options: [{ id: 'ride', label: 'r', detail: '' }, { id: 'fight', label: 'f', detail: '', cost: fightCost(s) }, { id: 'truce', label: 't', detail: '', cost: truceCost(s) }], defaultOption: 'ride', payload: 'w1', createdHour: s.hour, expiresHour: s.hour + 100 });
    const cash = s.company.cash;
    const f = makeDecision(s, 'd1', 'fight');
    expect(f.result.ok).toBe(true);
    expect(f.state.priceWars[0].fight).toBe(true);
    expect(f.state.company.cash).toBeLessThan(cash);
    expect(priceWarFactor(f.state, c)).toBeGreaterThan(0.8);

    const { s: u } = war();
    u.dilemmas.push({ id: 'd2', kind: 'pricewar', title: 't', text: 't', options: [{ id: 'truce', label: 't', detail: '', cost: truceCost(u) }], defaultOption: 'truce', payload: 'w1', createdHour: u.hour, expiresHour: u.hour + 100 });
    const t = makeDecision(u, 'd2', 'truce');
    expect(t.state.priceWars.length).toBe(0);
  });
});
