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
  return `${world.venueById.get(gig.venueId)?.name}, ${world.cityById.get(gig.cityId)?.name}`;
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
