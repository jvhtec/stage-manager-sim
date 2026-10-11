/**
 * Rival firms have balance sheets too. Their financial health follows the
 * economy and how much work they win; in a bust the weak ones go under (and
 * free their warehouse lot). And like Transport Tycoon, you can buy a rival
 * outright — their base, their kit and their crew become yours.
 */
import type { Rng } from '@/lib/rng';
import { tierInfo } from './catalog';
import { book, depotInCity, formatMoney, freeLot, newId, pushNews, yearOf } from './core';
import { openAuction } from './auctions';
import { monthlyRivalOps, opsOf } from './rivalOps';
import { unlock } from './milestones';
import { rentalProduct } from './hire';
import { marketNow } from './market';
import { worldOf } from './mapgen';
import { pickWeighted, styleOf } from './strategies';
import { deptsOf } from './supply';
import { ownedStock, condition } from './wear';
import { seedPeople, sideRng, syncCrew } from './people';
import { DEPTS, type Rival, type TycoonState } from './types';

const STRUGGLING = 25;
/** Reputation a buyer needs, relative to the firm being bought. */
const BUYER_REPUTATION_GAP = 15;
/** Condition of the kit that comes with an acquisition. */
const USED_KIT_CONDITION = 70;

export const rivalHealth = (r: Rival) => r.health ?? 60;

/**
 * A firm is gone: its shows still to play don't vanish with it. A buyer takes them over; otherwise
 * they go back on the market if there's still time to book them, and lapse if not.
 */
export function releaseRivalWork(s: TycoonState, rivalId: string, toId?: string) {
  const today = Math.floor(s.hour / 24);
  s.gigs.forEach(g => {
    if (g.rivalId !== rivalId || g.status !== 'rival' || g.result) return;
    if (toId) {
      g.rivalId = toId;
      return;
    }
    g.rivalId = undefined;
    g.status = !g.tourId && !g.festival && !g.event && g.acceptByDay >= today ? 'offer' : 'expired';
  });
  s.tours.forEach(t => {
    if (t.rivalId !== rivalId || t.status !== 'rival') return;
    if (toId) t.rivalId = toId;
    else t.status = 'expired';
  });
}

/**
 * One firm folds into another and nothing is lost: its kit, crew, trucks, cash and money owed join
 * the buyer's operation, its booked shows become the buyer's, and its patch (recent shows by town)
 * counts as the buyer's. Used for historical acquisitions and for mergers the simulation produces.
 */
export function absorbInto(s: TycoonState, target: Rival, buyer: Rival) {
  const from = opsOf(s, target);
  const to = opsOf(s, buyer);
  DEPTS.forEach(d => (to.kit[d] += from.kit[d]));
  to.crew += from.crew;
  to.trucks += from.trucks;
  to.cash += from.cash;
  to.inputs = Math.max(to.inputs, from.inputs);
  to.pa = [...new Set([...to.pa, ...from.pa])].slice(-3);
  if (!to.desk) to.desk = from.desk;
  if (from.owed?.length) to.owed = [...(to.owed ?? []), ...from.owed];
  releaseRivalWork(s, target.id, buyer.id);
  Object.values(s.townShows ?? {}).forEach(town => {
    if (!town[target.id]) return;
    town[buyer.id] = (town[buyer.id] ?? 0) + town[target.id];
    delete town[target.id];
  });
  s.gigs.forEach(g => g.supply?.forEach(x => x.from === target.id && (x.from = buyer.id)));
  s.rivals = s.rivals.filter(r => r.id !== target.id);
  s.vehicles = s.vehicles.filter(v => v.owner !== target.id);
  s.goneRivals.push(target.id);
  buyer.reputation = Math.min(RIVAL_REPUTATION_CAP, buyer.reputation + 2 + target.reputation * 0.05);
  buyer.maxTier = Math.max(buyer.maxTier, target.maxTier);
  buyer.minTier = Math.min(buyer.minTier, target.minTier);
}

