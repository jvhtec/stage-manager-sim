import { formatDay } from '@/world/core';
import { getRegion } from '@/world/content/world';
import { worldOf } from '@/world/mapgen';
import { projectCoverage } from '@/world/queries';
import { DEPTS, type Gig, type TycoonState } from '@/world/types';

/** "Venue, Town" — or "✈ European leg: Madrid, Paris…" for overseas legs. */
export function gigWhere(state: TycoonState, gig: Gig): string {
  if (gig.overseas) {
    const region = getRegion(gig.overseas.regionId);
    return `✈ ${region.name}: ${gig.overseas.stops.map(s => s.city).join(', ')}`;
  }
  const world = worldOf(state);
  if (gig.festival) return `🎪 ${gig.festival.stage}, ${world.cityById.get(gig.cityId)?.name}`;
  if (gig.event && !gig.event.citywide) return `★ ${gig.event.lot} lot, ${world.cityById.get(gig.cityId)?.name}`;
  const city = world.cityById.get(gig.cityId);
  return `${world.venueById.get(gig.venueId)?.name}, ${city?.name}${city?.abroad ? ` ${city.abroad.flag}` : ''}`;
}

/** "24 Jun 1985", or "24–26 Jun 1985" for multi-day shows. */
export function gigDates(state: TycoonState, gig: Gig): string {
  const days = gig.days ?? 1;
  if (days <= 1) return formatDay(state, gig.day);
  const first = formatDay(state, gig.day).split(' ');
  const last = formatDay(state, gig.day + days - 1).split(' ');
  return first[1] === last[1] ? `${first[0]}–${last.join(' ')}` : `${first[0]} ${first[1]} – ${last.join(' ')}`;
}

export type Readiness = 'UNASSIGNED' | 'LATE' | 'SHORT' | 'READY';

export function gigReadiness(state: TycoonState, gig: Gig): Readiness {
  const p = projectCoverage(state, gig);
  if (!p.vehicles.length) return 'UNASSIGNED';
  if (!p.onTime) return 'LATE';
  const full = DEPTS.every(d => p.gear[d] >= gig.needs[d]) && p.crew >= gig.crewNeeded;
  return full ? 'READY' : 'SHORT';
}

export const READINESS_CLASS: Record<Readiness, string> = {
  UNASSIGNED: 'tt-bad',
  LATE: 'tt-bad',
  SHORT: 'tt-warn',
  READY: 'tt-good',
};
