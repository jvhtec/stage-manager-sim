/**
 * Things that must always be true of a running game, whatever the player or the rivals do. A
 * violation is a bug in the simulation, not bad luck: money appearing or vanishing outside the
 * books, kit counted twice or negative, a truck in two states at once, a booked show nobody
 * resolved, a person in two places. Tests run long games and check these every month.
 */
import { getModel, HOURS_PER_DAY } from './catalog';
import { GEAR_PRODUCTS, isOwnProduct } from './content/gear';
import { showEndHour } from './core';
import type { GearStock, TycoonState } from './types';

export type InvariantKind = 'money' | 'equipment' | 'vehicles' | 'contracts' | 'personnel';
export interface Violation {
  kind: InvariantKind;
  message: string;
}

const KNOWN = new Set(GEAR_PRODUCTS.map(p => p.id));
const TOLERANCE = 1;

export function ledgerTotal(s: Pick<TycoonState, 'ledger'>): number {
  let total = 0;
  for (const y in s.ledger) for (const c in s.ledger[y]) total += s.ledger[y][c as keyof (typeof s.ledger)[number]] ?? 0;
  return total;
}

export function checkInvariants(s: TycoonState): Violation[] {
  const out: Violation[] = [];
  const v = (kind: InvariantKind, message: string) => out.push({ kind, message });
  const stockOk = (where: string, stock: GearStock | undefined) => {
    for (const id in stock ?? {}) {
      const n = stock![id];
      if (!Number.isInteger(n) || n < 0) v('equipment', `${where}: ${n} × ${id}`);
      if (!KNOWN.has(id) && !isOwnProduct(id)) v('equipment', `${where}: unknown product ${id}`);
    }
  };

  // Money ---------------------------------------------------------------------
  if (!Number.isFinite(s.company.cash)) v('money', `cash is ${s.company.cash}`);
  if (!(s.company.loan >= 0)) v('money', `loan is ${s.company.loan}`);
  if (s.stats.startCash !== undefined) {
    // Every change in cash is either on the books or a loan drawn or repaid.
    const drift = s.company.cash - s.company.loan - (s.stats.startCash + ledgerTotal(s));
    if (Math.abs(drift) > TOLERANCE) v('money', `cash moved ${drift.toFixed(2)} outside the ledger`);
  }
  s.receivables.forEach(i => {
    if (!(i.amount > 0) || !Number.isFinite(i.dueDay)) v('money', `invoice ${i.id}: ${i.amount} due ${i.dueDay}`);
  });

  // Equipment -----------------------------------------------------------------
  s.depots.forEach(d => stockOk(`depot ${d.id}`, d.gear));
  s.contracts.forEach(c => c.status === 'active' && stockOk(`house rig ${c.id}`, c.installed));
  for (const id in s.gearCondition) {
    const c = s.gearCondition[id];
    if (!(c >= 0 && c <= 100)) v('equipment', `condition of ${id} is ${c}`);
  }

  // Vehicles ------------------------------------------------------------------
  const gigIds = new Set(s.gigs.map(g => g.id));
  const peopleOn = new Map<string, number>();
  s.people.forEach(m => m.vehicleId && peopleOn.set(m.vehicleId, (peopleOn.get(m.vehicleId) ?? 0) + 1));
  const rivalIds = new Set(s.rivals.map(r => r.id));
  s.vehicles.forEach(veh => {
    const model = getModel(veh.modelId);
    const where = `${veh.name} (${veh.id})`;
    if (veh.owner !== 'player') {
      if (!rivalIds.has(veh.owner)) v('vehicles', `${where} belongs to a firm that no longer exists`);
      return;
    }
    stockOk(where, veh.cargo);
    const units = Object.values(veh.cargo).reduce((a, b) => a + b, 0);
    if (units > model.gearCapacity) v('vehicles', `${where} carries ${units} units, room for ${model.gearCapacity}`);
    if (veh.crew > model.crewSeats) v('vehicles', `${where} carries ${veh.crew} crew, ${model.crewSeats} seats`);
    if ((peopleOn.get(veh.id) ?? 0) !== veh.crew) v('personnel', `${where} says ${veh.crew} aboard, ${peopleOn.get(veh.id) ?? 0} people are`);
    if (veh.status === 'driving' && (!veh.route || veh.cityId)) v('vehicles', `${where} is driving without a route, or while parked in a town`);
    if (['parked', 'on-site', 'servicing', 'scheduled'].includes(veh.status) && !veh.cityId) v('vehicles', `${where} is ${veh.status} but in no town`);
    if (veh.status === 'broken' && veh.brokenUntil === undefined) v('vehicles', `${where} is broken with no repair time`);
    if (veh.status === 'hired-out' && s.busHires.filter(h => h.status === 'active' && h.vehicleId === veh.id).length !== 1) v('vehicles', `${where} is out on hire without exactly one contract`);
    veh.orders.forEach(id => {
      if (!gigIds.has(id)) v('vehicles', `${where} has orders for a show that no longer exists (${id})`);
    });
  });
  s.busHires.forEach(h => {
    if (h.status !== 'active') return;
    const bus = s.vehicles.find(x => x.id === h.vehicleId);
    if (!bus || bus.status !== 'hired-out') v('vehicles', `bus hire ${h.id} has no bus out on it`);
  });

  // Contracts -----------------------------------------------------------------
  s.gigs.forEach(g => {
    if (g.terms && (g.terms.deposit < 0 || g.terms.deposit > 1 || g.terms.cancel < 0 || g.terms.cancel > 1)) v('contracts', `${g.id}: terms out of range`);
    if ((g.depositPaid ?? 0) > g.fee + TOLERANCE) v('contracts', `${g.id}: deposit ${g.depositPaid} over the fee ${g.fee}`);
    if (g.cancelled && g.status !== 'expired') v('contracts', `${g.id}: cancelled but ${g.status}`);
    // A show that has been and gone must have been resolved, by you or by the rival who held it.
    if ((g.status === 'booked' || (g.status === 'rival' && !g.result)) && s.hour > showEndHour(g) + HOURS_PER_DAY) v('contracts', `${g.id} (${g.act}) was ${g.status} and never played`);
    if (g.status === 'rival' && !g.result && (!g.rivalId || !rivalIds.has(g.rivalId))) v('contracts', `${g.id} is held by a firm that no longer exists`);
    stockOk(`cross-hire ${g.id}`, g.crossHire);
    if (g.freight) stockOk(`freight ${g.id}`, g.freight.gear);
  });
  s.tours.forEach(t => {
    if (t.status !== 'booked') return;
    t.gigIds.forEach(id => {
      const g = s.gigs.find(x => x.id === id);
      if (g && g.status !== 'booked' && g.status !== 'done' && g.status !== 'failed') v('contracts', `tour ${t.id}: date ${id} is ${g.status}`);
    });
  });

  // Personnel -----------------------------------------------------------------
  const depotIds = new Set(s.depots.map(d => d.id));
  const playerVehicles = new Set(s.vehicles.filter(x => x.owner === 'player').map(x => x.id));
  const atDepot = new Map<string, number>();
  const ids = new Set<string>();
  s.people.forEach(m => {
    if (ids.has(m.id)) v('personnel', `${m.name} (${m.id}) is on the books twice`);
    ids.add(m.id);
    if (!!m.depotId === !!m.vehicleId) v('personnel', `${m.name} is ${m.depotId ? 'at a base and on a truck' : 'nowhere'}`);
    if (m.depotId && !depotIds.has(m.depotId)) v('personnel', `${m.name} is at a base that doesn't exist`);
    if (m.vehicleId && !playerVehicles.has(m.vehicleId)) v('personnel', `${m.name} is on a truck that doesn't exist`);
    if (m.depotId) atDepot.set(m.depotId, (atDepot.get(m.depotId) ?? 0) + 1);
    if (!(m.fatigue >= 0 && m.fatigue <= 100)) v('personnel', `${m.name}: fatigue ${m.fatigue}`);
    if (m.burnout !== undefined && !(m.burnout >= 0 && m.burnout <= 100)) v('personnel', `${m.name}: burnout ${m.burnout}`);
  });
  s.depots.forEach(d => {
    if ((atDepot.get(d.id) ?? 0) !== d.crew) v('personnel', `base ${d.id} says ${d.crew} crew, ${atDepot.get(d.id) ?? 0} people are there`);
  });
  s.gigs.forEach(g => (g.crewPicks ?? []).forEach(id => !ids.has(id) && g.status === 'booked' && v('personnel', `${g.id} names someone who has left (${id})`)));
  s.poachBids.forEach(b => !ids.has(b.personId) && v('personnel', `a poaching bid for someone who has left (${b.personId})`));
  return out;
}
