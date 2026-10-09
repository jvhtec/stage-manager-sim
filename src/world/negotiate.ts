/**
 * Haggling. Any single-show offer can be pushed for a better fee — once. The
 * promoter folds, or digs in, or walks away and calls someone else. How
 * likely each is depends on how badly they need you: your standing beyond
 * what the act demands, the town's opinion of you, and the history you have
 * with the act.
 */
import type { Rng } from '@/lib/rng';
import { actReputationBar } from './standing';
import type { Gig, TycoonState } from './types';

/** The extra fee a successful haggle wins. */
export const HAGGLE_RAISE = 0.12;
/** Chance a promoter who won't budge also takes the offer off the table. */
const WALK_AWAY = 0.5;

/** Chance the promoter says yes, 15-85% (a typical offer to a mid-ranking firm: about even odds). */
export function haggleChance(state: TycoonState, gig: Gig): number {
  const bar = actReputationBar(state, gig.act);
  const standing = ((state.company.reputation - bar) / 100) * 0.6;
  const town = ((state.cityRatings[gig.cityId] ?? 50) - 50) / 200;
  const history = Math.min(0.2, (state.artistRelations[gig.act] ?? 0) * 0.04);
  const asked = gig.asksForYou ? 0.15 : 0;
  return Math.max(0.15, Math.min(0.85, 0.25 + standing + town + history + asked));
}

export function haggleBlocker(state: TycoonState, gig: Gig): string | null {
  if (gig.status !== 'offer') return 'That offer is no longer open.';
  if (gig.negotiated) return 'You’ve already had your go at this one.';
  if (gig.tourId || gig.festival || gig.event) return 'Tours, festival stages and events are fixed-price tenders.';
  return null;
}

export type HaggleOutcome = 'won' | 'refused' | 'walked';

/** Mutating: roll the haggle. */
export function haggle(s: TycoonState, gig: Gig, rng: Rng): HaggleOutcome {
  gig.negotiated = true;
  if (rng.chance(haggleChance(s, gig))) {
    gig.fee = Math.round((gig.fee * (1 + HAGGLE_RAISE)) / 10) * 10;
    return 'won';
  }
  if (rng.chance(WALK_AWAY)) {
    gig.status = 'expired';
    return 'walked';
  }
  return 'refused';
}
