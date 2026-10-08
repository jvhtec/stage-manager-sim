/**
 * Moving kit between your bases by courier: pay by the unit and the mile,
 * and it turns up after the drive. Lets a regional base stock up for the
 * work around it without tying up one of your own trucks.
 */
import { book, formatMoney, pushNews } from './core';
import { addStock, stockSize } from './loading';
import { roadDistance } from './pathfinding';
import { worldOf } from './mapgen';
import { facilitySpec, usedCapacity } from './facilities';
import { getProduct } from './content/gear';
import type { Depot, GearStock, TycoonState } from './types';

const COURIER_BASE = 60;
const COURIER_PER_UNIT_TILE = 0.5;
const COURIER_SPEED = 1.5;
const HANDLING_HOURS = 6;

export function transferQuote(state: TycoonState, from: Depot, to: Depot, qty: number): { cost: number; hours: number } {
  const dist = roadDistance(worldOf(state), from.cityId, to.cityId);
  if (!Number.isFinite(dist)) return { cost: Infinity, hours: Infinity };
  return { cost: Math.round(COURIER_BASE + qty * dist * COURIER_PER_UNIT_TILE), hours: Math.ceil(dist / COURIER_SPEED) + HANDLING_HOURS };
}

/** Units already on their way to a base. */
export function incoming(state: TycoonState, depotId: string): GearStock {
  const all: GearStock = {};
  state.transfers.filter(t => t.toDepotId === depotId).forEach(t => addStock(all, t.stock));
  return all;
}

export function canReceive(state: TycoonState, to: Depot, qty: number): boolean {
  return usedCapacity(state, to) + stockSize(incoming(state, to.id)) + qty <= facilitySpec(to).capacity;
}

/** Hourly: deliver whatever has arrived. */
export function deliverTransfers(s: TycoonState) {
  if (!s.transfers.length) return;
  s.transfers = s.transfers.filter(t => {
    if (s.hour < t.arriveHour) return true;
    const depot = s.depots.find(d => d.id === t.toDepotId);
    if (depot) addStock(depot.gear, t.stock);
    const units = stockSize(t.stock);
    const city = worldOf(s).cityById.get(depot?.cityId ?? '')?.name;
    pushNews(s, `${units} unit${units > 1 ? 's' : ''} of ${Object.keys(t.stock).map(id => getProduct(id).name).join(', ')} delivered to ${city}.`, 'info', { cityId: depot?.cityId });
    return false;
  });
}

export function bookTransfer(s: TycoonState, cost: number) {
  book(s, 'freight', -cost);
}

export const describeQuote = (state: TycoonState, q: { cost: number; hours: number }) =>
  `${formatMoney(state, q.cost)}, ${q.hours < 24 ? `${q.hours}h` : `${Math.round(q.hours / 24)}d`}`;
