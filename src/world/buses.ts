/**
 * Tour bus hire: a business that doesn't depend on your own shows. Touring acts want a bus and
 * driver for weeks at a time; buy coaches and hire them out. You're paid a day rate (the driver
 * comes out of it), the bus wears on the road and now and then breaks down mid-tour, and
 * rivals compete for the same contracts — the ones you leave on the table go to them.
 */
import type { Rng } from '@/lib/rng';
import { book, dayOf, formatMoney, newId, pushNews } from './core';
import { getModel, tierInfo } from './catalog';
import { marketNow } from './market';
import { COUNTRY_FEES } from './offers';
import { actName } from './offers';
import type { BusHire, TycoonState, Vehicle } from './types';

/** Share of the day rate the driver costs. */
export const DRIVER_SHARE = 0.3;
/** Reliability a bus loses each day on tour. */
export const DAILY_BUS_WEAR = 0.06;
/** Chance a bus on tour breaks down on a given day. */
export const BUS_BREAKDOWN_CHANCE = 0.012;
/** Chance per day a rival takes an open contract. */
export const RIVAL_TAKES_CHANCE = 0.12;

export const isBus = (v: Pick<Vehicle, 'modelId'>) => getModel(v.modelId).kind === 'bus';

/** A bus ready to go out: parked at its depot with nothing booked. */
export function freeBuses(s: TycoonState): Vehicle[] {
  return s.vehicles.filter(v => v.owner === 'player' && isBus(v) && v.cityId === v.homeCityId && (v.status === 'parked' || v.status === 'scheduled') && !v.orders.length);
}

/** Daily: touring acts look for buses. */
export function dailyBusOffers(s: TycoonState, rng: Rng) {
  const open = s.busHires.filter(h => h.status === 'offer').length;
  if (open >= 4) return;
  const m = marketNow(s);
  if (m.shutdown) return;
  const chance = 0.06 * m.demand * (0.5 + s.company.reputation / 100);
  if (!rng.chance(chance)) return;
  // Bigger acts need a better reputation to even ask you.
  const maxTier = s.company.reputation >= 70 ? 4 : s.company.reputation >= 45 ? 3 : 2;
  const tier = rng.nextRange(1, maxTier);
  const today = dayOf(s.hour);
  const days = rng.nextRange(10, 24) + tier * rng.nextRange(3, 8);
  const rate = Math.round((60 + tier * 55 + rng.nextRange(-10, 25)) * (COUNTRY_FEES[s.country ?? ''] ?? 1) * m.fees / 5) * 5;
  s.busHires.push({
    id: newId(s, 'bus'),
    act: actName(rng),
    tier,
    days,
    rate,
    startDay: today + rng.nextRange(6, 16),
    acceptByDay: today + rng.nextRange(4, 9),
    status: 'offer',
  });
}

/** Daily: contracts run, expire or go to a rival; hired-out buses earn, wear and sometimes break. */
export function dailyBusHire(s: TycoonState, rng: Rng) {
  const today = dayOf(s.hour);
  s.busHires.forEach(h => {
    if (h.status === 'offer') {
      if (today > h.acceptByDay || (today >= h.startDay - 1)) {
        h.status = 'lost';
        return;
      }
      if (s.rivals.length && rng.chance(RIVAL_TAKES_CHANCE)) {
        const rival = rng.pick(s.rivals);
        h.status = 'lost';
        h.rivalId = rival.id;
        pushNews(s, `${rival.name} won the ${h.act} tour bus contract.`, 'info');
      }
      return;
    }
    if (h.status !== 'active') return;
    const bus = s.vehicles.find(v => v.id === h.vehicleId);
    if (!bus) {
      h.status = 'done';
      return;
    }
    if (today < h.startDay) return; // reserved, not yet on the road
    // Paid for days startDay … startDay + days − 1; it comes back on startDay + days.
    if (today >= h.startDay + h.days) {
      endHire(s, h, bus);
      return;
    }
    const wages = Math.round(h.rate * DRIVER_SHARE);
    book(s, 'busHire', h.rate);
    book(s, 'wages', -wages);
    h.earned = (h.earned ?? 0) + h.rate - wages;
    bus.profitThisYear += h.rate - wages;
    bus.reliability = Math.max(20, bus.reliability - DAILY_BUS_WEAR);
    if (rng.chance(BUS_BREAKDOWN_CHANCE * (1 + (100 - bus.reliability) / 60))) {
      const repair = Math.round((getModel(bus.modelId).price * 0.04) / 10) * 10;
      book(s, 'servicing', -repair);
      bus.profitThisYear -= repair;
      h.earned -= repair;
      pushNews(s, `${bus.name} broke down on the ${h.act} tour: ${formatMoney(s, repair)} to get it going again.`, 'bad', { vehicleId: bus.id });
    }
  });
  // Keep the books short.
  if (s.busHires.length > 40) s.busHires = s.busHires.filter(h => h.status === 'active' || h.status === 'offer').concat(s.busHires.filter(h => h.status === 'done' || h.status === 'lost').slice(-14));
}

function endHire(s: TycoonState, h: BusHire, bus: Vehicle) {
  h.status = 'done';
  bus.status = 'parked';
  bus.busyUntil = undefined;
  bus.cityId = bus.homeCityId;
  s.artistRelations[h.act] = (s.artistRelations[h.act] ?? 0) + 1;
  s.company.reputation = Math.min(100, s.company.reputation + 0.15 * h.tier);
  pushNews(s, `${bus.name} is back from the ${h.act} tour, having earned ${formatMoney(s, h.earned ?? 0)} over ${h.days} days.`, 'good', { vehicleId: bus.id });
}

export const hireTotal = (h: Pick<BusHire, 'rate' | 'days'>) => h.rate * h.days;
export const hireNet = (h: Pick<BusHire, 'rate' | 'days'>) => Math.round(h.rate * (1 - DRIVER_SHARE) * h.days);

export function busHireBlocker(s: TycoonState, h: BusHire, v: Vehicle): string | null {
  if (h.status !== 'offer') return 'That contract is gone.';
  if (!isBus(v)) return 'Only a coach or sleeper bus can go on tour.';
  if (v.cityId !== v.homeCityId || !(v.status === 'parked' || v.status === 'scheduled') || v.orders.length) return `${v.name} needs to be parked at its depot with nothing booked.`;
  if (dayOf(s.hour) >= h.startDay - 1) return 'It leaves too soon.';
  if (v.reliability < 45) return `${v.name} is too worn for a tour: service it first.`;
  return null;
}

/** The tier label of the act, for windows. */
export const busHireTier = (h: BusHire) => tierInfo(h.tier).label;
