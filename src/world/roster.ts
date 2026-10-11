/**
 * Which historical firms are in this game, and when they open, change and leave.
 *
 * - The roster: every firm that had a base in the country, except that a region's optional firms
 *   (content/marketRegions.ts) are drawn from its pool by the map seed. The draw is saved, so a
 *   content correction never adds or removes rivals in an old game.
 * - Local presence, not founding year, decides when a firm opens on the map: a foreign house
 *   appears only where and when it really had a base.
 * - Names, operating eras (business lines, tiers) and leaders follow the content year by year;
 *   ownership, absorption, pivots and closures are company events (companyEvents.ts).
 *
 * History sets the starting conditions and the opportunities; the simulation still decides who
 * thrives, who goes bust and who gets bought.
 */
import { createRng } from '@/lib/rng';
import { freeLot, pushNews, yearOf } from './core';
import { ACTOR_POOLS, marketRegion } from './content/marketRegions';
import { actorById, actorsIn, deptsOfLines, endYear, eraIn, LINE_LABELS, nameIn, presenceIn, type HistoricalActor } from './content/actors';
import { joinNames, leadersOf } from './content/people';
import { tierInfo } from './catalog';
import { applyCompanyEvents, eventKey } from './companyEvents';
import type { Rival, TycoonState, WorldMap } from './types';

const hash = (str: string) => [...str].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 23);

