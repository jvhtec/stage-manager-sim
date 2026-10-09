/**
 * Tour merchandise. Before a tour's first date you can order a run of
 * T-shirts, posters and programmes and sell them at the stands. Order too
 * little and you sell out early; order too much and the leftovers go for
 * peanuts. What sells depends on the act, how the tickets go and how good
 * the shows are.
 */
import type { Rng } from '@/lib/rng';
import { artistTierIn, findArtist } from './content/artists';
import { book, dayOf, formatMoney, pushNews, yearOf } from './core';
import { baseHype } from './gate';
import type { MerchLevel, Tour, TycoonState } from './types';

export interface MerchInfo {
  label: string;
  /** Cost up front, as a share of the tour's fees. */
  rate: number;
  blurb: string;
}

export const MERCH: Record<MerchLevel, MerchInfo> = {
  small: { label: 'A small run', rate: 0.05, blurb: 'Safe: sells out when the tour goes well.' },
  medium: { label: 'A proper range', rate: 0.1, blurb: 'The sensible order for a decent act.' },
  large: { label: 'The full stand', rate: 0.18, blurb: 'Only pays if the whole tour sells out.' },
};
export const MERCH_LEVELS: MerchLevel[] = ['small', 'medium', 'large'];

/** What stock is worth at the stands compared with what it cost. */
export const RETAIL_MULTIPLE = 3;
/** Share of takings you keep (the act takes the rest). */
export const OUR_SHARE = 0.6;
/** Order at least this many days before the first date. */
export const MERCH_LEAD_DAYS = 3;

/** How much merch an act sells per pound of fee: real names far more than local bands. */
export function popularity(s: TycoonState, act: string): number {
  const artist = findArtist(act);
  if (!artist) return 0.06;
  return 0.1 + 0.05 * Math.max(1, artistTierIn(artist, yearOf(s, s.hour)));
}

export const tourFees = (s: TycoonState, t: Tour) => t.gigIds.reduce((sum, id) => sum + (s.gigs.find(g => g.id === id)?.fee ?? 0), 0);
export const merchCost = (s: TycoonState, t: Tour, level: MerchLevel) => Math.round((tourFees(s, t) * MERCH[level].rate) / 10) * 10;

export function merchBlocker(s: TycoonState, t: Tour, level: MerchLevel): string | null {
  if (t.status !== 'booked') return 'Book the tour first.';
  if (t.merch) return 'You have already ordered stock.';
  const first = Math.min(...t.gigIds.map(id => s.gigs.find(g => g.id === id)?.day ?? Infinity));
  if (first - dayOf(s.hour) < MERCH_LEAD_DAYS) return 'Too late — the first date is on top of you.';
  const cost = merchCost(s, t, level);
  if (s.company.cash < cost) return `The order costs ${formatMoney(s, cost)}.`;
  return null;
}

export function orderMerch(s: TycoonState, t: Tour, level: MerchLevel): string {
  const invested = merchCost(s, t, level);
  book(s, 'merch', -invested);
  t.merch = { level, invested };
  return `${MERCH[level].label} ordered for ${formatMoney(s, invested)}.`;
}

/** Mutating: sell the stock against what the tour actually did. */
export function settleMerch(s: TycoonState, t: Tour, rng: Rng) {
  const m = t.merch;
  if (!m || m.revenue !== undefined) return;
  const played = t.gigIds.map(id => s.gigs.find(g => g.id === id)).filter(g => g && g.status === 'done' && g.result);
  if (!played.length) {
    m.revenue = 0;
    return;
  }
  const fees = played.reduce((sum, g) => sum + g!.fee, 0);
  const hype = played.reduce((sum, g) => sum + baseHype(s, g!), 0) / played.length;
  const quality = played.reduce((sum, g) => sum + (g!.result?.quality ?? 0), 0) / played.length;
  const noise = 0.85 + rng.next() * 0.3;
  const demand = fees * popularity(s, t.act) * hype * quality * noise;
  const supply = m.invested * RETAIL_MULTIPLE;
  const soldRetail = Math.min(supply, demand);
  const leftoverCost = ((supply - soldRetail) / RETAIL_MULTIPLE) * 0.25;
  const revenue = Math.round((soldRetail * OUR_SHARE + leftoverCost) / 10) * 10;
  m.revenue = revenue;
  book(s, 'merch', revenue);
  const profit = revenue - m.invested;
  const how = supply <= demand ? 'sold out' : demand / supply > 0.7 ? 'mostly sold' : 'left with boxes of stock';
  pushNews(s, `${t.name} merchandise: ${how} — ${profit >= 0 ? 'profit' : 'loss'} ${formatMoney(s, Math.abs(profit))}.`, profit >= 0 ? 'good' : 'bad');
}
