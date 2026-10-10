/**
 * The road network through the years. A world map is generated once per seed and
 * country; for each year the game derives an *era* view of it: which motorways
 * have opened (quicker, and tolled in Spain, France and Italy — and for lorries in
 * Germany from 2005), whether the Channel Tunnel is running yet, and how long the
 * borders take — customs for every crossing until the EU single market in 1993,
 * passport queues until Schengen, the GDR's transit checks until 1990, Brexit from
 * 2021, and America's northern and southern borders always.
 *
 * Everything time-related flows from the route cost (pathfinding.stepCost), so
 * planners, ETAs, fuel and ranges all see the same roads. Money that doesn't
 * depend on time — tolls, ferry fares, customs agents — is charged when a truck
 * sets off (tripCharges).
 */
import type { Era, TycoonState, WorldMap } from './types';
import { pushNews } from './core';
import type { VehicleModel } from './catalog';
import {
  CROSS_BRIDGE,
  CROSS_FERRY,
  CROSS_TUNNEL,
  crossKindAt,
  getCityPath,
  routeBorders,
  unitsPerTile,
} from './pathfinding';

// ---------------------------------------------------------------------------
// Borders
// ---------------------------------------------------------------------------

/** EU (EEC) membership: year joined, and (for the UK) year it left. */
const EU: Record<string, [number, number?]> = {
  FR: [1958], DE: [1958], IT: [1958], BE: [1958], NL: [1958], LU: [1958],
  GB: [1973, 2021], IE: [1973], ES: [1986], PT: [1986], AT: [1995],
  CZ: [2004], SI: [2004], HR: [2013],
};
/** Schengen: no passport checks between members from this year. */
const SCHENGEN: Record<string, number> = {
  FR: 1995, DE: 1995, ES: 1995, PT: 1995, BE: 1995, NL: 1995, LU: 1995,
  IT: 1997, AT: 1997, CZ: 2007, SI: 2007, CH: 2008, HR: 2023,
};
const inEU = (c: string, year: number) => {
  const m = EU[c];
  return !!m && year >= m[0] && (m[1] === undefined || year < m[1]);
};
/** The customs single market: no customs inside it from 1993. */
const SINGLE_MARKET = 1993;
const CUSTOMS_HOURS = 2;
/** Agent's fee and the ATA carnet for a truckload of show kit at a customs border. */
export const CUSTOMS_FEE = 150;
const PASSPORT_HOURS = 0.5;

/** Hours lost (and fee paid) crossing between `home` and a neighbouring country in `year`. */
export function borderRegime(home: string, other: string, year: number): { hours: number; fee: number } {
  // North America: always customs; heavier after 2001.
  if (home === 'US' || other === 'US') {
    const hours = other === 'MX' || home === 'MX' ? 3 : year >= 2002 ? 2.5 : 1.5;
    return { hours, fee: CUSTOMS_FEE };
  }
  const customs = !(inEU(home, year) && inEU(other, year) && year >= SINGLE_MARKET);
  // The British Isles share a Common Travel Area: no passport queue between them.
  const travelArea = (home === 'GB' && other === 'IE') || (home === 'IE' && other === 'GB');
  const passport = !travelArea && !(SCHENGEN[home] && SCHENGEN[other] && year >= Math.max(SCHENGEN[home], SCHENGEN[other]));
  return { hours: (customs ? CUSTOMS_HOURS : 0) + (passport ? PASSPORT_HOURS : 0), fee: customs ? CUSTOMS_FEE : 0 };
}

// ---------------------------------------------------------------------------
// Drivers' hours
// ---------------------------------------------------------------------------

/**
 * How the rules on drivers' hours bite on a solo driver, by era. Speeds in the game already
 * average in a driver's rests; what changes is how strictly they're kept: loosely before the EU
 * rules of 1986, by the book after, and to the minute once digital tachographs came in (2006/07).
 * In America, hours-of-service tightened in 2004 and 2013 and electronic logs became law in 2017.
 */
export function driversRules(country: string, year: number): { pace: number; label: string } {
  if (country === 'US') {
    if (year < 2004) return { pace: 1.05, label: 'Hours of service: 10 hours at the wheel, paper logbooks' };
    if (year < 2013) return { pace: 1, label: 'Hours of service: 11 hours at the wheel, 10 off' };
    if (year < 2017) return { pace: 0.96, label: 'Hours of service with a mandatory 30-minute break' };
    return { pace: 0.92, label: 'Electronic logging devices: every hour recorded' };
  }
  if (year < 1986) return { pace: 1.08, label: 'Analogue tachographs, loosely policed' };
  if (year < 2007) return { pace: 1, label: 'EU drivers’ hours: 9 hours a day, 11 off' };
  return { pace: 0.9, label: 'Digital tachographs: every minute counted' };
}

