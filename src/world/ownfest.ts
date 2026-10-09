/**
 * Your own festival. Instead of supplying someone else's field, put one on:
 * pick a size, a headliner and a ticket price in spring, pay for it up front,
 * and take your chances with the economy and the weather in summer. The first
 * editions struggle; a brand built over the years sells itself.
 */
import type { Rng } from '@/lib/rng';
import { dateOfDay, dayOf, formatMoney, newId, pushNews, book, yearOf } from './core';
import { marketNow } from './market';
import { worldOf } from './mapgen';
import type { FestHeadliner, FestTicket, FestTier, OwnFestival, TycoonState } from './types';

export interface FestTierInfo {
  label: string;
  capacity: number;
  minReputation: number;
  /** Set-up, security, toilets and stages, up front. */
  setup: number;
  /** Per-head production and staffing. */
  perHead: number;
  /** Day of the year it's held. */
  doy: number;
}

export const FEST_TIERS: Record<FestTier, FestTierInfo> = {
  field: { label: 'A field day', capacity: 3000, minReputation: 35, setup: 22000, perHead: 16, doy: 175 },
  weekender: { label: 'A weekender', capacity: 15000, minReputation: 55, setup: 90000, perHead: 18, doy: 200 },
  major: { label: 'A major festival', capacity: 50000, minReputation: 72, setup: 300000, perHead: 20, doy: 225 },
};
export const FEST_TIER_IDS: FestTier[] = ['field', 'weekender', 'major'];

export const FEST_HEADLINERS: Record<FestHeadliner, { label: string; draw: number; costPerHead: number }> = {
  local: { label: 'Local heroes', draw: 0.9, costPerHead: 1.5 },
  name: { label: 'A big name', draw: 1.1, costPerHead: 5 },
  star: { label: 'A global star', draw: 1.3, costPerHead: 12 },
};
export const FEST_HEADLINER_IDS: FestHeadliner[] = ['local', 'name', 'star'];

export const FEST_TICKETS: Record<FestTicket, { label: string; price: number; demand: number }> = {
  low: { label: 'Cheap', price: 24, demand: 1.2 },
  fair: { label: 'Fair', price: 34, demand: 1 },
  premium: { label: 'Premium', price: 46, demand: 0.78 },
};
export const FEST_TICKET_IDS: FestTicket[] = ['low', 'fair', 'premium'];

/** Plans open this far into the year, and close at the start of May. */
export const PLAN_FROM_DOY = 0;
export const PLAN_UNTIL_DOY = 120;
/** Bar, merch and camping on top of the ticket. */
const SPEND_PER_HEAD = 8;
/** Each vehicle in the fleet takes this much off the production bill (to a cap). */
const FLEET_DISCOUNT = 0.05;
const FLEET_DISCOUNT_CAP = 0.3;
export const STORM_CHANCE = 0.18;
/** Covered stages and drainage. */
export const COVER_COST_PER_HEAD = 2.5;
/** What the insurers pay back / the shutdown leaves you with. */
export const SHUTDOWN_REFUND = 0.4;

const doyOf = (s: TycoonState, day: number) => {
  const d = dateOfDay(s, day);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000);
};
const dayFor = (s: TycoonState, year: number, doy: number) => Math.round((Date.UTC(year, 0, 1) - Date.UTC(s.startYear, 0, 1)) / 86400000) + doy;

export const fleetDiscount = (s: TycoonState) =>
  Math.min(FLEET_DISCOUNT_CAP, s.vehicles.filter(v => v.owner === 'player').length * FLEET_DISCOUNT);

export interface FestQuote {
  setup: number;
  production: number;
  headliner: number;
  total: number;
  capacity: number;
}

export function festQuote(s: TycoonState, tier: FestTier, headliner: FestHeadliner): FestQuote {
  const t = FEST_TIERS[tier];
  const production = Math.round((t.capacity * t.perHead * (1 - fleetDiscount(s))) / 100) * 100;
  const head = Math.round((t.capacity * FEST_HEADLINERS[headliner].costPerHead) / 100) * 100;
  return { setup: t.setup, production, headliner: head, total: t.setup + production + head, capacity: t.capacity };
}

/** Attendance before the dice, as a share of capacity. */
export function festDemand(s: TycoonState, f: Pick<OwnFestival, 'tier' | 'headliner' | 'ticket' | 'cityId'>): number {
  const brand = s.festivalBrand ?? 0;
  const town = 0.9 + ((s.cityRatings[f.cityId] ?? 50) / 100) * 0.2;
  const demand = marketNow(s).demand;
  const base = 0.5 + 0.5 * (brand / 100);
  return base * FEST_HEADLINERS[f.headliner].draw * FEST_TICKETS[f.ticket].demand * demand * town;
}

export function festBlocker(s: TycoonState, tier: FestTier, headliner: FestHeadliner): string | null {
  const year = yearOf(s, s.hour);
  const doy = doyOf(s, dayOf(s.hour));
  if (s.ownFestival && s.ownFestival.year === year) return 'You already have an edition this year.';
  if (doy >= PLAN_UNTIL_DOY) return 'Too late for this summer — plans close at the end of April.';
  if (!s.depots.length) return 'You need a base to host from.';
  const t = FEST_TIERS[tier];
  if (s.company.reputation < t.minReputation) return `${t.label} needs reputation ${t.minReputation}+.`;
  if (marketNow(s).shutdown) return 'No licence while venues are shut.';
  const quote = festQuote(s, tier, headliner);
  if (s.company.cash < quote.total) return `Needs ${formatMoney(s, quote.total)} up front.`;
  return null;
}