/** Monthly: rivals' fortunes rise and fall; the weakest go under. */
export function monthlyRivals(s: TycoonState, rng: Rng) {
  const { demand } = marketNow(s);
  const world = worldOf(s);
  [...s.rivals].forEach(r => {
    // Work won: shows it ran, and shows it supplied for another firm (a lighting or staging house
    // lives mostly on the latter, supply.ts).
    const partnered = r.ops?.record.partnered ?? 0;
    const won = r.showsPlayed - (r.lastShows ?? r.showsPlayed) + (partnered - (r.lastPartnered ?? partnered));
    r.lastShows = r.showsPlayed;
    r.lastPartnered = partnered;
    const before = rivalHealth(r);
    // Its books (rivalOps.ts): a profitable month helps, a loss and an overdraft hurt.
    const margin = monthlyRivalOps(s, r, rng);
    const books = Math.max(-8, Math.min(6, margin * 3)) - (opsOf(s, r).cash < 0 ? 6 : 0);
    // Busts hurt, work helps, and firms drift back towards steady health over time.
    const drift = (demand - 1) * 30 + (r.reputation - 50) / 20 + Math.min(4, won * 0.5) + books + (60 - before) * 0.05 + (rng.next() - 0.55) * 10;
    // The established names always find a bank to carry them through.
    const floor = r.reputation >= 60 ? 20 : 0;
    r.health = Math.max(floor, Math.min(100, before + drift));
    const city = world.cityById.get(r.hqCityId)?.name;
    if (r.health <= 0) {
      s.rivals = s.rivals.filter(x => x.id !== r.id);
      s.vehicles = s.vehicles.filter(v => v.owner !== r.id);
      releaseRivalWork(s, r.id);
      s.goneRivals.push(r.id);
      pushNews(s, `${r.name} goes into administration — their ${city} lot is up for grabs.`, 'big', { cityId: r.hqCityId });
      openAuction(s, rng, r.name, r.hqCityId, r.maxTier, 'bust');
    } else if (r.health < STRUGGLING && before >= STRUGGLING) {
      pushNews(s, `Word is ${r.name} is struggling. A buyer could pick them up cheap (see the League).`, 'info', { cityId: r.hqCityId });
    }
  });
  growRivals(s, rng);
  rivalMergers(s, rng);
  rivalStartups(s, rng);
}

const TIER_NAMES = ['', 'club', 'theatre', 'arena', 'stadium'];
/** The most any firm's standing climbs to. */
const RIVAL_REPUTATION_CAP = 92;
/** A merger needs a healthy buyer and a weak target. */
const MERGER_BUYER_HEALTH = 65;
const MERGER_CHANCE = 0.12;
const STARTUP_CHANCE = 0.05;
const MAX_RIVALS = 14;
const STARTUP_WORDS = ['Backline', 'Stagecraft', 'Lumen', 'Redline', 'Northern', 'Harbour', 'Apex', 'Fieldhouse', 'Skyline', 'Ironwood', 'Beacon', 'Foxglove'];
const STARTUP_SUFFIX = ['Productions', 'Sound & Light', 'Live', 'Event Services', 'Stage Hire', 'Staging'];
const STARTUP_COLORS = ['#475569', '#78716c', '#6b7280', '#57534e', '#64748b'];

/** Monthly: well-run firms build their name (and move up a tier); struggling ones lose theirs. */
function growRivals(s: TycoonState, rng: Rng) {
  const year = yearOf(s, s.hour);
  s.rivals.forEach(r => {
    const h = rivalHealth(r);
    // (Winning shows already lifts a rival's name; this is the slow drift from how well it's run.)
    const drift = h >= 60 ? 0.1 : h < 35 ? -0.25 : 0;
    r.reputation = Math.max(5, drift > 0 ? Math.min(Math.max(r.reputation, RIVAL_REPUTATION_CAP), r.reputation + drift) : r.reputation + drift);
    if (r.maxTier < 4 && r.reputation >= tierInfo(r.maxTier + 1).minReputation + 5 && rng.chance(0.4 * styleOf(r, year).growth)) {
      r.maxTier += 1;
      pushNews(s, `${r.name} has outgrown its old rooms — now chasing ${TIER_NAMES[r.maxTier]}-size work.`, 'info', { cityId: r.hqCityId });
    }
  });
}

/** Monthly: a healthy firm swallows a struggling one — fewer, bigger rivals. */
function rivalMergers(s: TycoonState, rng: Rng) {
  const buyers = s.rivals.filter(r => rivalHealth(r) >= MERGER_BUYER_HEALTH);
  const targets = s.rivals.filter(r => rivalHealth(r) < STRUGGLING);
  if (!buyers.length || !targets.length || !rng.chance(MERGER_CHANCE)) return;
  const target = rng.pick(targets);
  // The dealmakers are first in line.
  const year = yearOf(s, s.hour);
  const buyer = pickWeighted(rng, buyers.filter(b => b.id !== target.id), b => styleOf(b, year).buyer);
  if (!buyer) return;
  const city = worldOf(s).cityById.get(target.hqCityId)?.name;
  // The kit, crew, clients and booked shows carry over; only the yard in town is let go.
  absorbInto(s, target, buyer);
  buyer.health = Math.min(100, rivalHealth(buyer) + 5);
  pushNews(s, `${buyer.name} absorbs struggling ${target.name}, its crews, kit and bookings. The ${city} yard closes — the lot is up for grabs.`, 'big', { cityId: target.hqCityId });
}

