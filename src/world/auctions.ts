/**
 * Second-hand market. When a rival goes under — or a hire shop closes its
 * doors — its kit and trucks go to auction. It's a Dutch auction: the asking
 * price starts high and slides every day, but every day another buyer may
 * snap a lot up first. Used kit is cheaper than new but worn.
 */
import type { Rng } from '@/lib/rng';
import { HOURS_PER_DAY, DAYS_PER_YEAR, GEAR_RESALE_RATE, getModel, tierInfo } from './catalog';
import { dayOf, formatMoney, newId, pushNews, sellValue, yearOf } from './core';
import { getProduct } from './content/gear';
import { rentalProduct } from './hire';
import { makeVehicle } from './state';
import { worldOf } from './mapgen';
import { ownedStock, condition } from './wear';
import { facilitySpec, canBaseVehicle } from './facilities';
import { canReceive } from './transfers';
import { DEPTS, type Auction, type AuctionLot, type TycoonState } from './types';

/** Days an auction runs before the leftovers are carted off. */
export const AUCTION_DAYS = 21;
/** Asking price as a share of the lot's market value: starts here, slides 3 points a day… */
const START_FACTOR = 0.95;
const SLIDE_PER_DAY = 0.03;
/** …to this floor — still above what you'd get reselling, so there's no free money in it. */
const FLOOR_FACTOR = 0.7;
/** Used kit's market value, as a multiple of what it would resell for. */
const MARKET_PREMIUM = 1.5;
const ESTATE_SALE_CHANCE = 0.1;
const SELLERS = ['A closing-down hire shop', 'The receivers of a touring-rig dealer', 'A retiring concert-sound pioneer', 'A venue refit clearance'];

export const priceFactor = (a: Auction, day: number) => Math.max(FLOOR_FACTOR, START_FACTOR - SLIDE_PER_DAY * Math.max(0, day - a.startDay));
export const lotPrice = (a: Auction, lot: AuctionLot, day: number) => Math.round((lot.value * priceFactor(a, day)) / 10) * 10;

function makeLots(s: TycoonState, rng: Rng, maxTier: number): AuctionLot[] {
  const year = yearOf(s, s.hour);
  const lots: AuctionLot[] = [];
  const needs = tierInfo(Math.max(1, maxTier)).needs;
  DEPTS.forEach(d => {
    const id = rentalProduct(d, Math.max(1, maxTier), year);
    if (!id || !needs[d]) return;
    const qty = Math.max(1, Math.round(needs[d] * (0.5 + rng.next() * 0.7)));
    const cond = Math.round(45 + rng.next() * 35);
    const p = getProduct(id);
    lots.push({
      id: newId(s, 'lot'),
      kind: 'gear',
      productId: id,
      qty,
      condition: cond,
      value: Math.round(p.price * qty * GEAR_RESALE_RATE * (0.5 + 0.5 * (cond / 100)) * MARKET_PREMIUM),
    });
  });
  const models = s.announcedModels.map(getModel).filter(m => m.kind !== 'bus' || maxTier >= 3);
  const nVehicles = 1 + rng.nextInt(Math.min(3, 1 + maxTier));
  for (let i = 0; i < nVehicles && models.length; i++) {
    const m = rng.pick(models);
    const age = Math.round((2 + rng.next() * Math.max(1, m.lifespanYears - 3)) * 10) / 10;
    const v = makeVehicle(s, m.id, '');
    v.boughtHour = s.hour - age * DAYS_PER_YEAR * HOURS_PER_DAY;
    lots.push({
      id: newId(s, 'lot'),
      kind: 'vehicle',
      modelId: m.id,
      ageYears: age,
      reliability: Math.max(35, Math.round(m.reliability - age * 3)),
      value: Math.round((sellValue(v, s.hour) * MARKET_PREMIUM) / 10) * 10,
    });
  }
  return lots;
}

