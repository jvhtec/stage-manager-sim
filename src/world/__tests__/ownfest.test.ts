import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { makeDecision, promoteFestival } from '../actions';
import { advanceHours } from '../sim';
import { COVER_COST_PER_HEAD, FEST_TIERS, dailyOwnFestival, festBlocker, festDemand, festQuote } from '../ownfest';
import { dayOf } from '../core';
import type { TycoonState } from '../types';

const never = { next: () => 0.5, chance: () => false, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;
const storm = { ...(never as object), chance: () => true } as never;

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 3, country: 'GB', startYear: 1995 });
  s.company.cash = 5_000_000;
  s.company.reputation = 60;
  return s;
};
const planned = (s = game()) => {
  const out = promoteFestival(s, 'field', 'name', 'fair', s.depots[0].cityId);
  expect(out.result.ok).toBe(true);
  return out.state;
};
const toDay = (s: TycoonState, d: number) => {
  s.hour = d * 24;
  return s;
};

describe('own festival', () => {
  it('is paid for up front, with a cheaper production bill for a bigger fleet', () => {
    const s = game();
    const small = festQuote(s, 'field', 'local');
    expect(festQuote(s, 'field', 'star').total).toBeGreaterThan(small.total);
    expect(festQuote(s, 'major', 'local').total).toBeGreaterThan(small.total * 5);
    const before = s.company.cash;
    const t = planned(s);
    expect(before - t.company.cash).toBe(festQuote(s, 'field', 'name').total);
    expect(t.ownFestival?.status).toBe('planned');
    s.vehicles.push(...s.vehicles.map(v => ({ ...v, id: v.id + 'x' })));
    expect(festQuote(s, 'field', 'name').production).toBeLessThan(small.production * 1.0001);
  });

  it('has gates: reputation, cash, one a year, and a planning window', () => {
    const s = game();
    s.company.reputation = 10;
    expect(festBlocker(s, 'field', 'local')).toMatch(/reputation/);
    const t = game();
    t.company.cash = 100;
    expect(festBlocker(t, 'field', 'local')).toMatch(/up front/);
    const u = planned();
    expect(promoteFestival(u, 'field', 'local', 'fair', u.depots[0].cityId).result.ok).toBe(false);
    const v = game();
    v.hour = 24 * 200;
    expect(festBlocker(v, 'field', 'local')).toMatch(/Too late/);
    expect(promoteFestival(game(), 'field', 'local', 'fair', 'nowhere').result.ok).toBe(false);
  });

  it('demand rises with brand, a bigger name and a cheaper ticket', () => {
    const s = planned();
    const f = s.ownFestival!;
    const base = festDemand(s, f);
    s.festivalBrand = 80;
    expect(festDemand(s, f)).toBeGreaterThan(base);
    expect(festDemand(s, { ...f, headliner: 'star' })).toBeGreaterThan(festDemand(s, { ...f, headliner: 'local' }));
    expect(festDemand(s, { ...f, ticket: 'low' })).toBeGreaterThan(festDemand(s, { ...f, ticket: 'premium' }));
  });

  it('settles on the day: revenue, brand, history, news', () => {
    const s = planned();
    s.festivalBrand = 90;
    const cash = s.company.cash;
    toDay(s, s.ownFestival!.day);
    dailyOwnFestival(s, never);
    expect(s.ownFestival!.status).toBe('done');
    expect(s.company.cash).toBeGreaterThan(cash);
    expect(s.festivalHistory.length).toBe(1);
    expect(s.festivalHistory[0].attendance).toBeLessThanOrEqual(FEST_TIERS.field.capacity);
    expect(s.news.some(n => /your festival/.test(n.text))).toBe(true);
    // Only settles once.
    dailyOwnFestival(s, never);
    expect(s.festivalHistory.length).toBe(1);
  });

  it('a storm empties the field unless you covered the stages', () => {
    const open = planned();
    const covered = planned();
    covered.ownFestival!.covered = true;
    [open, covered].forEach(s => (s.festivalBrand = 60));
    [open, covered].forEach(s => {
      toDay(s, s.ownFestival!.day);
      dailyOwnFestival(s, storm);
    });
    expect(covered.ownFestival!.result!.attendance).toBeGreaterThan(open.ownFestival!.result!.attendance);
    expect(open.ownFestival!.result!.stormed).toBe(true);
  });

  it('asks about the weather two days out, and the cover decision is paid for', () => {
    const s = planned();
    toDay(s, s.ownFestival!.day - 2);
    dailyOwnFestival(s, never);
    const d = s.dilemmas.find(x => x.kind === 'ownfest')!;
    expect(d).toBeTruthy();
    const cash = s.company.cash;
    const out = makeDecision(s, d.id, 'cover');
    expect(out.result.ok).toBe(true);
    expect(out.state.ownFestival!.covered).toBe(true);
    expect(cash - out.state.company.cash).toBe(Math.round((FEST_TIERS.field.capacity * COVER_COST_PER_HEAD) / 100) * 100);
  });

  it('a first edition rarely pays; a sold-out brand does', () => {
    const run = (brand: number) => {
      const s = planned();
      s.festivalBrand = brand;
      toDay(s, s.ownFestival!.day);
      dailyOwnFestival(s, never);
      return s.ownFestival!.result!.profit;
    };
    expect(run(0)).toBeLessThan(run(90));
  });

  it('runs through the real clock without breaking', () => {
    const s = planned();
    const later = advanceHours(s, 24 * (s.ownFestival!.day - dayOf(s.hour) + 3));
    expect(later.ownFestival?.status).toBe('done');
  });
});
