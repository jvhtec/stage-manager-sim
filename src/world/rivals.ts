/**
 * Rival firms have balance sheets too. Their financial health follows the
 * economy and how much work they win; in a bust the weak ones go under (and
 * free their warehouse lot). And like Transport Tycoon, you can buy a rival
 * outright — their base, their kit and their crew become yours.
 */
import type { Rng } from '@/lib/rng';
import { tierInfo } from './catalog';
import { book, depotInCity, formatMoney, newId, pushNews, yearOf } from './core';
import { rentalProduct } from './hire';
import { marketNow } from './market';
import { worldOf } from './mapgen';
import { ownedStock, condition } from './wear';
import { seedPeople, sideRng, syncCrew } from './people';
import { DEPTS, type Rival, type TycoonState } from './types';

const STRUGGLING = 25;
/** Reputation a buyer needs, relative to the firm being bought. */
const BUYER_REPUTATION_GAP = 15;
/** Condition of the kit that comes with an acquisition. */
const USED_KIT_CONDITION = 70;

export const rivalHealth = (r: Rival) => r.health ?? 60;

/** Monthly: rivals' fortunes rise and fall; the weakest go under. */
export function monthlyRivals(s: TycoonState, rng: Rng) {
  const { demand } = marketNow(s);
  const world = worldOf(s);
  [...s.rivals].forEach(r => {
    const won = r.showsPlayed - (r.lastShows ?? r.showsPlayed);
    r.lastShows = r.showsPlayed;
    const before = rivalHealth(r);
    // Busts hurt, work helps, and firms drift back towards steady health over time.
    const drift = (demand - 1) * 30 + (r.reputation - 50) / 20 + Math.min(6, won * 0.8) + (60 - before) * 0.05 + (rng.next() - 0.55) * 10;
    // The established names always find a bank to carry them through.
    const floor = r.reputation >= 60 ? 20 : 0;
    r.health = Math.max(floor, Math.min(100, before + drift));
    const city = world.cityById.get(r.hqCityId)?.name;
    if (r.health <= 0) {
      s.rivals = s.rivals.filter(x => x.id !== r.id);
      s.vehicles = s.vehicles.filter(v => v.owner !== r.id);
      s.goneRivals.push(r.id);
      pushNews(s, `${r.name} goes into administration — their ${city} lot is up for grabs.`, 'big', { cityId: r.hqCityId });
    } else if (r.health < STRUGGLING && before >= STRUGGLING) {
      pushNews(s, `Word is ${r.name} is struggling. A buyer could pick them up cheap (see the League).`, 'info', { cityId: r.hqCityId });
    }
  });
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

  let base = depotInCity(s, r.hqCityId);
  if (!base) {
    base = {
      id: newId(s, 'depot'),
      kind: 'warehouse',
      size: r.maxTier >= 4 ? 2 : 1,
      staff: { warehouse: 2, office: 1 },
      cityId: r.hqCityId,
      lot: r.lot,
      gear: {},
      crew: 0,
      builtHour: s.hour,
    };
    s.depots.push(base);
  }
  // Their racks: a show's worth of era-standard kit at their top tier, used.
  const year = yearOf(s, s.hour);
  const needs = tierInfo(r.maxTier).needs;
  DEPTS.forEach(d => {
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
