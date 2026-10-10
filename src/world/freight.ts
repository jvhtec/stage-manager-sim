/**
 * Rail and air freight: send a booked show's kit from one of your bases without a truck. Rail is
 * cheap and slower (freight terminals in towns and up); air is dear and quick (airports in the
 * cities). Freight carries kit only — the show is crewed by local freelancers (your freelance
 * policy decides whether you'll hire them) — and the kit comes back the same way after load-out.
 */
import { book, formatMoney, loadInHour, loadOutDoneHour, newId, pushNews } from './core';
import { pickGear, stockSize } from './loading';
import { roadDistance } from './pathfinding';
import { worldOf } from './mapgen';
import type { CitySize, Depot, Gig, TycoonState } from './types';

export type FreightMode = 'rail' | 'air';

const MODES: Record<FreightMode, { base: number; perUnit: number; perUnitDist: number; speed: number; handling: number; minSize: CitySize[]; label: string }> = {
  rail: { base: 400, perUnit: 8, perUnitDist: 0.15, speed: 3, handling: 12, minSize: ['town', 'city', 'metropolis'], label: 'rail freight' },
  air: { base: 1500, perUnit: 40, perUnitDist: 0.6, speed: 30, handling: 8, minSize: ['city', 'metropolis'], label: 'air freight' },
};

export interface FreightQuote {
  mode: FreightMode;
  ok: boolean;
  reason?: string;
  cost: number;
  hours: number;
  units: number;
  arrives: number;
}

export function freightQuote(state: TycoonState, gig: Gig, depot: Depot, mode: FreightMode): FreightQuote {
  const m = MODES[mode];
  const world = worldOf(state);
  const from = world.cityById.get(depot.cityId);
  const to = world.cityById.get(gig.cityId);
  const no = (reason: string): FreightQuote => ({ mode, ok: false, reason, cost: 0, hours: 0, units: 0, arrives: Infinity });
  if (!from || !to) return no('Unknown town.');
  if (gig.overseas || gig.festival) return no('World tours and festivals have their own logistics.');
  if (!m.minSize.includes(from.size) || !m.minSize.includes(to.size)) return no(mode === 'air' ? 'Air freight needs an airport at both ends (cities only).' : 'Rail freight needs a terminal at both ends (towns and up).');
  const dist = roadDistance(world, depot.cityId, gig.cityId);
  if (!Number.isFinite(dist)) return no('No way through.');
  const gear = pickGear({ ...depot.gear }, { ...gig.needs }, Infinity, gig.rider);
  const units = stockSize(gear);
  if (!units) return no(`Nothing at ${from.name} for this show.`);
  const hours = Math.ceil(m.handling + dist / m.speed);
  const cost = Math.round(m.base + units * (m.perUnit + dist * m.perUnitDist));
  const arrives = state.hour + hours;
  if (arrives > loadInHour(gig)) return { mode, ok: false, reason: `Too late: it would land after load-in.`, cost, hours, units, arrives };
  return { mode, ok: true, cost, hours, units, arrives };
}

/** Mutating: send the kit for `gig` from `depot` by `mode`. */
export function dispatchFreight(s: TycoonState, gig: Gig, depot: Depot, mode: FreightMode): FreightQuote {
  const q = freightQuote(s, gig, depot, mode);
  if (!q.ok) return q;
  const gear = pickGear(depot.gear, { ...gig.needs }, Infinity, gig.rider);
  gig.freight = { mode, fromDepotId: depot.id, gear, arrives: q.arrives, cost: q.cost, hours: q.hours };
  book(s, 'freight', -q.cost);
  pushNews(s, `${q.units} units for ${gig.act} go by ${MODES[mode].label} (${formatMoney(s, q.cost)}), landing in ${q.hours}h. Local freelancers will crew it.`, 'info', { gigId: gig.id, cityId: gig.cityId });
  return q;
}

/** After the show: the kit comes home the same way. */
export function returnFreight(s: TycoonState, gig: Gig) {
  const f = gig.freight;
  if (!f || f.returned) return;
  f.returned = true;
  s.transfers.push({ id: newId(s, 'xfer'), fromDepotId: f.fromDepotId, toDepotId: f.fromDepotId, stock: { ...f.gear }, arriveHour: loadOutDoneHour(gig) + f.hours });
}

export const freightLabel = (mode: FreightMode) => MODES[mode].label;
