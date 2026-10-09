/**
 * House contracts — the venue-side "subsidy": a venue tenders a year as its
 * house PA and lighting supplier. Sign it and the kit is installed from your
 * warehouse in that town and stays there for the year, earning a monthly
 * retainer. In return, shows at that venue run on the house rig (your trucks
 * only bring the rest), and rivals can't poach them.
 */
import type { Rng } from '@/lib/rng';
import { tierInfo } from './catalog';
import { book, dateOfDay, dayOf, depotInCity, emptyCounts, formatDay, formatMoney, newId, pushNews, yearOf } from './core';
import { venueOpenIn } from './content/venueYears';
import { addStock, deptTotals, pickGear } from './loading';
import { marketNow } from './market';
import { wearFromShow } from './wear';
import type { DeptCounts, GearStock, TycoonState, VenueContract, WorldMap } from './types';

/** Chance per eligible venue per month of a tender. */
const TENDER_CHANCE = 0.035;
const TENDER_OPEN_DAYS = 14;
export const CONTRACT_MONTHS = 12;
/** Monthly retainer as a share of a single show's fee at that tier. */
const RETAINER_RATE = 0.4;
/** Walking away early costs this many months of retainer. */
export const BREAK_MONTHS = 3;
/** Monthly wear on installed kit, in show-day equivalents. */
const HOUSE_WEAR_DAYS = 1.3;

/** The house rig a venue wants: most of a show's PA, a desk or two, half the lights. */
export function houseKit(tier: number): DeptCounts {
  const n = tierInfo(tier).needs;
  return {
    audio: Math.max(2, Math.round(n.audio * 0.75)),
    console: Math.max(1, Math.round(n.console * 0.5)),
    lighting: Math.max(1, Math.round(n.lighting * 0.6)),
    video: 0,
    stage: 0,
  };
}

/** Monthly: venues put their house contracts out to tender. */
export function monthlyContracts(s: TycoonState, world: WorldMap, rng: Rng) {
  const today = dayOf(s.hour);
  const { fees, shutdown } = marketNow(s);
  if (shutdown) return;
  world.cities.forEach(city =>
    city.venues.forEach(venue => {
      if (venue.kind === 'airport' || venue.kind === 'stadium' || venue.kind === 'pub' || !venueOpenIn(venue.name, yearOf(s, s.hour))) return;
      const taken = s.contracts.some(
        c => c.venueId === venue.id && (c.status === 'offer' || c.status === 'active' || (c.status === 'rival' && s.rivals.some(r => r.id === c.rivalId))),
      );
      if (taken || !rng.chance(TENDER_CHANCE)) return;
      const startDay = today + TENDER_OPEN_DAYS + 7;
      const contract: VenueContract = {
        id: newId(s, 'contract'),
        venueId: venue.id,
        cityId: city.id,
        tier: venue.tier,
        kit: houseKit(venue.tier),
        installed: {},
        monthly: Math.round((tierInfo(venue.tier).baseFee * RETAINER_RATE * fees) / 50) * 50,
        acceptByDay: today + TENDER_OPEN_DAYS,
        startDay,
        endDay: startDay + CONTRACT_MONTHS * 30,
        status: 'offer',
      };
      s.contracts.push(contract);
      pushNews(
        s,
        `${venue.name}, ${city.name} is tendering its house PA & lighting for a year — ${formatMoney(s, contract.monthly)}/month. Bids close ${formatDay(s, contract.acceptByDay)}.`,
        'info',
        { cityId: city.id },
      );
    }),
  );
}

/** Daily: close tenders, start and end contracts, and wear the house kit monthly. */
export function dailyContracts(s: TycoonState, world: WorldMap) {
  const today = dayOf(s.hour);
  const firstOfMonth = dateOfDay(s, today).getUTCDate() === 1;
  s.contracts.forEach(c => {
    const venue = world.venueById.get(c.venueId);
    // A rival that went under or was bought out can't keep the venue's house rig.
    if (c.status === 'rival' && !s.rivals.some(r => r.id === c.rivalId)) {
      c.status = 'ended';
      c.endDay = today;
      return;
    }
    if (c.status === 'offer' && c.acceptByDay < today) {
      const rival = s.rivals
        .filter(r => c.tier >= r.minTier && c.tier <= r.maxTier && r.hqCityId === c.cityId)
        .sort((a, b) => b.reputation - a.reputation)[0];
      if (rival) {
        c.status = 'rival';
        c.rivalId = rival.id;
        pushNews(s, `${rival.name} becomes the house supplier at ${venue?.name}.`, 'info', { cityId: c.cityId });
      } else {
        c.status = 'expired';
      }
      return;
    }
    if ((c.status === 'active' || c.status === 'rival') && today >= c.endDay) {
      if (c.status === 'active') {
        returnKit(s, c);
        pushNews(s, `Your house contract at ${venue?.name} has run its course; the kit is back in the warehouse.`, 'info', { cityId: c.cityId });
      }
      c.status = 'ended';
      return;
    }
    // Venues closed in a shutdown don't pay retainers.
    if (c.status === 'active' && firstOfMonth && today >= c.startDay && !marketNow(s).shutdown) {
      book(s, 'contracts', c.monthly);
      wearFromShow(s, c.installed, HOUSE_WEAR_DAYS, false);
    }
  });
  // Forget old ones.
  s.contracts = s.contracts.filter(c => c.status === 'offer' || c.status === 'active' || c.status === 'rival' || today - c.endDay < 60);
}

function returnKit(s: TycoonState, c: VenueContract) {
  const depot = depotInCity(s, c.cityId) ?? s.depots[0];
  if (depot) addStock(depot.gear, c.installed);
  c.installed = {};
}

/** Whether your warehouse in that town holds the kit a contract needs (null: no warehouse there — a delegation won't do). */
export function contractShortfall(state: TycoonState, c: VenueContract): DeptCounts | null {
  const depot = depotInCity(state, c.cityId);
  if (!depot || depot.kind !== 'warehouse') return null;
  const have = deptTotals(depot.gear);
  const short = emptyCounts();
  let any = false;
  (Object.keys(c.kit) as (keyof DeptCounts)[]).forEach(d => {
    short[d] = Math.max(0, c.kit[d] - have[d]);
    if (short[d]) any = true;
  });
  return any ? short : emptyCounts();
}

/** Takes the house rig out of the town's warehouse (best kit first). Mutates. */
export function installKit(s: TycoonState, c: VenueContract): GearStock {
  const depot = depotInCity(s, c.cityId)!;
  const remaining = { ...c.kit };
  const picked = pickGear(depot.gear, remaining, Infinity);
  c.installed = picked;
  return picked;
}

/** The house rig at a venue, if you hold its contract. */
export function houseRigAt(state: TycoonState, venueId: string): GearStock | undefined {
  return state.contracts.find(c => c.venueId === venueId && c.status === 'active')?.installed;
}

export const holdsContractAt = (state: TycoonState, venueId: string) => !!houseRigAt(state, venueId);
