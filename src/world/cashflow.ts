/**
 * The cash forecast: what the bank balance will probably do over the next eight weeks, from the
 * invoices coming due, the shows already booked and the bills on the way. It is an estimate: how
 * wide the range is depends on how good your back office is, and the future may not follow it.
 * A profitable company can still run dry between the wages going out and the invoices coming in.
 */
import { dateOfDay, dayOf } from './core';
import { getModel } from './catalog';
import { monthlyRent, monthlySalaries } from './facilities';
import { monthlyLeasesTotal } from './finance';
import { monthlyPremium } from './incidents';
import { monthlyInterest } from './market';
import { defaultRisk, LATE_RISK, paymentDays } from './receivables';
import { monthlyWorkshopCost } from './wear';
import { PAY } from './crew';
import { canAfford } from './consequences';
import { depositOf } from './terms';
import type { TycoonState, WorldMap } from './types';

export const FORECAST_WEEKS = 8;
/** How long a late payer keeps you waiting, on average. */
const LATE_DAYS = 25;

export interface ForecastWeek {
  week: number;
  expected: number;
  low: number;
  high: number;
}

export interface Bill {
  day: number;
  label: string;
  amount: number;
}

export interface Forecast {
  weeks: ForecastWeek[];
  bills: Bill[];
  /** ± share of the money moving, from the quality of your back office. */
  accuracy: number;
  /** The first week the low end of the range goes below zero, if any. */
  riskWeek?: number;
  /** The first week the low end can't cover a service or workshop bill. */
  squeezeWeek?: number;
  lowest: ForecastWeek;
}

/** Office staff sharpen the estimate. */
export const forecastAccuracy = (s: Pick<TycoonState, 'depots' | 'managers'>) => {
  const office = s.depots.reduce((n, d) => n + d.staff.office, 0);
  return Math.max(s.managers?.finance ? 0.05 : 0.08, 0.3 - 0.06 * office - (s.managers?.finance ? 0.08 : 0));
};

export function forecastCash(s: TycoonState, world: WorldMap, weeks = FORECAST_WEEKS): Forecast {
  const today = dayOf(s.hour);
  const horizon = weeks * 7;
  const accuracy = forecastAccuracy(s);
  const exp = new Array(horizon + 1).fill(0);
  const low = new Array(horizon + 1).fill(0);
  const high = new Array(horizon + 1).fill(0);
  const gross = new Array(horizon + 1).fill(0);
  const add = (day: number, e: number, l: number, h: number) => {
    const i = Math.max(1, Math.min(horizon + 1, day - today)) ;
    if (day - today > horizon) return;
    exp[i] += e;
    low[i] += l;
    high[i] += h;
    gross[i] += Math.abs(e);
  };
  // Invoices: most pay on the day, some pay late, a few never pay.
  s.receivables.forEach(inv => {
    const def = defaultRisk(s, inv.tier);
    const late = inv.slipped || inv.insured ? 0 : LATE_RISK[Math.max(0, Math.min(4, inv.tier))];
    const net = inv.amount * (1 - def);
    add(inv.dueDay, net * (1 - late), inv.slipped || inv.insured ? net : 0, inv.amount);
    add(inv.dueDay + LATE_DAYS, net * late, inv.slipped || inv.insured ? 0 : net, 0);
  });
  // Booked shows: paid on the night or invoiced afterwards, at a little under the fee.
  s.gigs.filter(g => g.status === 'booked' && g.day >= today).forEach(g => {
    const wait = paymentDays(g);
    const day = g.day + 1 + wait;
    // A deposit already in (or about to land) comes off the balance.
    const dep = g.depositPaid ?? depositOf(g);
    if (dep && g.depositPaid === undefined) add(today + 1, dep, dep, dep);
    add(day, Math.max(0, g.fee * 0.9 - dep), Math.max(0, g.fee * 0.5 - dep), g.fee - dep);
  });
  // Bills.
  const bills: Bill[] = [];
  const monthly = [
    { label: 'Rent', amount: s.depots.reduce((n, d) => n + monthlyRent(world, d), 0) },
    { label: 'Salaries', amount: monthlySalaries(s, PAY[s.policies.pay].wage) },
    { label: 'Workshop', amount: monthlyWorkshopCost(s) },
    { label: 'Insurance', amount: monthlyPremium(s) },
    { label: 'Leases', amount: monthlyLeasesTotal(s) },
    { label: 'Loan interest', amount: s.company.loan > 0 ? monthlyInterest(s) : 0 },
  ].filter(b => b.amount > 0);
  for (let d = today + 1; d <= today + horizon; d++) {
    if (dateOfDay(s, d).getUTCDate() !== 1) continue;
    monthly.forEach(b => {
      bills.push({ day: d, label: b.label, amount: b.amount });
      add(d, -b.amount, -b.amount, -b.amount);
    });
  }
  // Running costs: tax, upkeep, fuel and a night's allowance for every truck, each day.
  const running = s.vehicles.filter(v => v.owner === 'player').reduce((n, v) => n + (getModel(v.modelId).runningCostPerYear * 0.7) / 365, 0);
  for (let d = 1; d <= horizon; d++) {
    exp[d] -= running * 1.4;
    low[d] -= running * 1.8;
    high[d] -= running;
    gross[d] += running;
  }

  const out: ForecastWeek[] = [];
  let e = s.company.cash;
  let l = s.company.cash;
  let h = s.company.cash;
  let moved = 0;
  for (let w = 1; w <= weeks; w++) {
    for (let d = (w - 1) * 7 + 1; d <= w * 7; d++) {
      e += exp[d];
      l += low[d];
      h += high[d];
      moved += gross[d];
    }
    const band = moved * accuracy;
    out.push({ week: w, expected: Math.round(e), low: Math.round(Math.min(l, e - band)), high: Math.round(Math.max(h, e + band)) });
  }
  const riskWeek = out.find(w => w.low < 0)?.week;
  const squeezeWeek = out.find(w => !canAfford({ ...s, company: { ...s.company, cash: w.low } }, 350))?.week;
  const lowest = out.reduce((m, w) => (w.expected < m.expected ? w : m), out[0]);
  return { weeks: out, bills, accuracy, riskWeek, squeezeWeek, lowest };
}
