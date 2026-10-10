import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { worldOf } from '../mapgen';
import { forecastAccuracy, forecastCash } from '../cashflow';
import { dayOf } from '../core';

const game = () => createTycoonGame({ companyName: 'F', color: '#f00', seed: 7, country: 'GB', startYear: 1995 });

describe('cash forecast', () => {
  it('projects eight weeks, with the bills landing on the first of the month', () => {
    const s = game();
    const f = forecastCash(s, worldOf(s));
    expect(f.weeks).toHaveLength(8);
    expect(f.bills.length).toBeGreaterThan(0);
    expect(f.weeks[7].expected).toBeLessThan(f.weeks[0].expected + 1);
    f.weeks.forEach(w => {
      expect(w.low).toBeLessThanOrEqual(w.expected);
      expect(w.high).toBeGreaterThanOrEqual(w.expected);
    });
  });

  it('a profitable company can still be forecast to run dry: wages go out before the invoice comes in', () => {
    const s = game();
    s.company.cash = 2000;
    s.receivables.push({ id: 'i', gigId: 'x', act: 'Blur', amount: 5_000_000, dueDay: dayOf(s.hour) + 50, tier: 3, insured: false });
    const f = forecastCash(s, worldOf(s));
    expect(f.riskWeek).toBeDefined();
    expect(f.weeks[f.weeks.length - 1].expected).toBeGreaterThan(f.weeks[0].expected);
  });

  it('a back office narrows the range', () => {
    const s = game();
    const base = forecastAccuracy(s);
    s.depots[0].staff.office = 3;
    expect(forecastAccuracy(s)).toBeLessThan(base);
  });

  it('late invoices are what make the low end bite', () => {
    const s = game();
    s.company.cash = 100_000;
    s.receivables.push({ id: 'i', gigId: 'x', act: 'Blur', amount: 300_000, dueDay: dayOf(s.hour) + 10, tier: 3, insured: false });
    const f = forecastCash(s, worldOf(s));
    const w2 = f.weeks[2];
    expect(w2.high).toBeGreaterThan(w2.low);
    const slipped = forecastCash({ ...s, receivables: [{ ...s.receivables[0], slipped: true }] }, worldOf(s));
    expect(slipped.weeks[2].low).toBeGreaterThanOrEqual(f.weeks[2].low);
  });
});
