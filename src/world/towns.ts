/**
 * Towns grow. In booming eras they gain people faster, and faster still where
 * you run a base and have made a name: more people, more promoters, more
 * offers. Growth is stored as a multiplier on the map's starting population.
 */
import { dayOf, pushNews } from './core';
import { marketNow } from './market';
import type { City, TycoonState, WorldMap } from './types';

const BASE_GROWTH = 0.0015;
const DEPOT_GROWTH = 0.0015;
const FAME_GROWTH = 0.002;
const MAX_GROWTH = 2.5;
/** News when a town passes each of these multiples of its starting size. */
const MILESTONES = [1.25, 1.5, 2];

export const townGrowth = (state: Pick<TycoonState, 'townGrowth'>, cityId: string) => state.townGrowth?.[cityId] ?? 1;
export const populationOf = (state: Pick<TycoonState, 'townGrowth'>, city: City) => Math.round(city.population * townGrowth(state, city.id));

/** Monthly: every town grows a little. */
export function monthlyTowns(s: TycoonState, world: WorldMap) {
  const { demand, season, shutdown } = marketNow(s);
  const trend = demand / season;
  world.cities.forEach(city => {
    const before = townGrowth(s, city.id);
    const rating = s.cityRatings[city.id] ?? 50;
    const rate = shutdown
      ? 0
      : Math.max(0, BASE_GROWTH + (trend - 1) * 0.004 + (s.depots.some(d => d.cityId === city.id) ? DEPOT_GROWTH : 0) + Math.max(0, (rating - 50) / 50) * FAME_GROWTH);
    const after = Math.min(MAX_GROWTH, before * (1 + rate));
    (s.townGrowth ??= {})[city.id] = after;
    const crossed = MILESTONES.find(m => before < m && after >= m);
    if (crossed && dayOf(s.hour) > 0 && city.size !== 'village') {
      pushNews(s, `${city.name} keeps growing: ${Math.round((crossed - 1) * 100)}% bigger than when you started. More promoters, more shows.`, 'info', { cityId: city.id });
    }
  });
}
