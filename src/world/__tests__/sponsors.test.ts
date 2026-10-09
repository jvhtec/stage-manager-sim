import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { makeDecision } from '../actions';
import { HAGGLE_RAISE, MAX_SHORTFALLS, SPONSOR_BRANDS, brandsFor, charityCost, monthlySponsors, sponsorTerms } from '../sponsors';
import type { TycoonState } from '../types';

const yes = { next: () => 0, chance: () => true, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;
const no = { ...(yes as object), chance: () => false } as never;

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 4, country: 'GB', startYear: 1995 });
  s.company.cash = 1_000_000;
  s.company.reputation = 50;
  s.stats.showsPlayed = 40;
  return s;
};
const offered = () => {
  const s = game();
  monthlySponsors(s, yes);
  const d = s.dilemmas.find(x => x.kind === 'sponsor')!;
  expect(d).toBeTruthy();
  return { s, d };
};

describe('sponsors and charity', () => {
  it('only brands that exist in the era come calling, one per category', () => {
    const s = game();
    const names = brandsFor(s).map(b => b.id);
    expect(names).toContain('crest');
    expect(names).not.toContain('streamly');
    expect(SPONSOR_BRANDS.every(b => !!b.name)).toBe(true);
  });

  it('offers need a name and some shows behind you', () => {
    const s = game();
    s.company.reputation = 5;
    monthlySponsors(s, yes);
    expect(s.dilemmas.some(d => d.kind === 'sponsor')).toBe(false);
    const t = game();
    t.stats.showsPlayed = 1;
    monthlySponsors(t, yes);
    expect(t.dilemmas.some(d => d.kind === 'sponsor')).toBe(false);
  });

  it('signing pays a monthly retainer for as long as you keep the shows coming', () => {
    const { s, d } = offered();
    const out = makeDecision(s, d.id, 'sign').state;
    const deal = out.sponsors[0];
    expect(deal.status).toBe('active');
    const cash = out.company.cash;
    out.stats.showsPlayed += deal.minShows;
    monthlySponsors(out, no);
    expect(out.company.cash - cash).toBe(deal.monthly);
    expect(deal.paid).toBe(deal.monthly);
  });

  it('a quiet month earns nothing; two in a row and they walk', () => {
    const { s, d } = offered();
    const out = makeDecision(s, d.id, 'sign').state;
    const cash = out.company.cash;
    for (let i = 0; i < MAX_SHORTFALLS; i++) monthlySponsors(out, no);
    expect(out.company.cash).toBe(cash);
    expect(out.sponsors.length).toBe(0);
    expect(out.news.some(n => /pull their sponsorship/.test(n.text))).toBe(true);
  });

  it('haggling is a gamble: more money, or they walk', () => {
    const wins: number[] = [];
    let walked = 0;
    for (let seed = 0; seed < 30; seed++) {
      const { s, d } = offered();
      s.hour += seed * 24;
      const base = s.sponsors[0].monthly;
      const out = makeDecision(s, d.id, 'haggle').state;
      if (!out.sponsors.length) walked++;
      else wins.push(out.sponsors[0].monthly / base);
    }
    expect(walked).toBeGreaterThan(0);
    expect(wins.length).toBeGreaterThan(0);
    wins.forEach(w => expect(w).toBeCloseTo(HAGGLE_RAISE, 1));
  });

  it('declining (the default) removes the offer', () => {
    const { s, d } = offered();
    const out = makeDecision(s, d.id, 'decline').state;
    expect(out.sponsors.length).toBe(0);
  });

  it('retainers scale with name, fleet and goodwill', () => {
    const s = game();
    const base = sponsorTerms(s).monthly;
    s.goodwill = 80;
    expect(sponsorTerms(s).monthly).toBeGreaterThan(base);
    s.company.reputation = 80;
    expect(sponsorTerms(s).monthly).toBeGreaterThan(base);
  });

  it('charity costs money, builds goodwill and reputation, and improves the town', () => {
    const s = game();
    monthlySponsors(s, yes);
    const d = s.dilemmas.find(x => x.kind === 'charity')!;
    expect(d).toBeTruthy();
    const city = d.payload!;
    const before = { cash: s.company.cash, rep: s.company.reputation, town: s.cityRatings[city] ?? 50, gw: s.goodwill ?? 0 };
    const out = makeDecision(s, d.id, 'donate').state;
    expect(before.cash - out.company.cash).toBe(charityCost(s));
    expect(out.company.reputation).toBeGreaterThan(before.rep);
    expect(out.cityRatings[city]).toBeGreaterThan(before.town);
    expect(out.goodwill).toBeGreaterThan(before.gw);
    expect(out.charityDone).toBe(1);
  });

  it('goodwill brings more offers', () => {
    const s = game();
    const low = sponsorTerms(s);
    s.goodwill = 100;
    expect(sponsorTerms(s).monthly).toBeGreaterThan(low.monthly);
  });
});
