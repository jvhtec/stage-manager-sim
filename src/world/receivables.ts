/**
 * Getting paid. Small venues settle on the night; the bigger the promoter,
 * the longer they take — and now and then one doesn't pay at all. You can
 * wait for the money, sell your invoices to a factor for cash today (at a
 * discount), or insure them against default.
 */
import { clientTemper } from './changes';
import type { Rng } from '@/lib/rng';
import { book, dayOf, formatMoney, newId, pushNews } from './core';
import { marketNow } from './market';
import { COUNCIL_PAYMENT_DAYS } from './rules';
import type { Gig, InvoicingPolicy, Invoice, TycoonState } from './types';

/** Days promoters take to pay, by venue tier (festivals and events add more). */
export const PAYMENT_DAYS = [0, 0, 14, 30, 45];
export const FESTIVAL_EXTRA_DAYS = 15;
/** Factors buy invoices at this discount. */
/** Chance a promoter pays late, by tier. */
export const LATE_RISK = [0, 0, 0.08, 0.12, 0.16];
/** Pushy clients are slow payers too. */
export const LATE_TEMPER = { easy: 0.5, fair: 1, pushy: 1.8 };
export const FACTOR_DISCOUNT = 0.035;
/** Credit insurance premium on each invoice. */
export const INSURE_PREMIUM = 0.012;
/** Chance a promoter never pays, by tier. */
export const DEFAULT_RISK = [0, 0, 0.008, 0.015, 0.02];

export const INVOICING: Record<InvoicingPolicy, { label: string; blurb: string }> = {
  hold: { label: 'Wait for it', blurb: 'Collect when it falls due and carry the risk of a promoter not paying.' },
  factor: { label: 'Sell to a factor', blurb: `Cash today for ${Math.round((1 - FACTOR_DISCOUNT) * 100)}% of the invoice, no risk.` },
  insure: { label: 'Credit insurance', blurb: `${(INSURE_PREMIUM * 100).toFixed(1)}% of each invoice: you wait, but a default is covered.` },
};
export const INVOICING_LEVELS: InvoicingPolicy[] = ['hold', 'factor', 'insure'];

export function paymentDays(gig: Pick<Gig, 'tier' | 'festival' | 'event'> & { council?: boolean }): number {
  if (gig.council) return COUNCIL_PAYMENT_DAYS;
  const base = PAYMENT_DAYS[Math.max(0, Math.min(4, gig.tier))];
  return base > 0 ? base + (gig.festival || gig.event ? FESTIVAL_EXTRA_DAYS : 0) : 0;
}

/** Risk of default, worse in a downturn. */
export function defaultRisk(s: TycoonState, tier: number): number {
  const m = marketNow(s);
  const downturn = m.shutdown ? 3 : m.demand < 0.95 ? 2 : 1;
  return DEFAULT_RISK[Math.max(0, Math.min(4, tier))] * downturn;
}

export const owed = (s: Pick<TycoonState, 'receivables'>) => (s.receivables ?? []).reduce((sum, i) => sum + i.amount, 0);

/** A show has paid out: either the money lands now, or an invoice goes on the books. */
export function collectOrInvoice(s: TycoonState, gig: Gig, amount: number) {
  const days = paymentDays(gig);
  if (days <= 0 || amount <= 0) {
    book(s, 'shows', amount);
    return;
  }
  const policy = s.policies.invoicing ?? 'hold';
  if (policy === 'factor') {
    book(s, 'shows', Math.round(amount * (1 - FACTOR_DISCOUNT)));
    return;
  }
  let insured = false;
  if (policy === 'insure') {
    book(s, 'insurance', -Math.round(amount * INSURE_PREMIUM));
    insured = true;
  }
  s.receivables.push({ id: newId(s, 'inv'), gigId: gig.id, act: gig.act, amount, dueDay: dayOf(s.hour) + days, tier: gig.tier, insured });
}

/** Daily: invoices fall due — most pay, the odd one doesn't. */
export function dailyReceivables(s: TycoonState, rng: Rng) {
  const today = dayOf(s.hour);
  if (!s.receivables.some(i => i.dueDay <= today)) return;
  // Some promoters pay late: the money comes, but weeks after it was due.
  s.receivables.forEach(inv => {
    if (inv.dueDay > today || inv.slipped || inv.insured) return;
    inv.slipped = true;
    if (!rng.chance(LATE_RISK[Math.max(0, Math.min(4, inv.tier))] * LATE_TEMPER[clientTemper(inv.act)] * (s.managers?.finance ? 0.6 : 1))) return;
    inv.dueDay = today + 10 + rng.nextInt(25);
    pushNews(s, `${inv.act}'s promoter is late paying your ${formatMoney(s, inv.amount)} invoice — they promise it within ${inv.dueDay - today} days.`, 'bad');
  });
  const due = s.receivables.filter(i => i.dueDay <= today);
  s.receivables = s.receivables.filter(i => i.dueDay > today);
  due.forEach(inv => {
    if (rng.chance(defaultRisk(s, inv.tier))) {
      if (inv.insured) {
        book(s, 'shows', inv.amount);
        pushNews(s, `The promoter behind ${inv.act} never paid — your credit insurance covers the ${formatMoney(s, inv.amount)}.`, 'info');
      } else {
        pushNews(s, `The promoter behind ${inv.act} has gone under owing you ${formatMoney(s, inv.amount)}. It's not coming back.`, 'bad');
      }
      return;
    }
    book(s, 'shows', inv.amount);
  });
}

export type { Invoice };