/** Monthly, in a decent market: a new firm opens its doors in a town with room. */
function rivalStartups(s: TycoonState, rng: Rng) {
  const { demand: seasonal, season, shutdown } = marketNow(s);
  const demand = seasonal / season; // the era's trend, not the time of year
  if (shutdown || demand < 1 || s.rivals.length >= MAX_RIVALS || !rng.chance(STARTUP_CHANCE * demand)) return;
  const world = worldOf(s);
  const towns = world.cities.filter(c => c.size !== 'village' && c.id !== s.company.hqCityId && freeLot(s, world, c.id) >= 0);
  if (!towns.length) return;
  const town = rng.pick(towns);
  const taken = new Set(s.rivals.map(r => r.name));
  let name = '';
  for (let i = 0; i < 12 && (!name || taken.has(name)); i++) name = `${rng.pick(STARTUP_WORDS)} ${rng.pick(STARTUP_SUFFIX)}`;
  if (taken.has(name)) return;
  s.rivals.push({
    id: newId(s, 'rival'),
    name,
    color: rng.pick(STARTUP_COLORS),
    // One line of business to start with, like the real ones (supply.ts).
    specialty: rng.pick(['audio', 'audio', 'lighting', 'video', 'stage'] as const),
    minTier: 1,
    maxTier: 2,
    hqCityId: town.id,
    lot: freeLot(s, world, town.id),
    reputation: 12 + Math.floor(rng.next() * 12),
    showsPlayed: 0,
    health: 55,
  });
  pushNews(s, `New firm ${name} opens in ${town.name} and starts bidding for small shows.`, 'info', { cityId: town.id });
}

/** What a rival would sell for: their standing, their size, and how desperate they are. */
export function takeoverPrice(r: Rival): number {
  const value = 40000 + r.reputation * 3000 + r.maxTier * 25000;
  return Math.round((value * (0.4 + (rivalHealth(r) / 100) * 0.8)) / 1000) * 1000;
}

export function takeoverBlocker(state: TycoonState, r: Rival): string | null {
  if (state.company.reputation < r.reputation - BUYER_REPUTATION_GAP)
    return `${r.name}'s owners won't sell to a firm with less than ${Math.ceil(r.reputation - BUYER_REPUTATION_GAP)} reputation.`;
  const price = takeoverPrice(r);
  if (state.company.cash < price) return `Buying ${r.name} costs ${formatMoney(state, price)}.`;
  return null;
}

/** Absorb a rival: base, kit, crew and a share of their standing. Mutates. */
export function absorbRival(s: TycoonState, r: Rival) {
  const price = takeoverPrice(r);
  book(s, 'purchases', -price);
  s.rivals = s.rivals.filter(x => x.id !== r.id);
  s.vehicles = s.vehicles.filter(v => v.owner !== r.id);
  s.goneRivals.push(r.id);
  unlock(s, 'takeover');
  s.stats.rivalsBought = (s.stats.rivalsBought ?? 0) + 1;

  let base = depotInCity(s, r.hqCityId);
  // A firm without a yard of its own on the map: its yard if there's a lot free, else its kit goes to your head office.
  const lot = r.lot >= 0 ? r.lot : freeLot(s, worldOf(s), r.hqCityId);
  if (!base && lot < 0) base = s.depots[0];
  if (!base) {
    base = {
      id: newId(s, 'depot'),
      kind: 'warehouse',
      size: r.maxTier >= 4 ? 2 : 1,
      staff: { warehouse: 2, office: 1 },
      cityId: r.hqCityId,
      lot,
      gear: {},
      crew: 0,
      builtHour: s.hour,
    };
    s.depots.push(base);
  }
  // Their racks: a show's worth of era-standard kit at their top tier, used — in the departments they ran.
  const year = yearOf(s, s.hour);
  const needs = tierInfo(r.maxTier).needs;
  const ran = deptsOf(r, year);
  DEPTS.forEach(d => {
    if (!ran.includes(d)) return;
    const id = rentalProduct(d, r.maxTier, year);
    const n = needs[d];
    if (!id || !n) return;
    const before = ownedStock(s)[id] ?? 0;
    base!.gear[id] = (base!.gear[id] ?? 0) + n;
    s.gearCondition[id] = before ? (condition(s, id) * before + USED_KIT_CONDITION * n) / (before + n) : USED_KIT_CONDITION;
  });
  // Their crew come with the company: seasoned people, mostly.
  seedPeople(s, sideRng(s, s.hour), base.id, 3 * r.maxTier, r.maxTier >= 3 ? 3 : 2);
  syncCrew(s);
  s.company.reputation = Math.min(100, s.company.reputation + r.reputation * 0.06);
  s.cityRatings[r.hqCityId] = Math.min(100, (s.cityRatings[r.hqCityId] ?? 50) + 10);
  const city = worldOf(s).cityById.get(r.hqCityId)?.name;
  pushNews(s, `${s.company.name} buys ${r.name} for ${formatMoney(s, price)}: their ${city} base, kit and crew join the company.`, 'big', { cityId: r.hqCityId });
  return price;
}
