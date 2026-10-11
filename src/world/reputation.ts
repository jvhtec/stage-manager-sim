/**
 * Reputation as the industry's memory. A show moves it (sim.ts reputationAfterShow); this keeps the
 * memory honest over time. What you're known for is what you've done lately: a firm that hasn't
 * delivered an arena show in a year slides back towards what its recent work supports, and even
 * at the top the name fades a little each month unless the work keeps coming. It also keeps the
 * books on who your clients are, a year or two back, for the client list and the shocks.
 */
import { dayOf, yearOf } from './core';
import type { Gig, TycoonState } from './types';

/** Playing pubs can only get you so far — each venue tier caps the reputation it can earn you. */
export const TIER_REP_CEILING = [0, 38, 68, 92, 100];
/** How long the industry remembers your best work. */
export const REP_MEMORY_DAYS = 365;
/** Share of reputation above what recent work supports that's lost each month. */
export const REP_SLIDE = 0.06;
/** A gentle monthly fade above this level, so even the best have to keep delivering. */
export const REP_FADE_FROM = 50;
export const REP_FADE = 0.12;
/** A show counts towards your standing at a tier from this quality up. */
export const GOOD_SHOW = 0.6;

/** After every show you play: who paid, and the best tier you've done good work at lately. */
export function noteShow(s: TycoonState, gig: Pick<Gig, 'act' | 'tier' | 'fee'>, quality: number) {
  const year = yearOf(s, s.hour);
  const book = (s.clientFees ??= {});
  const thisYear = (book[year] ??= {});
  thisYear[gig.act] = (thisYear[gig.act] ?? 0) + gig.fee;
  Object.keys(book).forEach(y => Number(y) < year - 1 && delete book[Number(y)]);
  if (quality >= GOOD_SHOW) (s.lastGoodTier ??= {})[gig.tier] = dayOf(s.hour);
}

/** What your recent work supports: the ceiling of the best tier you've done good work at within memory. */
export function reputationSupport(s: Pick<TycoonState, 'lastGoodTier' | 'hour'>): number {
  const today = dayOf(s.hour);
  let best = 0;
  Object.entries(s.lastGoodTier ?? {}).forEach(([tier, day]) => {
    if (today - day <= REP_MEMORY_DAYS) best = Math.max(best, Number(tier));
  });
  return TIER_REP_CEILING[best];
}

/** Monthly: slide towards what recent work supports, and a little fade at the top. */
export function monthlyReputation(s: TycoonState) {
  // A new company gets its first year to show what it can do.
  if (dayOf(s.hour) < REP_MEMORY_DAYS) return;
  const rep = s.company.reputation;
  const excess = Math.max(0, rep - reputationSupport(s));
  const fade = rep > REP_FADE_FROM ? (REP_FADE * (rep - REP_FADE_FROM)) / 50 : 0;
  s.company.reputation = Math.max(0, rep - excess * REP_SLIDE - fade);
}

/** Fees from each client over this year and last. */
export function clientFees(s: Pick<TycoonState, 'clientFees' | 'hour' | 'startYear'>): Record<string, number> {
  const year = yearOf(s, s.hour);
  const out: Record<string, number> = {};
  [year - 1, year].forEach(y => Object.entries(s.clientFees?.[y] ?? {}).forEach(([act, fee]) => (out[act] = (out[act] ?? 0) + fee)));
  return out;
}
