/**
 * The market around you: the season, the economy (content/economy.ts) and
 * the bank. Everything that sets how much work is out there, what it pays and
 * what money costs reads from here, so the Market window shows exactly what
 * the sim uses.
 */
import { HOURS_PER_DAY } from './catalog';
import { book, dateOfDay, dayOf, formatMoney, pushNews } from './core';
import { SEASON, WAGE_SCHEMES, baseRate, climateAt, type ClimatePeriod } from './content/economy';
import type { TycoonState } from './types';

/** What banks add on top of the central-bank rate for a small events firm. */
export const LOAN_MARGIN = 0.035;
/** Share of crew wages the state covers during a shutdown. */
export const SHUTDOWN_WAGE_SUPPORT = 0.7;

export interface MarketNow {
  year: number;
  month: number;
  /** Multiplier on how many shows are offered. */
  demand: number;
  /** Multiplier on show fees. */
  fees: number;
  season: number;
  periods: ClimatePeriod[];
  shutdown: boolean;
  /** Annual loan interest, as a fraction. */
  loanRate: number;
}

export function marketOnDay(state: Pick<TycoonState, 'startYear' | 'country'>, day: number): MarketNow {
  const date = dateOfDay(state, day);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const periods = climateAt(state.country, year, month);
  const season = SEASON[month - 1];
  const demand = periods.reduce((m, p) => m * p.demand, 1) * season;
  // Peak season pays a little better; January pays a little worse.
  const fees = periods.reduce((m, p) => m * p.fees, 1) * (1 + (season - 1) * 0.3);
  return {
    year,
    month,
    demand,
    fees,
    season,
    periods,
    shutdown: periods.some(p => p.shutdown),
    loanRate: baseRate(state.country, year) / 100 + LOAN_MARGIN,
  };
}

export const marketNow = (state: TycoonState) => marketOnDay(state, dayOf(state.hour));

/** Daily: announce turns in the economy; a shutdown cancels the calendar and the state chips in on wages. */
export function dailyMarket(s: TycoonState, wagesToday: number) {
  const now = marketNow(s);
  now.periods.forEach(p => {
    if (s.announcedClimate.includes(p.id)) return;
    s.announcedClimate.push(p.id);
    if (s.hour > HOURS_PER_DAY) pushNews(s, `${p.label}: ${p.news}`, 'big');
    if (p.shutdown) cancelForShutdown(s);
  });
  if (now.shutdown && wagesToday > 0) book(s, 'support', Math.round(wagesToday * SHUTDOWN_WAGE_SUPPORT));
}

function cancelForShutdown(s: TycoonState) {
  const today = dayOf(s.hour);
  let cancelled = 0;
  s.gigs.forEach(g => {
    if ((g.status !== 'booked' && g.status !== 'offer' && g.status !== 'rival') || g.result) return;
    if (!marketOnDay(s, g.day).shutdown && g.day > today + 90) return;
    if (g.status === 'booked') cancelled += 1;
    g.status = 'expired';
  });
  s.tours.forEach(t => {
    if (t.status === 'offer' || t.status === 'booked' || t.status === 'rival') t.status = 'expired';
  });
  s.vehicles.forEach(v => (v.orders = []));
  if (cancelled) {
    const scheme = WAGE_SCHEMES[s.country];
    pushNews(s, `${cancelled} booked show${cancelled > 1 ? 's' : ''} cancelled — force majeure, no fees, no penalties. ${scheme} covers ${Math.round(SHUTDOWN_WAGE_SUPPORT * 100)}% of crew wages.`, 'bad');
  }
}

export function describeLoanRate(state: TycoonState): string {
  return `${(marketNow(state).loanRate * 100).toFixed(1)}%`;
}

export const monthlyInterest = (state: TycoonState) => Math.round((state.company.loan * marketNow(state).loanRate) / 12);

export function marketSummary(state: TycoonState): string {
  const now = marketNow(state);
  const label = now.periods.map(p => p.label).join(' · ') || 'Steady market';
  return `${label} — work ×${now.demand.toFixed(2)}, fees ×${now.fees.toFixed(2)}, loans ${describeLoanRate(state)} (${formatMoney(state, monthlyInterest(state))}/month)`;
}