/** The GDR's transit checks on the way into the East and Berlin. */
const ZONE_HOURS = 3;

// ---------------------------------------------------------------------------
// Eras
// ---------------------------------------------------------------------------

/** Countries where motorists pay tolls on (some) motorways, and where only lorries do from a year. */
const TOLLS: Record<string, { from: number; lorriesOnly?: boolean }> = {
  ES: { from: 0 },
  FR: { from: 0 },
  IT: { from: 0 },
  DE: { from: 2005, lorriesOnly: true },
};

const homeOf = (world: WorldMap) => world.country;

/** Snow lies on the high roads from December to March. */
export const isWinter = (date: Date) => [11, 0, 1, 2].includes(date.getUTCMonth());
/** Chains, winter tyres and a slower day: per truck crossing a snowy pass. */
export const CHAINS_FEE = 40;

/** The world as its roads were in `year` (and in winter, if it is). Cached per distinct era. */
export function eraWorld(base: WorldMap, year: number, winter = false): WorldMap {
  const home = base.country;
  const open = base.corridors.map(c => year >= c.opens);
  const links = base.crossings.map(c => (c.link && year >= c.link.opens ? 1 : 0));
  const border = base.borderCountries.map(c => borderRegime(home, c, year));
  const zone = base.zones.map(z => (year < z.until ? ZONE_HOURS : 0));
  const tollYear = TOLLS[home] && year >= TOLLS[home].from ? 1 : 0;
  const snow = winter;
  const rules = driversRules(home, year);
  const key = `${open.map(Number).join('')}|${links.join('')}|${border.map(b => `${b.hours}:${b.fee}`).join(',')}|${zone.join(',')}|${tollYear}|${snow ? 'w' : ''}|${rules.pace}`;
  base.eras ??= new Map();
  const cached = base.eras.get(key);
  if (cached) return cached;
  const era: Era = { year, key, border, zone, winter: snow, soloPace: rules.pace, driversRules: rules.label };
  const motorway = new Uint8Array(base.width * base.height);
  base.corridors.forEach((c, i) => {
    if (open[i]) c.tiles.forEach(k => (motorway[k] = c.toll && tollYear ? 2 : 1));
  });
  const crossKind = new Uint8Array(base.width * base.height);
  base.crossings.forEach((c, i) => {
    const kind = links[i] ? (c.link!.kind === 'tunnel' ? CROSS_TUNNEL : CROSS_BRIDGE) : c.base === 'ferry' ? CROSS_FERRY : CROSS_BRIDGE;
    c.tiles.forEach(k => (crossKind[k] = kind));
  });
  const world: WorldMap = {
    ...base,
    era,
    motorway,
    crossKind,
    pathCache: new Map(),
    distCache: new Map(),
    eras: undefined,
  };
  base.eras.set(key, world);
  return world;
}

// ---------------------------------------------------------------------------
// What a trip costs and passes through
// ---------------------------------------------------------------------------

/** Per-km toll by vehicle kind (in the game's money of the day). */
const TOLL_PER_KM: Record<VehicleModel['kind'], number> = { van: 0.06, truck: 0.12, bus: 0.12, semi: 0.18 };
const FERRY_FARE: Record<VehicleModel['kind'], number> = { van: 120, truck: 300, bus: 300, semi: 450 };
const FERRY_FARE_PER_KM = 2;
const TUNNEL_FARE: Record<VehicleModel['kind'], number> = { van: 150, truck: 350, bus: 350, semi: 500 };

export interface RouteNotes {
  /** Names (or "ferry") of the sea crossings on the way. */
  ferries: string[];
  tunnels: string[];
  /** Borders crossed (country codes, or a historic zone's name). */
  borders: string[];
  motorwayKm: number;
  tollKm: number;
  /** Snowbound high road on the way (winter only). */
  snowKm: number;
}

const notesCache = new WeakMap<WorldMap, Map<string, RouteNotes>>();

