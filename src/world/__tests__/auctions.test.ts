import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { bidAuction, sellGear } from '../actions';
import { HOURS_PER_DAY, getModel } from '../catalog';
import { dayOf } from '../core';
import { AUCTION_DAYS, dailyAuctions, lotPrice, openAuction, priceFactor } from '../auctions';
import { monthlyRivals } from '../rivals';
import type { TycoonState } from '../types';

const never = { next: () => 0.5, chance: () => false, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;
const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 91, country: 'GB', startYear: 1995 });
  return { ...s, company: { ...s.company, cash: 2_000_000 } };
};
const withAuction = () => {
  const s = game();
  openAuction(s, never, 'Dead & Co Hire', s.depots[0].cityId, 3, 'bust');
  return s;
};

describe('auctions', () => {
  it('a rival going bust puts its stock under the hammer', () => {
    const s = game();
    const r = s.rivals[0];
    r.health = 1;
    r.reputation = 10; // no safety net
    const rng = { next: () => 0, chance: () => false, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;
    monthlyRivals(s, rng);
    expect(s.goneRivals).toContain(r.id);
    expect(s.auctions.length).toBe(1);
    expect(s.auctions[0].seller).toBe(r.name);
    expect(s.auctions[0].lots.some(l => l.kind === 'gear')).toBe(true);
    expect(s.auctions[0].lots.some(l => l.kind === 'vehicle')).toBe(true);
  });

  it('the asking price slides down to a floor', () => {
    const s = withAuction();
    const a = s.auctions[0];
    expect(priceFactor(a, a.startDay)).toBeCloseTo(0.95);
    expect(priceFactor(a, a.startDay + 5)).toBeCloseTo(0.8);
    expect(priceFactor(a, a.startDay + 30)).toBeCloseTo(0.7);
    const lot = a.lots[0];
    expect(lotPrice(a, lot, a.startDay + 10)).toBeLessThan(lotPrice(a, lot, a.startDay));
  });

  it('buying gear brings it in worn, and costs more than reselling it would return', () => {
    const s = withAuction();
    const a = s.auctions[0];
    const lot = a.lots.find(l => l.kind === 'gear')!;
    const depot = s.depots[0];
    const before = s.company.cash;
    const owned = depot.gear[lot.productId!] ?? 0;
    const out = bidAuction(s, a.id, lot.id, depot.id);
    expect(out.result.ok).toBe(true);
    const paid = before - out.state.company.cash;
    expect(paid).toBe(lotPrice(a, lot, dayOf(s.hour)));
    expect(out.state.depots[0].gear[lot.productId!]).toBe(owned + lot.qty!);
    expect(out.state.gearCondition[lot.productId!]).toBeLessThan(100);
    expect(out.state.auctions[0]?.lots.some(l => l.id === lot.id) ?? false).toBe(false);
    // Flip it straight back: the market pays less than the (floor) asking price.
    const sold = sellGear(out.state, depot.id, lot.productId!, lot.qty!);
    expect(sold.state.company.cash - out.state.company.cash).toBeLessThan(paid);
  });

  it('buying a truck gives you an older, shakier vehicle', () => {
    const s = withAuction();
    const a = s.auctions[0];
    const lot = a.lots.find(l => l.kind === 'vehicle')!;
    const fleet = s.vehicles.length;
    const out = bidAuction(s, a.id, lot.id, s.depots[0].id);
    expect(out.result.ok).toBe(true);
    const v = out.state.vehicles[out.state.vehicles.length - 1];
    expect(out.state.vehicles.length).toBe(fleet + 1);
    expect(v.modelId).toBe(lot.modelId);
    expect(v.reliability).toBeLessThan(getModel(v.modelId).reliability);
    expect(v.boughtHour).toBeLessThan(s.hour);
  });

  it('refuses when you cannot afford it or the base is full', () => {
    const s = withAuction();
    const a = s.auctions[0];
    const lot = a.lots.find(l => l.kind === 'gear')!;
    s.company.cash = 10;
    expect(bidAuction(s, a.id, lot.id, s.depots[0].id).result.ok).toBe(false);
  });

  it('lots get snapped up over time and auctions close', () => {
    const s = withAuction();
    const lots = s.auctions[0].lots.length;
    const hungry = { ...(never as object), chance: () => true } as never;
    dailyAuctions(s, hungry);
    expect(s.auctions.length).toBe(0);
    const t = withAuction();
    t.auctions[0].endDay = dayOf(t.hour) + 1;
    const later = advanceHours(t, 2 * HOURS_PER_DAY);
    expect(later.auctions.length).toBe(0);
    expect(lots).toBeGreaterThan(0);
    expect(AUCTION_DAYS).toBe(21);
  });
});
