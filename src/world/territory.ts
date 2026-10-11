/**
 * Who works where: a fading tally of shows per town by company, for the map's market-share and
 * rival-territory overlays (and anything else that wants to know whose patch a town is).
 */
import type { TycoonState } from './types';

/** Each January last year's tally counts for this much. */
export const TOWN_SHOWS_FADE = 0.6;

export function countTownShow(s: TycoonState, cityId: string, owner: string) {
  const town = (s.townShows[cityId] ??= {});
  town[owner] = (town[owner] ?? 0) + 1;
}

export function fadeTownShows(s: TycoonState) {
  Object.values(s.townShows).forEach(town => {
    Object.keys(town).forEach(k => {
      town[k] *= TOWN_SHOWS_FADE;
      if (town[k] < 0.2) delete town[k];
    });
  });
}

export interface TownShare {
  /** Your share of recent shows here, 0-1 (undefined when nobody has played). */
  yours?: number;
  total: number;
  /** The company with the most recent shows here. */
  leader?: { owner: string; share: number };
}

export function townShare(s: Pick<TycoonState, 'townShows'>, cityId: string): TownShare {
  const town = s.townShows?.[cityId] ?? {};
  const total = Object.values(town).reduce((a, b) => a + b, 0);
  if (total < 0.5) return { total };
  let leader: TownShare['leader'];
  Object.entries(town).forEach(([owner, n]) => {
    if (!leader || n > leader.share * total) leader = { owner, share: n / total };
  });
  return { yours: (town.player ?? 0) / total, total, leader };
}

/**
 * Market depth. No promoter hands one firm all their work — they keep other suppliers sweet, and a
 * firm that's everywhere starts to look like a risk. Past a share of a town's recent shows (higher
 * the better your name), more of its new work goes to a rival first. Capacity beyond the share of
 * the market you can hold sits idle and costs money.
 */
export const SHARE_FLOOR = 0.15;
export const SHARE_PER_REP = 0.0025;
/** Towns with fewer recent shows than this aren't judged yet. */
export const SHARE_MIN_SHOWS = 4;
/** How readily the work then goes elsewhere: chance a new offer reaches you is (ceiling / share) to this power. */
export const SHARE_STEEPNESS = 3;

export const shareCeiling = (s: Pick<TycoonState, 'company'>) => Math.min(0.4, SHARE_FLOOR + s.company.reputation * SHARE_PER_REP);

/** Chance a new offer in this town reaches you first (1 until you're past the ceiling). */
export function shareThrottle(s: Pick<TycoonState, 'townShows' | 'company'>, cityId: string): number {
  const t = townShare(s, cityId);
  const ceiling = shareCeiling(s);
  if (t.yours === undefined || t.total < SHARE_MIN_SHOWS || t.yours <= ceiling) return 1;
  return Math.max(0.1, (ceiling / t.yours) ** SHARE_STEEPNESS);
}