export function planFestival(s: TycoonState, tier: FestTier, headliner: FestHeadliner, ticket: FestTicket, cityId: string) {
  const year = yearOf(s, s.hour);
  const quote = festQuote(s, tier, headliner);
  book(s, 'festival', -quote.total);
  s.ownFestival = { year, tier, headliner, ticket, cityId, day: dayFor(s, year, FEST_TIERS[tier].doy), paid: quote.total, covered: false, status: 'planned' };
  const city = worldOf(s).cityById.get(cityId)?.name;
  pushNews(s, `${s.company.name} announces its own festival in ${city} for ${formatMoney(s, quote.total)} up front.`, 'big', { cityId });
}

export interface FestResult {
  attendance: number;
  revenue: number;
  profit: number;
  stormed: boolean;
}

/** Daily: two days out ask about the weather; on the day, count the gate. */
export function dailyOwnFestival(s: TycoonState, rng: Rng) {
  const f = s.ownFestival;
  if (!f || f.status !== 'planned') return;
  const today = dayOf(s.hour);
  if (today === f.day - 2 && !s.dilemmas.some(d => d.kind === 'ownfest')) {
    const cover = Math.round((FEST_TIERS[f.tier].capacity * COVER_COST_PER_HEAD) / 100) * 100;
    s.dilemmas.push({
      id: newId(s, 'dl'),
      kind: 'ownfest',
      title: 'Forecast: unsettled weather',
      text: `Your festival opens in two days and the forecast is shaky. Covered stages and drainage would take most of the sting out of a storm.`,
      options: [
        { id: 'cover', label: 'Cover the stages', detail: `${formatMoney(s, cover)}. A storm only costs you a quarter of the crowd instead of most of it.`, cost: cover },
        { id: 'gamble', label: 'Gamble on sun', detail: 'Save the money. If it pours, the field empties.' },
      ],
      defaultOption: 'gamble',
      payload: f.day.toString(),
      createdHour: s.hour,
      expiresHour: s.hour + 24 * 2,
    });
    return;
  }
  if (today < f.day) return;
  settleFestival(s, rng, f);
}

function settleFestival(s: TycoonState, rng: Rng, f: OwnFestival) {
  const city = worldOf(s).cityById.get(f.cityId)?.name;
  const t = FEST_TIERS[f.tier];
  if (marketNow(s).shutdown) {
    const back = Math.round(f.paid * SHUTDOWN_REFUND);
    book(s, 'festival', back);
    f.status = 'done';
    f.result = { attendance: 0, revenue: back, profit: back - f.paid, stormed: false };
    s.festivalHistory.push({ year: f.year, tier: f.tier, attendance: 0, profit: back - f.paid, brand: s.festivalBrand ?? 0 });
    pushNews(s, `Your festival in ${city} is cancelled by the shutdown. Insurance and suppliers return ${formatMoney(s, back)}.`, 'bad', { cityId: f.cityId });
    return;
  }
  const stormed = rng.chance(STORM_CHANCE);
  const noise = 1 + (rng.next() + rng.next() - 1) * 0.3;
  let share = festDemand(s, f) * noise;
  if (stormed) share *= f.covered ? 0.75 : 0.4;
  share = Math.max(0.05, Math.min(1, share));
  const attendance = Math.round(t.capacity * share);
  const revenue = Math.round(attendance * (FEST_TICKETS[f.ticket].price + SPEND_PER_HEAD));
  book(s, 'festival', revenue);
  const profit = revenue - f.paid - (f.covered ? Math.round((t.capacity * COVER_COST_PER_HEAD) / 100) * 100 : 0);
  f.status = 'done';
  f.result = { attendance, revenue, profit, stormed };

  const prev = s.festivalBrand ?? 0;
  const delta = share >= 0.9 ? 9 : share >= 0.7 ? 4 : share >= 0.5 ? 1 : -5;
  s.festivalBrand = Math.max(0, Math.min(100, prev + delta));
  s.company.reputation = Math.max(0, Math.min(100, s.company.reputation + (share >= 0.9 ? 1.5 : share >= 0.7 ? 0.5 : share < 0.5 ? -1 : 0)));
  s.festivalHistory.push({ year: f.year, tier: f.tier, attendance, profit, brand: s.festivalBrand });
  const crowd = `${attendance.toLocaleString()} of ${t.capacity.toLocaleString()}`;
  const verdict = share >= 0.9 ? 'A sell-out' : share >= 0.7 ? 'A good crowd' : share >= 0.5 ? 'A thin field' : 'An empty field';
  pushNews(
    s,
    `${verdict} at your festival in ${city}${stormed ? ' — and the storm didn\'t help' : ''}: ${crowd}, ${profit >= 0 ? 'profit' : 'loss'} ${formatMoney(s, Math.abs(profit))}.`,
    profit >= 0 ? 'good' : 'bad',
    { cityId: f.cityId },
  );
}
