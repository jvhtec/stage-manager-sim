import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { buyOwnedVenue, makeDecision, sellOwnedVenue, setVenueProgramme } from '../actions';
import { BUY_FEE, UPKEEP, YIELD, buyBlocker, buyCost, expectedMonthly, monthlyVenues, ownable, saleValue, venuePrice } from '../owned';
import { worldOf } from '../mapgen';
import type { TycoonState } from '../types';

const never = { next: () => 0.5, chance: () => false, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 21, country: 'GB', startYear: 2000 });
  s.company.cash = 50_000_000;
  s.company.reputation = 80;
  return s;
};
const local = (s: TycoonState) =>
  [...worldOf(s).venueById.values()].filter(v => v.cityId === s.depots[0].cityId && ownable(v) && v.tier <= 2).sort((a, b) => a.capacity - b.capacity)[0];

describe('owned venues', () => {
  it('needs a base in town, the reputation and the cash', () => {
    const s = game();
    const v = local(s);
    expect(v).toBeTruthy();
    expect(buyBlocker(s, v)).toBeNull();
    const far = [...worldOf(s).venueById.values()].find(x => ownable(x) && !s.depots.some(d => d.cityId === x.cityId))!;
    expect(buyBlocker(s, far)).toMatch(/base/);
    const poor = game();
    poor.company.cash = 100;
    expect(buyBlocker(poor, local(poor))).toMatch(/Needs/);
    const unknown = game();
    unknown.company.reputation = 0;
    const big = [...worldOf(unknown).venueById.values()].find(x => ownable(x) && x.tier >= 3 && unknown.depots.some(d => d.cityId === x.cityId));
    if (big) expect(buyBlocker(unknown, big)).toMatch(/reputation/);
  });

  it('buying costs the price plus fees; selling gets back less', () => {
    const s = game();
    const v = local(s);
    const out = buyOwnedVenue(s, v.id);
    expect(out.result.ok).toBe(true);
    expect(s.company.cash - out.state.company.cash).toBe(buyCost(v));
    expect(buyCost(v)).toBe(Math.round(venuePrice(v) * (1 + BUY_FEE)));
    expect(buyOwnedVenue(out.state, v.id).result.ok).toBe(false);
    const sold = sellOwnedVenue(out.state, v.id);
    expect(sold.result.ok).toBe(true);
    expect(sold.state.ownedVenues.length).toBe(0);
    expect(sold.state.company.cash).toBeLessThan(s.company.cash);
  });

  it('leasing pays a steady rent less upkeep; promoting pays more on average', () => {
    const s = buyOwnedVenue(game(), local(game()).id).state;
    const o = s.ownedVenues[0];
    o.condition = 100;
    const lease = expectedMonthly(s, o);
    expect(lease).toBe(Math.round(o.price * YIELD.lease - o.price * UPKEEP));
    const p = setVenueProgramme(s, o.venueId, 'promote').state;
    expect(expectedMonthly(p, p.ownedVenues[0])).toBeGreaterThan(lease);
    const cash = s.company.cash;
    monthlyVenues(s, never);
    expect(s.company.cash - cash).toBe(lease);
    expect(o.condition).toBeLessThan(100);
    expect(o.earned).toBe(lease);
  });

  it('wears down, asks for a refurbishment, and the decision restores it', () => {
    const s = buyOwnedVenue(game(), local(game()).id).state;
    const o = s.ownedVenues[0];
    o.condition = 39;
    monthlyVenues(s, never);
    const d = s.dilemmas.find(x => x.kind === 'venue')!;
    expect(d).toBeTruthy();
    const out = makeDecision(s, d.id, 'refurb');
    expect(out.result.ok).toBe(true);
    expect(out.state.ownedVenues[0].condition).toBe(90);
    expect(out.state.company.cash).toBeLessThan(s.company.cash);
    // Not asked twice.
    monthlyVenues(s, never);
    expect(s.dilemmas.filter(x => x.kind === 'venue').length).toBe(1);
  });

  it('a condemned venue earns nothing, and a run-down one sells for less', () => {
    const s = buyOwnedVenue(game(), local(game()).id).state;
    const o = s.ownedVenues[0];
    const fresh = saleValue({ price: o.price, condition: 100 });
    o.condition = 5;
    expect(saleValue(o)).toBeLessThan(fresh);
    const cash = s.company.cash;
    monthlyVenues(s, never);
    expect(s.company.cash).toBeLessThan(cash);
    expect(s.news.some(n => /condemned/.test(n.text))).toBe(true);
  });

  it('keeps the town warm', () => {
    const s = buyOwnedVenue(game(), local(game()).id).state;
    const before = s.cityRatings[s.ownedVenues[0].cityId] ?? 50;
    monthlyVenues(s, never);
    expect(s.cityRatings[s.ownedVenues[0].cityId]).toBeGreaterThan(before);
  });
});
