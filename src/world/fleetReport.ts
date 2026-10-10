/**
 * The whole fleet at a glance: how hard each vehicle works, what needs
 * attention in the next two weeks, and which trucks earn their keep.
 */
import { zoneBill } from './regulation';
import { SERVICE_INTERVAL_DAYS, getModel } from './catalog';
import { dayOf, formatMoney, gigById, vehicleAgeYears } from './core';
import { projectCoverage } from './queries';
import type { Gig, TycoonState, Vehicle } from './types';

/** A vehicle's usage is an exponential average over about this many days. */
export const UTIL_DAYS = 50;
export const START_UTILISATION = 0.5;
/** How far ahead the alerts look. */
export const ALERT_HORIZON_DAYS = 14;

export const utilisationOf = (v: Pick<Vehicle, 'util'>) => v.util ?? START_UTILISATION;

/** Daily: update how busy each vehicle has been (working, on the road, or booked ahead counts). */
export function dailyUtilisation(s: TycoonState) {
  s.vehicles.forEach(v => {
    if (v.owner !== 'player') return;
    const busy = v.orders.length > 0 || v.status === 'driving' || v.status === 'on-site' || v.status === 'broken';
    v.util = utilisationOf(v) * (1 - 1 / UTIL_DAYS) + (busy ? 1 / UTIL_DAYS : 0);
  });
}

export interface FleetAlert {
  id: string;
  severity: 'bad' | 'warn' | 'info';
  text: string;
  vehicleId?: string;
  gigId?: string;
}

export interface FleetRow {
  vehicle: Vehicle;
  utilisation: number;
  ageYears: number;
  daysSinceService: number;
  profit: number;
  nextGig?: Gig;
}

export interface FleetSummary {
  rows: FleetRow[];
  alerts: FleetAlert[];
  count: number;
  onTheRoad: number;
  idle: number;
  inWorkshop: number;
  avgUtilisation: number;
  avgReliability: number;
  avgAge: number;
  profit: number;
  best?: FleetRow;
  worst?: FleetRow;
  /** Booked shows in the next two weeks, and how many are fully covered. */
  upcoming: { total: number; covered: number };
}

const SEVERITY_ORDER = { bad: 0, warn: 1, info: 2 } as const;

export function fleetSummary(state: TycoonState): FleetSummary {
  const today = dayOf(state.hour);
  const fleet = state.vehicles.filter(v => v.owner === 'player');
  const rows: FleetRow[] = fleet.map(v => ({
    vehicle: v,
    utilisation: utilisationOf(v),
    ageYears: vehicleAgeYears(v, state.hour),
    daysSinceService: Math.floor((state.hour - v.lastServiceHour) / 24),
    profit: v.profitThisYear,
    nextGig: v.orders.map(id => gigById(state, id)).find(g => g && g.status === 'booked'),
  }));
  const alerts: FleetAlert[] = [];

  // Shows coming up: nobody going, not going to make it, or short.
  const soon = state.gigs.filter(g => g.status === 'booked' && g.day >= today && g.day - today <= ALERT_HORIZON_DAYS).sort((a, b) => a.day - b.day);
  let covered = 0;
  soon.forEach(g => {
    const p = projectCoverage(state, g);
    const days = g.day - today;
    const when = days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
    if (!p.vehicles.length && !g.freight) {
      alerts.push({ id: `a-${g.id}`, severity: 'bad', text: `${g.act} plays ${when} and no vehicle is assigned.`, gigId: g.id });
    } else if (!p.onTime) {
      alerts.push({ id: `l-${g.id}`, severity: 'bad', text: `${g.act} (${when}): the truck won't make load-in.`, gigId: g.id });
    } else if (p.evaluation.coverage < 0.95 || p.crew < g.crewNeeded) {
      alerts.push({ id: `s-${g.id}`, severity: 'warn', text: `${g.act} (${when}) is short on ${p.evaluation.coverage < 0.95 ? 'gear' : 'crew'}.`, gigId: g.id });
    } else covered++;
  });

  // Trucks that would be charged in a low-emission zone for a booked show.
  state.vehicles.filter(v => v.owner === 'player').forEach(v => {
    v.orders
      .map(id => gigById(state, id))
      .filter((g): g is Gig => !!g && g.status === 'booked')
      .forEach(g => {
        const bill = zoneBill(state, v, g);
        if (bill) alerts.push({ id: `z-${v.id}-${g.id}`, severity: 'warn', text: `${v.name} (class ${bill.vehicleClass}) will be charged ${formatMoney(state, bill.total)} in the ${bill.zone.name} for ${g.act}.`, vehicleId: v.id, gigId: g.id });
      });
  });

  rows.forEach(r => {
    const v = r.vehicle;
    const model = getModel(v.modelId);
    if (v.status === 'broken') alerts.push({ id: `b-${v.id}`, severity: 'bad', text: `${v.name} has broken down.`, vehicleId: v.id });
    if (r.daysSinceService > SERVICE_INTERVAL_DAYS && v.status !== 'servicing')
      alerts.push({ id: `sv-${v.id}`, severity: 'warn', text: `${v.name} is ${r.daysSinceService - SERVICE_INTERVAL_DAYS} days overdue for a service.`, vehicleId: v.id });
    if (v.reliability < 40) alerts.push({ id: `r-${v.id}`, severity: 'warn', text: `${v.name} is only ${Math.round(v.reliability)}% reliable.`, vehicleId: v.id });
    if (r.ageYears > model.lifespanYears) alerts.push({ id: `o-${v.id}`, severity: 'info', text: `${v.name} is past its ${model.lifespanYears}-year life and wearing faster.`, vehicleId: v.id });
    if (!v.orders.length && v.status !== 'driving' && r.utilisation < 0.25 && vehicleAgeYears(v, state.hour) * 365 > UTIL_DAYS)
      alerts.push({ id: `i-${v.id}`, severity: 'info', text: `${v.name} has barely worked lately — find it jobs or sell it.`, vehicleId: v.id });
  });
  alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
  const ranked = [...rows].sort((a, b) => b.profit - a.profit);
  return {
    rows,
    alerts,
    count: rows.length,
    onTheRoad: fleet.filter(v => v.status === 'driving' || v.status === 'on-site' || v.status === 'broken').length,
    idle: fleet.filter(v => !v.orders.length && (v.status === 'parked' || v.status === 'scheduled')).length,
    inWorkshop: fleet.filter(v => v.status === 'servicing').length,
    avgUtilisation: avg(rows.map(r => r.utilisation)),
    avgReliability: avg(fleet.map(v => v.reliability)),
    avgAge: avg(rows.map(r => r.ageYears)),
    profit: rows.reduce((sum, r) => sum + r.profit, 0),
    best: ranked[0],
    worst: ranked.length > 1 ? ranked[ranked.length - 1] : undefined,
    upcoming: { total: soon.length, covered },
  };
}
