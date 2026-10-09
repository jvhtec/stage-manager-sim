/**
 * Low-emission zones in play (content/regulations.ts): which of your vehicles
 * would be charged where, the daily bill when they work in a zone, and
 * retrofitting an older truck with a filter to bring it up a class.
 */
import { getModel } from './catalog';
import { book, dateOfDay, formatMoney, pushNews, yearOf } from './core';
import { emissionClassIn, zonesStarting, zoneIn, type ZonePhase } from './content/regulations';
import type { Gig, TycoonState, Vehicle } from './types';
import { worldOf } from './mapgen';

/** A retrofit costs this share of the model's price and adds a class (once or twice). */
export const RETROFIT_COST = 0.12;
export const MAX_RETROFITS = 2;

/** Emission class: what it met when it was built, plus any retrofits. */
export const vehicleClass = (v: Pick<Vehicle, 'boughtHour' | 'retrofit'>, state: Pick<TycoonState, 'startYear'>) =>
  emissionClassIn(yearOf(state, v.boughtHour)) + (v.retrofit ?? 0);

export const retrofitCost = (v: Vehicle) => Math.round((getModel(v.modelId).price * RETROFIT_COST) / 10) * 10;

export interface ZoneBill {
  zone: ZonePhase;
  /** Vehicle's class vs what's needed. */
  vehicleClass: number;
  perDay: number;
  days: number;
  total: number;
}

/** What `v` would be charged working `gig` (zero if the town has no rule, or the truck complies). */
export function zoneBill(state: TycoonState, v: Vehicle, gig: Gig): ZoneBill | null {
  const city = worldOf(state).cityById.get(gig.cityId);
  if (!city || gig.overseas) return null;
  const year = dateOfDay(state, gig.day).getUTCFullYear();
  const zone = zoneIn(state.country, city.name, year);
  if (!zone) return null;
  const cls = vehicleClass(v, state);
  if (cls >= zone.minClass) return null;
  const days = Math.max(1, gig.days ?? 1);
  return { zone, vehicleClass: cls, perDay: zone.charge, days, total: zone.charge * days };
}

/** Mutating: a truck was on site at a show in a zone town — pay the charge. */
export function chargeZones(s: TycoonState, gig: Gig, trucks: Vehicle[]) {
  trucks.forEach(v => {
    const bill = zoneBill(s, v, gig);
    if (!bill) return;
    book(s, 'zones', -bill.total);
    v.profitThisYear -= bill.total;
    pushNews(s, `${v.name} (class ${bill.vehicleClass}) is charged ${formatMoney(s, bill.total)} in the ${bill.zone.name}. A newer or retrofitted truck would have avoided it.`, 'bad', { cityId: gig.cityId, vehicleId: v.id });
  });
}

export function retrofitBlocker(state: TycoonState, v: Vehicle): string | null {
  if ((v.retrofit ?? 0) >= MAX_RETROFITS) return 'It already has all the filters it can take.';
  if (v.cityId !== v.homeCityId || !(v.status === 'parked' || v.status === 'scheduled')) return 'Retrofits are done at its depot.';
  if (state.company.cash < retrofitCost(v)) return `A retrofit costs ${formatMoney(state, retrofitCost(v))}.`;
  return null;
}

/** New Year: tell the player about rules starting this year. */
export function yearlyZones(s: TycoonState, year: number) {
  zonesStarting(s.country, year).forEach(p =>
    pushNews(s, `${p.name} starts in ${p.cities.join(', ')}: vehicles below emission class ${p.minClass} pay ${formatMoney(s, p.charge)} a day. Check your fleet's class.`, 'big', {
      cityId: worldOf(s).cities.find(c => p.cities.includes(c.name))?.id,
    }),
  );
}
