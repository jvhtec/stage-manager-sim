/**
 * The market around you: the season, the economy (content/economy.ts) and
 * the bank. Everything that sets how much work is out there, what it pays and
 * what money costs reads from here, so the Market window shows exactly what
 * the sim uses.
 */
import { disruptionsOn } from './content/disruptions';
import { HOURS_PER_DAY } from './catalog';
import { book, dateOfDay, dayOf, formatMoney, pushNews } from './core';
import { SEASON, WAGE_SCHEMES, baseRate, climateAt, fuelIndexAt, type ClimatePeriod } from './content/economy';
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
  /** Diesel price relative to a normal year. */
  fuel: number;
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
    fuel: fuelIndexAt(year, month),
  };
}

export const marketNow = (state: TycoonState) => marketOnDay(state, dayOf(state.hour));

/** A fuel contract locks the price for a while — at a premium on the day you sign. */
export const FUEL_LOCK_PREMIUM = 0.08;
export const FUEL_LOCK_MONTHS = [6, 12];

/** What fuel costs you now: the pump price, or your locked price while the contract runs. */
export function fuelMultiplier(state: Pick<TycoonState, 'fuelLock' | 'hour' | 'startYear' | 'country'>): number {
  const day = dayOf(state.hour);
  // A strike or blockade on the pumps hits even a locked price: there's no diesel to be had at it.
  const shortage = disruptionsOn(state.country ?? 'GB', dateOfDay(state, day)).reduce((m, d) => Math.max(m, d.fuel ?? 1), 1);
  if (state.fuelLock && state.fuelLock.untilDay > day) return state.fuelLock.price * shortage;
  return marketOnDay(state, day).fuel * shortage;
}

export function fuelLockBlocker(state: TycoonState): string | null {
  if (state.fuelLock && state.fuelLock.untilDay > dayOf(state.hour)) return 'You already have a fuel contract running.';
  return null;
}

/** Daily: announce turns in the economy; a shutdown cancels the calendar and the state chips in on wages. */
export function dailyMarket(s: TycoonState, wagesToday: number) {
  const now = marketNow(s);
  // On the first of the month, tell the player when pump prices lurch.
  if (dateOfDay(s, dayOf(s.hour)).getUTCDate() === 1 && s.hour > HOURS_PER_DAY) {
    // Three-month swings, announced when they first cross the line.
    const day = dayOf(s.hour);
    const swing = (d: number) => marketOnDay(s, d).fuel / marketOnDay(s, d - 90).fuel - 1;
    const change = swing(day);
    const prior = swing(day - 30);
    if (change >= 0.15 && prior < 0.15) pushNews(s, `Fuel prices are surging: up ${Math.round(change * 100)}% in three months. Diesel is ${Math.round((now.fuel - 1) * 100)}% ${now.fuel >= 1 ? 'above' : 'below'} normal.`, 'bad');
    else if (change <= -0.15 && prior > -0.15) pushNews(s, `Fuel prices are tumbling: down ${Math.round(-change * 100)}% in three months.`, 'good');
  }
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
