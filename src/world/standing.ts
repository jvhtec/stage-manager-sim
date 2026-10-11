/**
 * Who'll hire you. Venues gate by reputation tier; real acts' management sets
 * its own bar on top: how big the act is (or has been), how big it's headed,
 * and whether it's an international name. Doing good shows for an act lowers
 * the bar with them. Local bands only care about the venue tier.
 */
import { actBanned, offerBlocked } from './blacklist';
import { tierInfo } from './catalog';
import { yearOf } from './core';
import { findArtist, type Artist } from './content/artists';
import { EVENT_REPUTATION } from './events';
import { requiredStageLevel, stageBlocker, tourStageLevel } from './annexes';
import type { Gig, Tour, TycoonState } from './types';

/** Reputation management wants, by the biggest tier the act has played so far. */
const STATURE_BAR = [0, 10, 35, 62, 85];
/** Signed acts on the way up already work with established firms. */
const HEADROOM_BAR = 7;
const INTERNATIONAL_BAR = 5;
const RELATION_DISCOUNT = 4;
const MAX_RELATION_DISCOUNT = 20;

function peakTier(artist: Artist, upTo = Infinity): number {
  return artist.career.reduce((max, [from, t]) => (from <= upTo ? Math.max(max, t) : max), 0);
}

/** The act's own bar (0 for local bands), ignoring the venue. `forPlayer` applies your history with them. */
export function actReputationBar(state: TycoonState, act: string, forPlayer = true): number {
  const artist = findArtist(act);
  if (!artist) return 0;
  const year = yearOf(state, state.hour);
  const peak = Math.max(1, peakTier(artist, year));
  const headroom = Math.max(0, peakTier(artist) - peak);
  const relation = forPlayer ? Math.min(MAX_RELATION_DISCOUNT, (state.artistRelations[act] ?? 0) * RELATION_DISCOUNT) : 0;
  const bar = STATURE_BAR[peak] + headroom * HEADROOM_BAR + (artist.country ? 0 : INTERNATIONAL_BAR) - relation;
  return Math.round(Math.min(95, bar));
}

export interface BookingBar {
  needed: number;
  /** Why you can't book it yet (null when you can). */
  reason: string | null;
  /** The blocker is a missing rehearsal stage rather than reputation. */
  stage?: boolean;
}

function bar(state: TycoonState, act: string, tier: number, what: string): BookingBar {
  const venue = tierInfo(tier);
  const actBar = actReputationBar(state, act);
  const needed = Math.max(venue.minReputation, actBar);
  const have = state.company.reputation;
  if (have >= needed) return { needed, reason: null };
  const reason =
    actBar > venue.minReputation
      ? `${act.endsWith('s') ? `${act}'` : `${act}'s`} management only hires crews with reputation ${needed}+.`
      : `Promoters want reputation ${needed}+ for ${what}${venue.label} venues.`;
  return { needed, reason };
}

function repBar(state: TycoonState, gig: Gig): BookingBar {
  if (gig.event && !gig.event.citywide) {
    const needed = Math.max(tierInfo(gig.tier).minReputation, EVENT_REPUTATION[gig.event.scale as 3 | 4 | 5]);
    return { needed, reason: state.company.reputation >= needed ? null : `The organisers only consider firms with reputation ${needed}+.` };
  }
  return bar(state, gig.act, gig.tier, '');
}

/** Reputation first; then, for shows that must be rehearsed, a stage big enough and time to use it. */
export function gigBookingBar(state: TycoonState, gig: Gig): BookingBar {
  // An offer made before a ban doesn't survive it.
  if (gig.status === 'offer' && offerBlocked(state, gig)) return { ...repBar(state, gig), reason: actBanned(state, gig.act) ? `${gig.act} won't work with you.` : "This venue's promoter won't book you." };
  const rep = repBar(state, gig);
  if (rep.reason || gig.status !== 'offer') return rep;
  const why = stageBlocker(state, requiredStageLevel(state, gig), gig.day);
  return why ? { ...rep, reason: why, stage: true } : rep;
}

export function tourBookingBar(state: TycoonState, tour: Tour, maxTier: number): BookingBar {
  const rep = bar(state, tour.act, maxTier, "this tour's ");
  if (actBanned(state, tour.act)) return { ...rep, reason: `${tour.act} won't work with you.` };
  if (rep.reason) return rep;
  const first = Math.min(...tour.gigIds.map(id => state.gigs.find(g => g.id === id)?.day ?? Infinity));
  const why = stageBlocker(state, tourStageLevel(tour.kind, maxTier), Number.isFinite(first) ? first : Infinity);
  return why ? { ...rep, reason: why, stage: true } : rep;
}

/**
 * How often an act's offers land on your desk: acts within reach as normal,
 * the next rung up now and then (something to aim for), the big leagues rarely.
 */
export function reachWeight(state: TycoonState, act: string): number {
  const gap = actReputationBar(state, act) - state.company.reputation;
  return gap <= 0 ? 1 : gap <= 15 ? 0.4 : 0.1;
}
