/**
 * Festival season. Each real festival (content/festivals.ts) opens a tender
 * for its main and second stage two months out. Book a stage before the
 * tender closes and it's yours; at the close, a rival in the right league
 * takes whatever's left. Stages run for the festival's whole length, so the
 * rig is tied up for days — and it pays like it.
 */
import type { Rng } from '@/lib/rng';
import { tierInfo } from './catalog';
import { dateOfDay, dayOf, formatDay, newId, pushNews } from './core';
import { venueOpenIn } from './content/venueYears';
import { festivalSize, festivalsFor, type Festival } from './content/festivals';
import { marketOnDay } from './market';
import { buildGig } from './offers';
import type { City, Gig, TycoonState, Vehicle, WorldMap } from './types';

/** Tender opens this many days before the festival… */
export const TENDER_OPENS_DAYS = 60;
/** …and closes this many days before. */
export const TENDER_CLOSES_DAYS = 21;
/** Festival rigs are bigger than a normal show at the same tier. */
const MAIN_STAGE_SCALE = 1.3;
/** Per-day fee relative to a single show of that tier. */
const DAY_RATE = 0.85;

export function festivalStartDay(state: Pick<TycoonState, 'startYear'>, f: Festival, year: number): number {
  return Math.round((Date.UTC(year, f.month - 1, f.day) - Date.UTC(state.startYear, 0, 1)) / 86400000);
}

export function festivalHost(world: WorldMap, f: Pick<Festival, 'near'>): City {
  for (const name of f.near) {
    const city = world.cities.find(c => c.name === name);
    if (city) return city;
  }
  // Not on this map: the biggest town that isn't the capital-sized one.
  return [...world.cities].sort((a, b) => b.population - a.population)[Math.min(1, world.cities.length - 1)];
}

const postedKey = (f: Festival, year: number) => `${f.id}-${year}`;

export interface FestivalDate {
  festival: Festival;
  year: number;
  startDay: number;
  /** Main-stage tier this year. */
  size: number;
  host: City;
  gigs: Gig[];
}

/** This year's festivals (and next year's early ones), for the Market window. */
export function festivalCalendar(state: TycoonState, world: WorldMap): FestivalDate[] {
  const today = dayOf(state.hour);
  const year = dateOfDay(state, today).getUTCFullYear();
  const out: FestivalDate[] = [];
  [year, year + 1].forEach(y => {
    festivalsFor(state.country).forEach(f => {
      const size = festivalSize(f, y);
      const startDay = festivalStartDay(state, f, y);
      if (!size || startDay + f.days < today || startDay > today + 300) return;
      out.push({ festival: f, year: y, startDay, size, host: festivalHost(world, f), gigs: state.gigs.filter(g => g.festival?.id === f.id && g.festival.year === y) });
    });
  });
  return out.sort((a, b) => a.startDay - b.startDay);
}

function postTender(s: TycoonState, world: WorldMap, rng: Rng, f: Festival, year: number, size: number, startDay: number) {
  const host = festivalHost(world, f);
  const venues = host.venues.filter(v => v.kind !== 'airport' && venueOpenIn(v.name, year)).sort((a, b) => b.tier - a.tier);
  const site = venues[0];
  if (!site) return;
  const acceptByDay = startDay - TENDER_CLOSES_DAYS;
  const stages: [string, number, boolean][] = [
    [f.stages[0], size, true],
    [f.stages[1], Math.max(1, size - 1), false],
  ];
  stages.forEach(([stage, tier, main]) => {
    const gig = buildGig(s, rng, {
      venue: site,
      day: startDay,
      act: f.name,
      real: false,
      tier,
      days: f.days,
      needsScale: main ? MAIN_STAGE_SCALE : 1,
      feeMultiplier: f.days * DAY_RATE * (main ? MAIN_STAGE_SCALE : 1),
      festival: { id: f.id, year, stage, main },
    });
    gig.acceptByDay = acceptByDay;
    s.gigs.push(gig);
  });
  pushNews(
    s,
    `${f.name} ${year} (${formatDay(s, startDay)}, ${host.name}) is taking bids for the ${f.stages[0]} (${tierInfo(size).label}) and the ${f.stages[1]}. Tender closes ${formatDay(s, acceptByDay)}.`,
    'big',
    { cityId: host.id },
  );
}

function awardToRival(s: TycoonState, gig: Gig) {
  const contenders = s.rivals.filter(r => gig.tier >= r.minTier && gig.tier <= r.maxTier).sort((a, b) => b.reputation - a.reputation);
  const rival = contenders[0];
  if (!rival) {
    gig.status = 'expired';
    return;
  }
  gig.status = 'rival';
  gig.rivalId = rival.id;
  const truck: Vehicle = {
    id: newId(s, 'rv'),
    owner: rival.id,
    modelId: gig.tier >= 4 ? 'artic-40' : gig.tier === 3 ? 'rigid-7t' : 'luton-box',
    name: `${rival.name} truck`,
    homeCityId: rival.hqCityId,
    boughtHour: s.hour,
    reliability: 90,
    lastServiceHour: s.hour,
    status: 'parked',
    cityId: rival.hqCityId,
    orders: [gig.id],
    cargo: {},
    crew: 0,
    profitThisYear: 0,
    profitLastYear: 0,
  };
  s.vehicles.push(truck);
  pushNews(s, `${rival.name} wins the ${gig.festival!.stage} at ${gig.act}.`, 'info', { cityId: gig.cityId, gigId: gig.id });
}

/** Daily: open tenders, close them, and hand unclaimed stages to rivals. */
export function dailyFestivals(s: TycoonState, world: WorldMap, rng: Rng) {
  const today = dayOf(s.hour);
  const year = dateOfDay(s, today).getUTCFullYear();
  [year, year + 1].forEach(y => {
    festivalsFor(s.country).forEach(f => {
      const size = festivalSize(f, y);
      const startDay = festivalStartDay(s, f, y);
      const key = postedKey(f, y);
      if (!size || s.festivalsPosted.includes(key)) return;
      if (today < startDay - TENDER_OPENS_DAYS || today > startDay - TENDER_CLOSES_DAYS - 3) return;
      s.festivalsPosted.push(key);
      if (marketOnDay(s, startDay).shutdown) {
        pushNews(s, `${f.name} ${y} is cancelled.`, 'bad');
        return;
      }
      postTender(s, world, rng, f, y, size, startDay);
    });
  });
  s.gigs.forEach(g => {
    if (g.festival && g.status === 'offer' && g.acceptByDay < today) awardToRival(s, g);
  });
  s.festivalsPosted = s.festivalsPosted.filter(k => Number(k.slice(k.lastIndexOf('-') + 1)) >= year - 1);
}
