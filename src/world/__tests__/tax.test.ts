import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { CAPEX_DEDUCTIBLE, TAX_BAND, TAX_HIGH, TAX_LOW, isLastDayOfYear, taxEstimate, taxOn, taxableProfit, yearEndTax } from '../tax';
import { yearOf } from '../core';
import type { TycoonState } from '../types';

const game = (): TycoonState => createTycoonGame({ companyName: 'A', color: '#f00', seed: 12, country: 'GB', startYear: 1995 });
const year = (s: TycoonState) => yearOf(s, s.hour);

describe('corporation tax', () => {
  it('a lower rate on the first slice and a higher one above it', () => {
    expect(taxOn(-5000)).toBe(0);
    expect(taxOn(100_000)).toBe(Math.round((100_000 * TAX_LOW) / 10) * 10);
    expect(taxOn(TAX_BAND + 100_000)).toBe(Math.round((TAX_BAND * TAX_LOW + 100_000 * TAX_HIGH) / 10) * 10);
  });

  it('counts trading profit, half of capital spending, and ignores share dealings and asset sales', () => {
    const s = game();
    s.ledger[year(s)] = { shows: 500_000, wages: -100_000, purchases: -100_000, equity: 900_000, sales: 50_000 };
    expect(taxableProfit(s, year(s))).toBe(500_000 - 100_000 - 100_000 + 100_000 * (1 - CAPEX_DEDUCTIBLE));
    expect(taxEstimate(s)).toBe(taxOn(350_000));
  });

  it('settles on the last day of the year and books it in that year', () => {
    const s = game();
    s.ledger[year(s)] = { shows: 400_000, wages: -100_000 };
    s.hour = 24 * 364;
    expect(isLastDayOfYear(s)).toBe(true);
    const cash = s.company.cash;
    yearEndTax(s);
    expect(s.ledger[year(s)].tax).toBe(-taxOn(300_000));
    expect(s.company.cash).toBe(cash - taxOn(300_000));
    expect(s.news.some(n => /Corporation tax for 1995/.test(n.text))).toBe(true);
  });

  it('losses carry forward and shelter later profits', () => {
    const s = game();
    s.ledger[year(s)] = { wages: -60_000, shows: 10_000 };
    yearEndTax(s);
    expect(s.taxLoss).toBe(50_000);
    s.hour = 24 * 365 + 24 * 300;
    s.ledger[year(s)] = { shows: 80_000 };
    const cash = s.company.cash;
    yearEndTax(s);
    expect(s.taxLoss).toBe(0);
    expect(s.company.cash).toBe(cash - taxOn(30_000));
  });

  it('runs through the clock without exploding', () => {
    const s = game();
    s.company.cash = 5_000_000;
    const later = advanceHours(s, 24 * 400);
    expect(later.gameOver).toBeUndefined();
  });
});
