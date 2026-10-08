import { useCallback } from 'react';
import { DEPT_COLORS, getModel, tierInfo } from '@/world/catalog';
import { houseRigAt } from '@/world/contracts';
import { dayOf, lastShowDay, yearOf } from '@/world/core';
import { deptTotals } from '@/world/loading';
import { DEPTS, type Depot, type DeptCounts, type TycoonState, type Venue } from '@/world/types';
import { drawBaseScene, drawVenueScene, type VenuePhase } from '../render/diorama';
import { Diorama } from './Diorama';

export function BaseDiorama({ state, depot, height = 190 }: { state: TycoonState; depot: Depot; height?: number }) {
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, time: number) => {
      const totals = deptTotals(depot.gear);
      const fleet = state.vehicles.filter(v => v.owner === 'player' && v.homeCityId === depot.cityId);
      const home = fleet.filter(v => v.cityId === depot.cityId && (v.status === 'parked' || v.status === 'scheduled' || v.status === 'servicing'));
      drawBaseScene(
        ctx,
        w,
        h,
        {
          kind: depot.kind,
          size: depot.size,
          brand: state.company.color,
          year: yearOf(state, state.hour),
          stock: DEPTS.map(d => ({ color: DEPT_COLORS[d], units: totals[d] })),
          prepStaff: depot.staff.warehouse,
          officeStaff: depot.staff.office,
          gigTechs: depot.crew,
          workshop: state.policies.workshop,
          vehicles: home.map(v => ({ kind: getModel(v.modelId).kind })),
          away: fleet.length - home.length,
        },
        time,
      );
    },
    [state, depot],
  );
  return <Diorama draw={draw} height={height} label={`Inside your ${depot.kind}`} />;
}

/** What's going on at a venue right now, and whose rig it is. */
function venueNow(state: TycoonState, venue: Venue): { phase: VenuePhase; brand: string; rig: DeptCounts; house: boolean } {
  const hourOfDay = state.hour % 24;
  const today = dayOf(state.hour);
  const gig = state.gigs.find(
    g =>
      g.venueId === venue.id &&
      !g.overseas &&
      (g.status === 'booked' || g.status === 'rival' || g.status === 'done' || g.status === 'failed') &&
      today >= g.day &&
      today <= lastShowDay(g) + (hourOfDay < 2 ? 1 : 0),
  );
  const house = houseRigAt(state, venue.id);
  const fallback = house ? deptTotals(house) : tierInfo(venue.tier).needs;
  if (!gig) return { phase: 'idle', brand: state.company.color, rig: fallback, house: !!house };
  const last = lastShowDay(gig);
  let phase: VenuePhase = 'idle';
  if (today === gig.day && hourOfDay >= 10 && hourOfDay < 20) phase = 'load-in';
  else if (hourOfDay >= 20 && hourOfDay < 23) phase = 'show';
  else if ((today === last && hourOfDay >= 23) || (today === last + 1 && hourOfDay < 2)) phase = 'load-out';
  const rival = gig.status === 'rival' ? state.rivals.find(r => r.id === gig.rivalId) : undefined;
  return { phase, brand: rival?.color ?? state.company.color, rig: gig.needs, house: !!house && !rival };
}

export function VenueDiorama({ state, venue, height = 190 }: { state: TycoonState; venue: Venue; height?: number }) {
  const now = venueNow(state, venue);
  const draw = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number, time: number) => {
      drawVenueScene(
        ctx,
        w,
        h,
        { kind: venue.kind, year: yearOf(state, state.hour), phase: now.phase, brand: now.brand, rig: now.rig, house: now.house, seed: venue.x * 31 + venue.y },
        time,
      );
    },
    [state, venue, now.phase, now.brand, now.rig, now.house],
  );
  const caption = { idle: 'Dark tonight', 'load-in': 'Load-in under way', show: 'Show in progress', 'load-out': 'Loading out' }[now.phase];
  return (
    <div>
      <Diorama draw={draw} height={height} label={`${venue.name}: ${caption}`} />
      <div className="tt-dim" style={{ marginTop: -4, marginBottom: 6, fontSize: 11 }}>
        {caption}
      </div>
    </div>
  );
}
