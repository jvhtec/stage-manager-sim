/**
 * Running out of money is a process, not a switch. Within your arranged overdraft you pay a stiff
 * rate and life goes on. Close too many months in it and the bank withdraws it. Go past the limit
 * and the business starts to seize up: wages go out late and the crew's patience goes with them;
 * rental houses, rivals' hire desks and freelancers want cash you haven't got, so shows go out
 * short. Stay over the limit long enough and the bank demands its money back — and if you can't
 * get back inside in two weeks, the administrators come in. On the way you can sell invoices,
 * sell trucks, cut back, or take bridging finance at a painful price.
 */
import { book, dayOf, formatMoney, pushNews } from './core';
import { logIncident, squeezeCauses } from './consequences';
import { assetValue, creditLimit } from './finance';
import { marketNow } from './market';
import { difficultyOf } from './scenario';
import type { Liquidity, TycoonState } from './types';

export type { Liquidity };

/** The arranged overdraft: this share of the credit the bank would still give you. */
export const OVERDRAFT_SHARE = 0.35;
/** What an overdraft costs over the loan rate, a year. */
export const OVERDRAFT_MARGIN = 0.08;
/** Months the bank withdraws an overdraft for after you've lived in it. */
export const WITHDRAWN_DAYS = 180;
/** Days to get back inside the limit once the bank makes its demand. */
export const DEMAND_DAYS = 14;
/** Morale lost each day wages go out late. */
export const LATE_WAGES_MORALE = 0.4;
/** Bridging finance: an arrangement fee on the amount, and only once a year. */
export const BRIDGE_FEE = 0.08;
export const BRIDGE_ASSET_SHARE = 0.25;
const BRIDGE_COOLDOWN_DAYS = 365;

export type LiquidityStage = 'ok' | 'tight' | 'overdraft' | 'breach';

const fresh = (): Liquidity => ({ breachDays: 0, history: { daysOverdrawn: 0, daysInBreach: 0, breaches: 0, demands: 0, withdrawn: 0, bridges: 0 } });
export const liquidityOf = (s: TycoonState): Liquidity => (s.liquidity ??= fresh());

/** The arranged overdraft today. */
export function overdraftLimit(s: TycoonState): number {
  if ((s.liquidity?.withdrawnUntil ?? -1) > dayOf(s.hour)) return 0;
  const headroom = Math.max(0, creditLimit(s) - s.company.loan);
  return Math.round((headroom * OVERDRAFT_SHARE * difficultyOf(s).overdraft) / 1000) * 1000;
}

export const overLimit = (s: TycoonState) => s.company.cash < -overdraftLimit(s);
/** Wages are going out late and suppliers want cash up front. */
export const inBreach = (s: TycoonState) => (s.liquidity?.breachDays ?? 0) > 0;

/** Where the company stands, given a rough fortnight's outgoings. */
export function liquidityStage(s: TycoonState, fortnight = 0): LiquidityStage {
  if (overLimit(s)) return 'breach';
  if (s.company.cash < 0) return 'overdraft';
  if (s.company.cash < fortnight) return 'tight';
  return 'ok';
}