/** Mutating: put a seller's stock under the hammer. */
export function openAuction(s: TycoonState, rng: Rng, seller: string, cityId: string, maxTier: number, why: 'bust' | 'estate') {
  const lots = makeLots(s, rng, maxTier);
  if (!lots.length) return;
  s.auctions.push({ id: newId(s, 'auc'), seller, cityId, startDay: dayOf(s.hour), endDay: dayOf(s.hour) + AUCTION_DAYS, lots });
  const city = worldOf(s).cityById.get(cityId)?.name;
  pushNews(
    s,
    why === 'bust'
      ? `${seller}'s kit and trucks go under the hammer in ${city} — the asking prices fall daily, but others are looking too.`
      : `${seller} is selling up in ${city}: used kit and trucks at auction for the next ${AUCTION_DAYS} days.`,
    'big',
    { cityId },
  );
}

/** Monthly: the odd estate sale turns up. */
export function monthlyAuctions(s: TycoonState, rng: Rng) {
  if (s.auctions.length >= 2 || !rng.chance(ESTATE_SALE_CHANCE)) return;
  const world = worldOf(s);
  const cities = world.cities.filter(c => c.size !== 'village');
  if (!cities.length) return;
  openAuction(s, rng, rng.pick(SELLERS), rng.pick(cities).id, 2 + rng.nextInt(2), 'estate');
}

/** Daily: other buyers snap lots up (likelier as they get cheaper); auctions close. */
export function dailyAuctions(s: TycoonState, rng: Rng) {
  if (!s.auctions.length) return;
  const day = dayOf(s.hour);
  s.auctions.forEach(a => {
    a.lots = a.lots.filter(lot => !rng.chance(0.02 + (START_FACTOR - priceFactor(a, day)) * 0.2));
  });
  s.auctions = s.auctions.filter(a => day < a.endDay && a.lots.length);
}

export const lotName = (lot: AuctionLot) => {
  if (lot.kind === 'gear') {
    const p = getProduct(lot.productId!);
    return `${lot.qty}× ${p.brand} ${p.name}`;
  }
  return `${getModel(lot.modelId!).name}, ${lot.ageYears} yrs old`;
};

export function lotBlocker(s: TycoonState, a: Auction, lot: AuctionLot, depotId: string): string | null {
  const depot = s.depots.find(d => d.id === depotId);
  if (!depot) return 'Pick a base to send it to.';
  const price = lotPrice(a, lot, dayOf(s.hour));
  if (s.company.cash < price) return `It costs ${formatMoney(s, price)}.`;
  if (lot.kind === 'gear' && !canReceive(s, depot, lot.qty!)) return `The ${facilitySpec(depot).label.toLowerCase()} is full (${facilitySpec(depot).capacity} units).`;
  if (lot.kind === 'vehicle' && !canBaseVehicle(depot, getModel(lot.modelId!).kind)) return 'A delegation has no loading dock — vans and crew buses only.';
  return null;
}

/** Mutating: take a lot home. Returns the price paid. */
export function takeLot(s: TycoonState, a: Auction, lot: AuctionLot, depotId: string): number {
  const depot = s.depots.find(d => d.id === depotId)!;
  const price = lotPrice(a, lot, dayOf(s.hour));
  if (lot.kind === 'gear') {
    const id = lot.productId!;
    const before = ownedStock(s)[id] ?? 0;
    depot.gear[id] = (depot.gear[id] ?? 0) + lot.qty!;
    s.gearCondition[id] = before ? (condition(s, id) * before + lot.condition! * lot.qty!) / (before + lot.qty!) : lot.condition!;
  } else {
    const v = makeVehicle(s, lot.modelId!, depot.cityId);
    v.boughtHour = s.hour - lot.ageYears! * DAYS_PER_YEAR * HOURS_PER_DAY;
    v.reliability = lot.reliability!;
    s.vehicles.push(v);
  }
  a.lots = a.lots.filter(l => l.id !== lot.id);
  s.auctions = s.auctions.filter(x => x.lots.length);
  return price;
}
