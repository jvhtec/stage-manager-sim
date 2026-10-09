import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { HOURS_PER_DAY, tierInfo } from '../catalog';
import { monthlyRivals } from '../rivals';
import type { TycoonState } from '../types';

const game = (): TycoonState => createTycoonGame({ companyName: 'R', color: '#f00', seed: 19, country: 'GB', startYear: 1995 });
const rng = (chance: boolean | ((p: number) => boolean), next = 0.99) =>
  ({ next: () => next, chance: typeof chance === 'function' ? chance : () => chance, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a }) as never;

describe('rivals grow, merge and start up', () => {
  it('healthy firms build their name and move up a tier; weak ones lose it', () => {
    const s = game();
    const [good, bad] = s.rivals;
    good.health = 90;
    good.maxTier = 2;
    good.reputation = tierInfo(3).minReputation + 4.95;
    bad.health = 30;
    const badRep = bad.reputation;
    // chance() false for health roll noise: next() high keeps health up.
    monthlyRivals(s, rng(p => p === 0.4));
    expect(good.reputation).toBeGreaterThan(tierInfo(3).minReputation + 5);
    expect(good.maxTier).toBe(3);
    expect(s.news.some(n => /outgrown/.test(n.text))).toBe(true);
    expect(bad.reputation).toBeLessThan(badRep);
  });

  it('a healthy rival absorbs a struggling one and inherits its reach', () => {
    const s = game();
    const [buyer, victim] = s.rivals;
    buyer.health = 95;
    victim.health = 15;
    victim.maxTier = 4;
    buyer.maxTier = 2;
    s.rivals.slice(2).forEach(r => (r.health = 50));
    const before = s.rivals.length;
    monthlyRivals(s, rng(p => p === 0.12));
    expect(s.rivals.some(r => r.id === victim.id)).toBe(false);
    expect(s.goneRivals).toContain(victim.id);
    expect(s.rivals.length).toBe(before - 1);
    expect(s.rivals.find(r => r.id === buyer.id)!.maxTier).toBe(4);
    expect(s.news.some(n => /absorbs struggling/.test(n.text))).toBe(true);
  });

  it('new firms open in a decent market and start small', () => {
    const s = game();
    s.rivals.forEach(r => (r.health = 60));
    const before = s.rivals.length;
    monthlyRivals(s, rng(p => p <= 0.08));
    expect(s.rivals.length).toBe(before + 1);
    const fresh = s.rivals[s.rivals.length - 1];
    expect(fresh.maxTier).toBe(2);
    expect(fresh.reputation).toBeLessThan(30);
    expect(new Set(s.rivals.map(r => r.name)).size).toBe(s.rivals.length);
    expect(new Set(s.rivals.map(r => `${r.hqCityId}:${r.lot}`)).size).toBe(s.rivals.length);
  });

  it('the market stays populated over a decade', () => {
    const s = game();
    s.company.cash = 50_000_000;
    const out = advanceHours(s, 365 * 10 * HOURS_PER_DAY);
    expect(out.rivals.length).toBeGreaterThanOrEqual(4);
    expect(out.rivals.length).toBeLessThanOrEqual(14);
    out.rivals.forEach(r => expect(r.reputation).toBeLessThanOrEqual(100));
  });
});