/** What lies on the road between two towns in this world's era. */
export function routeNotes(world: WorldMap, from: string, to: string): RouteNotes {
  let byKey = notesCache.get(world);
  if (!byKey) {
    byKey = new Map();
    notesCache.set(world, byKey);
  }
  const key = `${from}|${to}`;
  const hit = byKey.get(key);
  if (hit) return hit;
  const notes: RouteNotes = { ferries: [], tunnels: [], borders: [], motorwayKm: 0, tollKm: 0, snowKm: 0 };
  const path = getCityPath(world, from, to);
  const km = unitsPerTile(world) * 18;
  const tolled = TOLLS[homeOf(world)];
  const lorriesOnly = !!tolled?.lorriesOnly && (world.era?.year ?? 0) >= tolled.from;
  for (let i = 0; i < path.length; i++) {
    const k = path[i];
    const mw = world.motorway?.[k] ?? 0;
    if (mw) notes.motorwayKm += km;
    if (mw === 2 || (mw && lorriesOnly)) notes.tollKm += km;
    if (world.era?.winter && world.snowy[k]) notes.snowKm += km;
    if (i === 0) continue;
    const p = path[i - 1];
    const wa = world.crossingAt[p] >= 0;
    const wb = world.crossingAt[k] >= 0;
    if (wb && !wa) {
      const cr = world.crossings[world.crossingAt[k]];
      const kind = crossKindAt(world, k);
      if (kind === CROSS_FERRY) notes.ferries.push(cr.name && cr.name !== cr.link?.name ? cr.name : `${Math.max(1, Math.round(cr.km / 5) * 5)} km ferry`);
      else if (kind === CROSS_TUNNEL) notes.tunnels.push(cr.link?.name ?? 'tunnel');
    }
  }
  notes.borders = routeBorders(world, from, to).map(b => b.label);
  byKey.set(key, notes);
  return notes;
}

/** Tolls, ferry or tunnel fares and customs fees for one vehicle driving from one town to another. */
export function tripCharges(world: WorldMap, from: string, to: string, kind: VehicleModel['kind']): { tolls: number; crossings: number; customs: number; total: number } {
  if (from === to) return { tolls: 0, crossings: 0, customs: 0, total: 0 };
  const notes = routeNotes(world, from, to);
  const path = getCityPath(world, from, to);
  let crossings = 0;
  for (let i = 1; i < path.length; i++) {
    const k = path[i];
    if (world.crossingAt[k] < 0 || world.crossingAt[path[i - 1]] >= 0) continue;
    const cr = world.crossings[world.crossingAt[k]];
    const c = crossKindAt(world, k);
    if (c === CROSS_FERRY) crossings += FERRY_FARE[kind] + cr.km * FERRY_FARE_PER_KM;
    else if (c === CROSS_TUNNEL) crossings += TUNNEL_FARE[kind];
  }
  const tolls = notes.tollKm * TOLL_PER_KM[kind] * (TOLLS[homeOf(world)]?.lorriesOnly && kind === 'van' ? 0 : 1);
  const customs = routeBorders(world, from, to).reduce((sum, b) => sum + b.fee, 0);
  const chains = notes.snowKm > 0 ? CHAINS_FEE : 0;
  const total = Math.round(tolls + crossings + customs + chains);
  return { tolls: Math.round(tolls), crossings: Math.round(crossings + chains), customs, total };
}

/** Tell the player when the passes close up and when they clear. */
export function monthlyWinter(s: TycoonState, world: WorldMap) {
  if (!world.snowy.some(Boolean)) return;
  const month = new Date(Date.UTC(s.startYear, 0, 1) + Math.floor(s.hour / 24) * 86400000).getUTCMonth();
  if (month === 11) pushNews(s, 'Winter on the high roads: snow slows the mountain passes until spring, and trucks crossing them need chains.', 'info');
  if (month === 3) pushNews(s, 'The passes are clear again: mountain roads are back to normal.', 'info');
}

/** January: say so when the drivers' hours rules change. */
export function yearlyDriversRules(s: TycoonState, year: number) {
  const now = driversRules(s.country ?? 'GB', year);
  const before = driversRules(s.country ?? 'GB', year - 1);
  if (now.label === before.label) return;
  const change = now.pace < before.pace ? 'Solo drivers will average less; team drivers are unaffected.' : 'Solo drivers can cover more ground.';
  pushNews(s, `New drivers' hours rules: ${now.label}. ${change}`, 'info');
}
