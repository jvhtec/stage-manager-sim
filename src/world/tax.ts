/**
 * Corporation tax. On the last day of each year the taxman takes a cut of the
 * year's trading profit: a lower rate on the first slice, a higher one above
 * it. Losses carry forward, and half of what you spend on trucks and kit is
 * deductible, so reinvesting softens the bill. Share dealings and asset
 * sales are outside the calculation.
 */
import { book, dayOf, formatMoney, pushNews, yearOf } from './core';
import type { LedgerCategory, TycoonState } from './types';

/** Profit up to here is taxed at the lower rate. */
export const TAX_BAND = 250_000;
export const TAX_LOW = 0.15;
export const TAX_HIGH = 0.3;
/** Share of capital spending (trucks, kit) that can be deducted. */
export const CAPEX_DEDUCTIBLE = 0.5;

const EXCLUDED: LedgerCategory[] = ['equity', 'sales', 'tax'];

/** Trading profit for the year as the taxman sees it (before losses brought forward). */
export function taxableProfit(s: Pick<TycoonState, 'ledger'>, year: number): number {
  const row = s.ledger[year] ?? {};
  let total = 0;
  (Object.keys(row) as LedgerCategory[]).forEach(c => {
    if (!EXCLUDED.includes(c)) total += row[c] ?? 0;
  });
  // Only part of what was spent on kit and trucks counts as a cost.
  total += (-(row.purchases ?? 0) > 0 ? -(row.purchases ?? 0) : 0) * (1 - CAPEX_DEDUCTIBLE);
  return total;
}

export function taxOn(profit: number): number {
  if (profit <= 0) return 0;
  return Math.round((Math.min(profit, TAX_BAND) * TAX_LOW + Math.max(0, profit - TAX_BAND) * TAX_HIGH) / 10) * 10;
}

/** What the bill would be if the year ended now. */
export function taxEstimate(s: TycoonState): number {
  const year = yearOf(s, s.hour);
  return taxOn(Math.max(0, taxableProfit(s, year) - (s.taxLoss ?? 0)));
}

/** Mutating: on the last day of the year, settle up. */
export function yearEndTax(s: TycoonState) {
  const year = yearOf(s, s.hour);
  const profit = taxableProfit(s, year);
  const loss = s.taxLoss ?? 0;
  if (profit <= 0) {
    s.taxLoss = loss + -profit;
    return;
  }
  const used = Math.min(loss, profit);
  s.taxLoss = loss - used;
  const tax = taxOn(profit - used);
  if (tax <= 0) return;
  book(s, 'tax', -tax);
  pushNews(s, `Corporation tax for ${year}: ${formatMoney(s, tax)} on profits of ${formatMoney(s, Math.round(profit - used))}.`, 'info');
}

export const isLastDayOfYear = (s: Pick<TycoonState, 'startYear' | 'hour'>) => {
  const d = new Date(Date.UTC(s.startYear, 0, 1) + dayOf(s.hour) * 86400000);
  return d.getUTCMonth() === 11 && d.getUTCDate() === 31;
};