/** The historical firms a new game in this country draws on. */
export function selectRoster(s: Pick<TycoonState, 'country' | 'mapSeed'>): string[] {
  const all = actorsIn(s.country).map(a => a.id);
  const pools = ACTOR_POOLS.filter(p => p.country === s.country);
  const pooled = new Set(pools.flatMap(p => p.actorIds));
  const picked = pools.flatMap(p => {
    const rng = createRng((s.mapSeed ^ hash(p.region)) >>> 0);
    const n = p.min + rng.nextInt(p.max - p.min + 1);
    const order = [...p.actorIds].sort();
    // Fisher–Yates on a sorted copy: the same seed always draws the same firms.
    for (let i = order.length - 1; i > 0; i--) {
      const j = rng.nextInt(i + 1);
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order.slice(0, n);
  });
  return [...all.filter(id => !pooled.has(id)), ...picked];
}

/** This game's roster, fixed the first time it's asked for (old saves keep the firms they had). */
export function rosterOf(s: TycoonState): string[] {
  if (!s.marketRoster) {
    const had = s.rivals.map(r => r.id).filter(id => actorById(id));
    s.marketRoster = [...new Set([...selectRoster(s), ...had, ...s.goneRivals.filter(id => actorById(id))])];
    if (!s.companyEventsApplied && s.rivals.length) {
      // A save from before company events: what's already in the past has happened.
      const year = yearOf(s, s.hour);
      s.companyEventsApplied = s.rivals.flatMap(r => (actorById(r.id)?.events ?? []).filter(e => e.year < year).map(e => eventKey(r.id, e)));
    }
  }
  return s.marketRoster;
}

/** Where a firm sets up: its own town (or the nearest one in its region), on a free lot if there is one. */
function placeActor(s: TycoonState, world: WorldMap, a: HistoricalActor, city?: string): { cityId: string; lot: number } | undefined {
  const home = city ? world.cities.find(c => c.name === city) : undefined;
  if (home) return { cityId: home.id, lot: freeLot(s, world, home.id) };
  // No town given (or not on this map): the nearest town in the same region, else the emptiest big town.
  const region = city ? marketRegion(s.country, city) : undefined;
  const sameRegion = region ? world.cities.filter(c => !c.abroad && marketRegion(s.country, c.name) === region) : [];
  if (sameRegion.length) return { cityId: sameRegion[0].id, lot: freeLot(s, world, sameRegion[0].id) };
  const candidates = world.cities
    .filter(c => !c.abroad && c.size !== 'village')
    .map(c => ({ c, lot: freeLot(s, world, c.id), crowd: s.rivals.filter(r => r.hqCityId === c.id).length }))
    .sort((x, y) => Number(y.lot >= 0) - Number(x.lot >= 0) || x.crowd - y.crowd || y.c.population - x.c.population);
  const pick = candidates[0];
  return pick ? { cityId: pick.c.id, lot: pick.lot } : undefined;
}

function spawn(s: TycoonState, world: WorldMap, a: HistoricalActor, year: number) {
  const p = presenceIn(a, s.country, year)!;
  const place = placeActor(s, world, a, p.city);
  if (!place) return;
  const era = eraIn(a, year);
  const depts = deptsOfLines(era.lines);
  const r: Rival = {
    id: a.id,
    name: nameIn(a, year),
    color: a.color,
    specialty: depts[0] ?? 'audio',
    minTier: era.tiers[0],
    maxTier: era.tiers[1],
    hqCityId: place.cityId,
    // No free yard in town: it works from an office there (nothing drawn on the map).
    lot: place.lot,
    reputation: a.reputation,
    showsPlayed: 0,
    boss: joinNames(leadersOf(a.id, year)),
    era: era.from,
  };
  s.rivals.push(r);
  // Whatever happened to it before it reached the map is already history.
  (a.events ?? []).filter(e => e.year <= year).forEach(e => (s.companyEventsApplied ??= []).push(eventKey(a.id, e)));
  const town = world.cityById.get(place.cityId)?.name;
  if (s.hour > 24) pushNews(s, p.news ?? `${r.name} opens a base in ${town} and starts bidding for ${LINE_LABELS[era.lines[0]]} work.`, 'big', { cityId: place.cityId });
}

/** A new operating era: different tiers, and any new business line gets its first kit. */
function changeEra(s: TycoonState, r: Rival, a: HistoricalActor, year: number) {
  const era = eraIn(a, year);
  if (r.era === era.from) return;
  const before = r.era === undefined ? [] : deptsOfLines(a.eras.filter(e => e.from <= r.era!).pop()?.lines ?? []);
  r.era = era.from;
  r.minTier = era.tiers[0];
  r.maxTier = Math.max(r.maxTier, era.tiers[1]);
  if (!r.ops) return;
  const added = deptsOfLines(era.lines).filter(d => !before.includes(d) && !r.ops!.kit[d]);
  if (!added.length) return;
  // History leans on the firm, it doesn't hand it free kit: it pays for its new department.
  const needs = tierInfo(r.maxTier).needs;
  let cost = 0;
  added.forEach(d => {
    r.ops!.kit[d] = Math.ceil(needs[d] * 1.2);
    cost += r.ops!.kit[d] * 1500;
  });
  r.ops.cash -= cost;
  r.ops.month.costs += cost;
  if (s.hour > 24) {
    const lines = era.lines.filter(l => deptsOfLines([l]).some(d => added.includes(d))).map(l => LINE_LABELS[l]);
    pushNews(s, `${r.name} adds ${joinNames(lines)} to what it does.`, 'info', { cityId: r.hqCityId });
  }
}

/** Daily: firms open, rename, change their business and their bosses; company events land. */
export function updateRivals(s: TycoonState, world: WorldMap, year: number) {
  rosterOf(s).forEach(id => {
    if (s.goneRivals.includes(id)) return;
    const a = actorById(id);
    if (!a) return;
    const rival = s.rivals.find(r => r.id === id);
    if (!rival) {
      const end = endYear(a);
      if (presenceIn(a, s.country, year) && !(end !== undefined && end <= year)) spawn(s, world, a, year);
      return;
    }
    const name = nameIn(a, year);
    if (rival.name !== name) {
      const news = a.names.find(n => n.name === name)?.news;
      rival.name = name;
      if (s.hour > 24 && news) pushNews(s, news, 'big', { cityId: rival.hqCityId });
    }
    changeEra(s, rival, a, year);
    const boss = joinNames(leadersOf(a.id, year));
    if (boss && rival.boss !== boss) {
      if (s.hour > 24 && rival.boss !== undefined) pushNews(s, `${boss} ${boss.includes(' and ') ? 'take' : 'takes'} charge at ${rival.name}.`, 'info', { cityId: rival.hqCityId });
      rival.boss = boss;
    }
  });
  applyCompanyEvents(s, world, year);
}
