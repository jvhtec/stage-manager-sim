/**
 * Bricks and mortar. Buy a room in a town where you have a base and it earns
 * for you every month — leased out quietly, or promoted by you with all the
 * risk and upside that brings. It ages, needs money spent on it, and keeps
 * your name warm in the town.
 */
import type { Rng } from '@/lib/rng';
import { book, formatMoney, newId, pushNews } from './core';
import { marketNow } from './market';
import { tierInfo } from './catalog';
import { worldOf } from './mapgen';
import type { OwnedVenue, TycoonState, Venue, VenueKind, VenueProgramme } from './types';

/** Purchase price per seat. */
export const PRICE_PER_SEAT: Partial<Record<VenueKind, number>> = { pub: 90, hall: 110, club: 180, theatre: 260, arena: 450 };
/** Stamp duty and fees on a purchase. */
export const BUY_FEE = 0.08;
/** Monthly share of the price: leased-out income, promoted income at an average month, upkeep. */
export const YIELD: Record<VenueProgramme, number> = { lease: 0.009, promote: 0.019 };
export const UPKEEP = 0.0035;
export const DECAY_PER_MONTH = 1.2;
export const REFURB_BELOW = 40;
export const CONDEMNED_BELOW = 12;
export const TOWN_WARMTH = 0.5;

export const ownable = (v: Venue) => PRICE_PER_SEAT[v.kind] !== undefined;
export const venuePrice = (v: Venue) => Math.round((v.capacity * (PRICE_PER_SEAT[v.kind] ?? 0)) / 100) * 100;
export const ownedOf = (s: Pick<TycoonState, 'ownedVenues'>, venueId: string) => (s.ownedVenues ?? []).find(o => o.venueId === venueId);

export function buyBlocker(s: TycoonState, v: Venue): string | null {
  if (!ownable(v)) return 'That kind of place is not for sale.';
  if (ownedOf(s, v.id)) return 'You already own it.';
  if (!s.depots.some(d => d.cityId === v.cityId)) return 'You need a base in the town to run a venue there.';
  if (s.company.reputation < tierInfo(v.tier).minReputation) return `The owner will not sell to a firm below reputation ${tierInfo(v.tier).minReputation}.`;
  if (s.contracts.some(c => c.venueId === v.id && c.status === 'rival')) return 'A rival holds the house contract and will not sell.';
  const cost = buyCost(v);
  if (s.company.cash < cost) return `Needs ${formatMoney(s, cost)} (price plus ${Math.round(BUY_FEE * 100)}% fees).`;
  return null;
}

export const buyCost = (v: Venue) => Math.round(venuePrice(v) * (1 + BUY_FEE));
/** What a sale fetches: worth less when it's run down. */
export const saleValue = (o: Pick<OwnedVenue, 'price' | 'condition'>) => Math.round((o.price * (0.55 + 0.4 * (o.condition / 100))) / 100) * 100;
export const conditionFactor = (condition: number) => (condition < CONDEMNED_BELOW ? 0 : 0.6 + 0.4 * (condition / 100));

/** What a venue should earn in an average month at its current condition. */
export function expectedMonthly(s: TycoonState, o: OwnedVenue): number {
  const cityFactor = o.programme === 'promote' ? promoteMood(s, o) : 1;
  return Math.round(o.price * YIELD[o.programme] * conditionFactor(o.condition) * cityFactor - o.price * UPKEEP);
}

/** How a promoted room is doing: the economy, your name in the town. */
function promoteMood(s: TycoonState, o: OwnedVenue): number {
  const town = 0.7 + ((s.cityRatings[o.cityId] ?? 50) / 100) * 0.6;
  return marketNow(s).demand * town;
}

export function buyVenue(s: TycoonState, v: Venue) {
  const cost = buyCost(v);
  book(s, 'venues', -cost);
  const seed = [...v.id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 3);
  s.ownedVenues.push({ venueId: v.id, cityId: v.cityId, price: venuePrice(v), condition: 50 + (seed % 30), programme: 'lease', boughtHour: s.hour, earned: 0 });
  pushNews(s, `${s.company.name} buys ${v.name} for ${formatMoney(s, cost)}.`, 'big', { cityId: v.cityId });
}

export function sellVenue(s: TycoonState, venueId: string): number {
  const o = ownedOf(s, venueId)!;
  const proceeds = saleValue(o);
  book(s, 'venues', proceeds);
  s.ownedVenues = s.ownedVenues.filter(x => x.venueId !== venueId);
  s.dilemmas = s.dilemmas.filter(d => !(d.kind === 'venue' && d.payload === venueId));
  return proceeds;
}

/** Monthly: take the money, wear the building down, ask for a refurb. */
export function monthlyVenues(s: TycoonState, rng: Rng) {
  const world = worldOf(s);
  s.ownedVenues.forEach(o => {
    const venue = world.venueById.get(o.venueId);
    const name = venue?.name ?? 'your venue';
    const noise = o.programme === 'promote' ? 1 + (rng.next() + rng.next() - 1) * 0.5 : 1;
    const income = Math.round(o.price * YIELD[o.programme] * conditionFactor(o.condition) * (o.programme === 'promote' ? promoteMood(s, o) : 1) * noise);
    const upkeep = Math.round(o.price * UPKEEP);
    book(s, 'venues', income - upkeep);
    o.earned += income - upkeep;
    o.condition = Math.max(0, o.condition - DECAY_PER_MONTH);
    s.cityRatings[o.cityId] = Math.min(100, (s.cityRatings[o.cityId] ?? 50) + TOWN_WARMTH);
    if (o.condition < CONDEMNED_BELOW && income === 0) {
      pushNews(s, `${name} has been condemned by the fire officer and is earning nothing until it is repaired.`, 'bad', { cityId: o.cityId });
    }
    if (o.condition < REFURB_BELOW && !s.dilemmas.some(d => d.kind === 'venue' && d.payload === o.venueId)) {
      const full = Math.round((o.price * 0.1) / 100) * 100;
      const patch = Math.round((o.price * 0.03) / 100) * 100;
      s.dilemmas.push({
        id: newId(s, 'dl'),
        kind: 'venue',
        title: `${name} is showing its age`,
        text: `The roof leaks, the sound is dead in the corners and the licensing officer has been round. ${name} will earn less and less until something is done.`,
        options: [
          { id: 'refurb', label: 'Full refurbishment', detail: `${formatMoney(s, full)}. Back to a proper room.`, cost: full },
          { id: 'patch', label: 'Patch it up', detail: `${formatMoney(s, patch)}. Buys a few more months.`, cost: patch },
          { id: 'defer', label: 'Defer it', detail: 'Pay nothing now. The slide continues.' },
        ],
        defaultOption: 'defer',
        payload: o.venueId,
        createdHour: s.hour,
        expiresHour: s.hour + 24 * 20,
      });
    }
  });
}
