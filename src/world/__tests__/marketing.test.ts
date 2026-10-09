import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { buyGear, makeDecision, setPolicy } from '../actions';
import { HOURS_PER_DAY } from '../catalog';
import { showsIn, travelFactor, TRADE_SHOWS } from '../content/tradeShows';
import { EXHIBIT, MARKETING, VISIT, attendShow, dailyTradeShows, marketingMonthly, monthlyMarketing, offerBuzz, showCost, showDiscount } from '../marketing';
import { partnerPrice } from '../partners';
import { dayOf, dateOfDay } from '../core';
import { getProduct } from '../content/gear';
import type { TycoonState } from '../types';

const game = (startYear = 1995, country: TycoonState['country'] = 'GB'): TycoonState => {
  const s = createTycoonGame({ companyName: 'M', color: '#f00', seed: 6, country, startYear });
  return { ...s, company: { ...s.company, cash: 1_000_000, reputation: 45 } };
};
/** The hour a given show opens in the game's calendar. */
const showHour = (s: TycoonState, month: number, day: number, year: number) =>
  Math.round((Date.UTC(year, month - 1, day) - Date.UTC(s.startYear, 0, 1)) / 86400000) * 24 + 8;

describe('marketing budget', () => {
  it('costs more the bigger you are, and buys offers and slow reputation', () => {
    const s = game();
    const a = marketingMonthly(s, 'national');
    s.company.reputation = 80;
    expect(marketingMonthly(s, 'national')).toBeGreaterThan(a);
    expect(marketingMonthly(s, 'none')).toBe(0);
    s.policies.marketing = 'trade';
    expect(offerBuzz(s)).toBeCloseTo(MARKETING.trade.offers);
    const rep = s.company.reputation;
    const cash = s.company.cash;
    monthlyMarketing(s);
    expect(s.company.cash).toBeLessThan(cash);
    expect(s.company.reputation).toBeGreaterThan(rep);
    expect(s.ledger[1995]?.marketing).toBeLessThan(0);
  });

  it('does nothing when switched off, and the reputation lift fades near the top', () => {
    const s = game();
    const cash = s.company.cash;
    monthlyMarketing(s);
    expect(s.company.cash).toBe(cash);
    s.policies.marketing = 'national';
    s.company.reputation = 99;
    monthlyMarketing(s);
    expect(s.company.reputation - 99).toBeLessThan(0.01);
  });

  it('is a policy you can set', () => {
    const s = game();
    expect(setPolicy(s, 'marketing', 'local').state.policies.marketing).toBe('local');
  });
});

describe('trade shows', () => {
  it('run in their years and cost more the further away they are', () => {
    expect(showsIn(1990).map(x => x.id)).toEqual(expect.arrayContaining(['plasa', 'musikmesse', 'ldi']));
    expect(showsIn(1990).map(x => x.id)).not.toContain('prolight');
    expect(showsIn(2005).map(x => x.id)).toContain('prolight');
    expect(showsIn(2005).map(x => x.id)).not.toContain('musikmesse');
    expect(travelFactor('GB', 'GB')).toBe(1);
    expect(travelFactor('GB', 'DE')).toBe(1.8);
    expect(travelFactor('GB', 'US')).toBe(3);
    const s = game();
    const plasa = TRADE_SHOWS.find(x => x.id === 'plasa')!;
    const ldi = TRADE_SHOWS.find(x => x.id === 'ldi')!;
    expect(showCost(s, ldi).stand).toBeGreaterThan(showCost(s, plasa).stand);
    expect(showCost(s, plasa).visit).toBeLessThan(showCost(s, plasa).stand);
  });

  it('put a decision in front of you on the opening day, skipping by default', () => {
    const s = game();
    // The daily tick runs on the stroke of midnight on the opening day.
    s.hour = Math.round(showHour(s, 9, 8, 1996) / 24) * 24;
    expect(dateOfDay(s, dayOf(s.hour)).getUTCMonth()).toBe(8);
    dailyTradeShows(s);
    const d = s.dilemmas.find(x => x.kind === 'tradeshow' && /PLASA/.test(x.title))!;
    expect(d).toBeTruthy();
    expect(d.defaultOption).toBe('skip');
    expect(d.options.map(o => o.id)).toEqual(['stand', 'visit', 'skip']);
  });

  it('exhibiting buys a month of buzz and a fortnight of cheaper kit; walking the floor buys less', () => {
    const s = game();
    s.hour = Math.round(showHour(s, 9, 8, 1996) / 24) * 24;
    dailyTradeShows(s);
    const d = s.dilemmas.find(x => x.kind === 'tradeshow')!;
    const cash = s.company.cash;
    const out = makeDecision(s, d.id, 'stand').state;
    expect(cash - out.company.cash).toBe(d.options[0].cost);
    expect(out.ledger[1996]?.marketing ?? out.ledger[1995]?.marketing ?? 0).toBeLessThan(0);
    expect(offerBuzz(out)).toBeCloseTo(EXHIBIT.offerMult);
    expect(showDiscount(out)).toBeCloseTo(1 - EXHIBIT.gearDiscount);
    // Buzz and the discount end on schedule.
    const later = { ...out, hour: out.hour + (EXHIBIT.offerDays + 1) * 24 };
    expect(offerBuzz(later)).toBe(1);
    expect(showDiscount(later)).toBe(1);
    const walk = makeDecision(s, d.id, 'visit').state;
    expect(offerBuzz(walk)).toBeCloseTo(VISIT.offerMult);
    expect(offerBuzz(walk)).toBeLessThan(offerBuzz(out));
    const skipped = makeDecision(s, d.id, 'skip').state;
    expect(offerBuzz(skipped)).toBe(1);
  });

  it('cheaper kit really is cheaper in the shop, and stacks with a partnership', () => {
    const s = game();
    const id = s.announcedGear.find(g => getProduct(g).dept === 'audio')!;
    const list = partnerPrice(s, id);
    attendShow(s, 'plasa', 'stand');
    expect(partnerPrice(s, id)).toBe(Math.round(list * (1 - EXHIBIT.gearDiscount)));
    const before = s.company.cash;
    const out = buyGear(s, s.depots[0].id, id).state;
    expect(before - out.company.cash).toBe(partnerPrice(s, id));
  });

  it('are cancelled when the industry shuts down, and the year runs through cleanly', () => {
    const s = game(2020);
    s.hour = Math.round(showHour(s, 4, 6, 2020) / 24) * 24; // Prolight 2020: spring of the pandemic
    dailyTradeShows(s);
    expect(s.dilemmas.some(x => x.kind === 'tradeshow')).toBe(false);
    const out = advanceHours(game(1995), 365 * HOURS_PER_DAY);
    expect(out.hour).toBeGreaterThan(0);
  });
});