/** Daily: overdraft interest, and the slide from over the limit to administration. */
export function dailyLiquidity(s: TycoonState) {
  const l = liquidityOf(s);
  const today = dayOf(s.hour);
  if (s.company.cash < 0) {
    l.history.daysOverdrawn++;
    const rate = marketNow(s).loanRate + OVERDRAFT_MARGIN;
    book(s, 'interest', -Math.round((-s.company.cash * rate) / 365));
  }
  // During a shutdown the banks give everyone breathing room.
  if (marketNow(s).shutdown) return;
  if (!overLimit(s)) {
    if (l.breachDays) pushNews(s, 'Back inside the overdraft limit: wages go out on time again and suppliers will deal with you.', 'good');
    l.breachDays = 0;
    l.demandDay = undefined;
    return;
  }
  const limit = overdraftLimit(s);
  if (!l.breachDays) {
    l.history.breaches++;
    logIncident(s, {
      kind: 'cash',
      title: 'Over the overdraft limit',
      causes: [{ id: 'over-limit', label: 'Over the limit', detail: `${formatMoney(s, -s.company.cash)} overdrawn against a ${formatMoney(s, limit)} limit.`, weight: 1 }, ...squeezeCauses(s)],
      outcome: 'Wages go out late; rental houses, hire desks and freelancers want cash up front.',
    });
    pushNews(s, `Over the overdraft limit (${formatMoney(s, -s.company.cash)} against ${formatMoney(s, limit)}). Wages will go out late, and suppliers and freelancers want paying up front. Get back inside before the bank loses patience.`, 'bad');
  }
  l.breachDays++;
  l.history.daysInBreach++;
  s.crewMorale = Math.max(0, s.crewMorale - LATE_WAGES_MORALE);
  const patience = difficultyOf(s).bankPatience;
  if (l.demandDay === undefined && l.breachDays >= patience) {
    l.demandDay = today + DEMAND_DAYS;
    l.history.demands++;
    pushNews(s, `The bank has run out of patience: get back inside your overdraft limit within ${DEMAND_DAYS} days or it will appoint administrators. You need ${formatMoney(s, -s.company.cash - limit)}.`, 'big');
  } else if (l.demandDay !== undefined && today >= l.demandDay) {
    s.gameOver = {
      hour: s.hour,
      reason: `${s.company.name} stayed ${formatMoney(s, -s.company.cash - limit)} over its overdraft limit after the bank's demand, and the administrators have been appointed.`,
    };
    pushNews(s, s.gameOver.reason, 'big');
  }
}

/** Monthly: close too many months in the overdraft and the bank takes it away. */
export function monthlyLiquidity(s: TycoonState) {
  if (s.company.cash >= 0) {
    s.negativeMonths = 0;
    return;
  }
  if (marketNow(s).shutdown) {
    pushNews(s, 'Month closed in the red — the bank is giving the whole industry breathing room until venues reopen.', 'info');
    return;
  }
  s.negativeMonths += 1;
  const grace = difficultyOf(s).graceMonths;
  const l = liquidityOf(s);
  if (s.negativeMonths >= grace && (l.withdrawnUntil ?? -1) <= dayOf(s.hour)) {
    l.withdrawnUntil = dayOf(s.hour) + WITHDRAWN_DAYS;
    l.history.withdrawn++;
    s.negativeMonths = 0;
    pushNews(s, `${grace} months living in the overdraft: the bank has withdrawn it for six months. Every penny below zero is now over the limit.`, 'big');
  } else if (s.negativeMonths < grace) {
    pushNews(s, `Month closed in the overdraft. ${grace - s.negativeMonths} more and the bank withdraws it.`, 'bad');
  }
}

/** What a bridging lender would advance today (only when you're over the limit, and once a year). */
export function bridgeOffer(s: TycoonState): number {
  const l = s.liquidity;
  if (!l || !inBreach(s)) return 0;
  if (l.bridgeDay !== undefined && dayOf(s.hour) - l.bridgeDay < BRIDGE_COOLDOWN_DAYS) return 0;
  const need = -s.company.cash - overdraftLimit(s);
  return Math.max(0, Math.round(Math.min(need * 1.5, assetValue(s) * BRIDGE_ASSET_SHARE) / 1000) * 1000);
}

/** Take the bridging loan: cash now, on the loan, with the arrangement fee paid out of it. */
export function takeBridge(s: TycoonState): number {
  const amount = bridgeOffer(s);
  if (!amount) return 0;
  const l = liquidityOf(s);
  s.company.loan += amount;
  s.company.cash += amount;
  book(s, 'interest', -Math.round(amount * BRIDGE_FEE));
  l.bridgeDay = dayOf(s.hour);
  l.history.bridges++;
  pushNews(s, `Bridging finance: ${formatMoney(s, amount)} added to the loan, less a ${formatMoney(s, Math.round(amount * BRIDGE_FEE))} arrangement fee.`, 'info');
  return amount;
}
