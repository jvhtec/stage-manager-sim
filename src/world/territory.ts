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
