import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { goPublic, makeDecision, setDividend, takePrivate } from '../actions';
import { BUYBACK_PREMIUM, IPO_FLOAT, OUSTED_MONTHS, listingBlocker, marketCap, monthlyShares, sharePrice, tradingTotal } from '../shares';
import { companyValue } from '../queries';
import { buildReport } from '../milestones';
import type { TycoonState } from '../types';

const yes = () => true;
const no = () => false;
const ready = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 5, country: 'GB', startYear: 1995 });
  s.hour = 24 * 365 * 6;
  s.company.cash = 3_000_000;
  s.company.reputation = 70;
  return s;
};

describe('going public', () => {
  it('needs a track record, reputation, size and a clean bill of health', () => {
    const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 5, country: 'GB', startYear: 1995 });
    expect(listingBlocker(s)).toMatch(/track record/);
    const t = ready();
    t.company.reputation = 30;
    expect(listingBlocker(t)).toMatch(/Reputation/);
    const u = ready();
    u.company.cash = 100;
    u.company.loan = 0;
    expect(listingBlocker(u)).toMatch(/Worth/);
    const v = ready();
    v.negativeMonths = 1;
    expect(listingBlocker(v)).toMatch(/red/);
    expect(listingBlocker(ready())).toBeNull();
  });

  it('raises cash for a slice of the company, net of fees, outside the trading books', () => {
    const s = ready();
    const value = companyValue(s);
    const before = tradingTotal(s);
    const out = goPublic(s);
    expect(out.result.ok).toBe(true);
    const gained = out.state.company.cash - s.company.cash;
    expect(gained).toBeGreaterThan(value * IPO_FLOAT * 0.85);
    expect(gained).toBeLessThan(value * IPO_FLOAT);
    expect(out.state.listing?.float).toBe(IPO_FLOAT);
    expect(tradingTotal(out.state)).toBe(before);
    expect(goPublic(out.state).result.ok).toBe(false);
    // The annual report doesn't count it as income.
    const r = buildReport(out.state, 1995 + 6);
    expect(r.revenue).toBeLessThan(gained);
  });

  it('share price follows the company and the market mood', () => {
    const s = goPublic(ready()).state;
    const base = sharePrice(s);
    s.listing!.confidence = 100;
    expect(sharePrice(s)).toBeGreaterThan(base);
    s.listing!.confidence = 0;
    expect(sharePrice(s)).toBeLessThan(base);
    expect(marketCap(s)).toBeGreaterThan(0);
  });

  it('dividends come out of profit, and keep the market sweet', () => {
    const s = goPublic(ready()).state;
    const t = setDividend(s, 'generous').state;
    t.ledger[6] = { shows: 100_000 };
    const cash = t.company.cash;
    const conf = t.listing!.confidence;
    monthlyShares(t, no);
    expect(t.company.cash).toBe(cash - 40_000);
    expect(t.listing!.paid).toBe(40_000);
    expect(t.listing!.confidence).toBeGreaterThan(conf + 2);

    const u = setDividend(s, 'none').state;
    u.ledger[6] = { shows: 100_000 };
    const c2 = u.listing!.confidence;
    monthlyShares(u, no);
    expect(u.company.cash).toBe(s.company.cash);
    expect(u.listing!.confidence).toBeCloseTo(c2 + 0.5);
  });

  it('losses drain confidence; activists show up and a decision settles them', () => {
    const s = goPublic(ready()).state;
    s.listing!.confidence = 25;
    s.ledger[6] = { running: -50_000 };
    monthlyShares(s, yes);
    expect(s.listing!.confidence).toBeLessThan(25);
    const d = s.dilemmas.find(x => x.kind === 'shareholders')!;
    expect(d).toBeTruthy();
    const out = makeDecision(s, d.id, 'appease');
    expect(out.result.ok).toBe(true);
    expect(out.state.listing!.confidence).toBeGreaterThan(40);
    expect(out.state.company.cash).toBeLessThan(s.company.cash);
    const stand = makeDecision(s, d.id, 'stand');
    expect(stand.state.listing!.confidence).toBeLessThan(s.listing!.confidence);
  });

  it('a board with no confidence for months throws you out', () => {
    const s = goPublic(ready()).state;
    s.listing!.confidence = 0;
    for (let i = 0; i < OUSTED_MONTHS; i++) {
      s.ledger[6] = { running: -1000 * (i + 1) };
      monthlyShares(s, no);
    }
    expect(s.gameOver?.reason).toMatch(/voted the founder out/);
  });

  it('you can buy the public out, at a premium', () => {
    const s = goPublic(ready()).state;
    const out = takePrivate(s);
    expect(out.result.ok).toBe(true);
    expect(out.state.listing).toBeUndefined();
    const paid = s.company.cash - out.state.company.cash;
    expect(paid).toBeGreaterThan(marketCap(s) * IPO_FLOAT * (BUYBACK_PREMIUM - 0.05));
    s.company.cash = 10;
    expect(takePrivate(s).result.ok).toBe(false);
  });
});
