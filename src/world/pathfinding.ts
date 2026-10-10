/**
 * Vehicles only drive on road tiles. Paths are always city-centre to
 * city-centre (venues and depots hang off a town's streets), so there are
 * only O(cities²) distinct routes — each is computed once and cached on the
 * WorldMap (one WorldMap per era: see infra.eraWorld).
 *
 * Routes cost game distance units, not tiles: a tile is worth its real
 * kilometres, a motorway is quicker, and boarding a ferry, the tunnel shuttle
 * or queueing at a border adds the hours lost, converted at a lorry's pace.
 */
import { MinHeap } from './heap';
import type { WorldMap } from './types';

/**
 * Game distance is real distance: one unit is this many kilometres, and vehicle speeds,
 * fuel, ranges and trip times are all measured in units. A 300 km run takes the same
 * time in Britain as in the States; only the map's tile size differs.
 */
export const KM_PER_UNIT = 18;
export const unitsPerTile = (map: Pick<WorldMap, 'kmPerTile'>) => map.kmPerTile / KM_PER_UNIT;
export const unitsToKm = (units: number) => Math.round(units * KM_PER_UNIT);

/** A motorway tile costs this share of an ordinary road's time. */
export const MOTORWAY_FACTOR = 0.65;
/** Waiting time converts to distance at a typical lorry's pace (units per hour). */
export const HOURS_TO_UNITS = 1.5;
/** Hours lost boarding a ferry / the tunnel shuttle. */
export const FERRY_BOARDING_HOURS = 2;
export const TUNNEL_BOARDING_HOURS = 1;

/** A snowy tile takes this much longer to drive (winter, high roads). */
export const SNOW_FACTOR = 1.7;

export const CROSS_BRIDGE = 1;
export const CROSS_FERRY = 2;
export const CROSS_TUNNEL = 3;

const isWaterRoad = (map: WorldMap, i: number) => map.crossingAt[i] >= 0;

/** Kind of crossing (bridge/ferry/tunnel) at a water tile in this world's era. */
export function crossKindAt(map: WorldMap, i: number): number {
  if (map.crossKind) return map.crossKind[i];
  const c = map.crossings[map.crossingAt[i]];
  return c ? (c.base === 'ferry' ? CROSS_FERRY : CROSS_BRIDGE) : 0;
}

/** Cost in units of stepping from road tile `a` to the neighbouring road tile `b`. */
export function stepCost(map: WorldMap, a: number, b: number): number {
  const upt = unitsPerTile(map);
  const mw = map.motorway;
  const snow = map.era?.winter ? map.snowy : undefined;
  const slow = map.slow;
  const fa = (mw?.[a] ? MOTORWAY_FACTOR : 1) * (snow?.[a] ? SNOW_FACTOR : 1) * (slow ? slow[a] : 1);
  const fb = (mw?.[b] ? MOTORWAY_FACTOR : 1) * (snow?.[b] ? SNOW_FACTOR : 1) * (slow ? slow[b] : 1);
  let c = (upt * (fa + fb)) / 2;
  const wa = isWaterRoad(map, a);
  const wb = isWaterRoad(map, b);
  const era = map.era;
  if (wa !== wb) {
    // Getting on (or off) a crossing: count it once, on the way on — and the border, if it lands abroad.
    const w = wb ? b : a;
    const kind = crossKindAt(map, w);
    if (wb) {
      if (kind === CROSS_FERRY) c += FERRY_BOARDING_HOURS * HOURS_TO_UNITS;
      else if (kind === CROSS_TUNNEL) c += TUNNEL_BOARDING_HOURS * HOURS_TO_UNITS;
    }
  }
  return c;
}

export interface BorderStop {
  /** Country code, or a historic zone's name. */
  label: string;
  hours: number;
  fee: number;
}

/**
 * Borders on a trip between two towns in this world's era: the country of a town abroad at
 * either end, and an old internal border (the GDR) between the ends. A road that merely
 * skirts a neighbour's land on the way between two home towns doesn't count.
 */
export function routeBorders(map: WorldMap, fromCityId: string, toCityId: string): BorderStop[] {
  const era = map.era;
  if (!era) return [];
  const a = map.cityById.get(fromCityId);
  const b = map.cityById.get(toCityId);
  if (!a || !b) return [];
  const out: BorderStop[] = [];
  const ca = a.abroad?.country;
  const cb = b.abroad?.country;
  [ca, cb].forEach((c, i) => {
    if (!c || (i === 1 && c === ca)) return;
    const k = map.borderCountries.indexOf(c);
    if (k >= 0 && era.border[k].hours > 0) out.push({ label: c, ...era.border[k] });
  });
  const za = map.zoneOf[a.y * map.width + a.x];
  const zb = map.zoneOf[b.y * map.width + b.x];
  if (za !== zb) {
    const z = za >= 0 ? za : zb;
    if (era.zone[z] > 0) out.push({ label: map.zones[z].name, hours: era.zone[z], fee: 0 });
  }
  return out;
}

/** Where on a path the border queue happens: the first tile in a different country or zone from the start. */
function borderIndex(map: WorldMap, path: number[]): number {
  const c0 = map.landCountry[path[0]];
  const z0 = map.zoneOf[path[0]];
  for (let i = 1; i < path.length; i++) {
    if (map.crossingAt[path[i]] >= 0) continue;
    if (map.landCountry[path[i]] !== c0 || map.zoneOf[path[i]] !== z0) return i;
  }
  return Math.min(1, path.length - 1);
}

function search(map: WorldMap, startIdx: number, goalIdx: number): { path: number[]; cost: number } {
  const { width, height, road } = map;
  const n = width * height;
  const cost = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const heap = new MinHeap();
  const gx = goalIdx % width;
  const gy = (goalIdx - gx) / width;
  // Admissible: nothing is cheaper than a motorway tile.
  const hScale = unitsPerTile(map) * MOTORWAY_FACTOR;
  cost[startIdx] = 0;
  heap.push(startIdx, 0);

  while (heap.size) {
    const cur = heap.pop();
    if (cur === goalIdx) break;
    const cx = cur % width;
    const cy = (cur - cx) / width;
    const neighbours = [
      cx > 0 ? cur - 1 : -1,
      cx < width - 1 ? cur + 1 : -1,
      cy > 0 ? cur - width : -1,
      cy < height - 1 ? cur + width : -1,
    ];
    for (const nb of neighbours) {
      if (nb < 0 || !road[nb]) continue;
      const c = cost[cur] + stepCost(map, cur, nb);
      if (c < cost[nb]) {
        cost[nb] = c;
        prev[nb] = cur;
        const nx = nb % width;
        const ny = (nb - nx) / width;
        heap.push(nb, c + (Math.abs(nx - gx) + Math.abs(ny - gy)) * hScale);
      }
    }
  }

  if (startIdx !== goalIdx && prev[goalIdx] === -1) return { path: [], cost: Infinity };
  const path: number[] = [];
  for (let cur = goalIdx; cur !== -1; cur = prev[cur]) path.push(cur);
  return { path: path.reverse(), cost: cost[goalIdx] };
}

/** Tile indices from one city centre to another (inclusive). Empty if unreachable. */
export function getCityPath(map: WorldMap, fromCityId: string, toCityId: string): number[] {
  const key = `${fromCityId}|${toCityId}`;
  const cached = map.pathCache.get(key);
  if (cached) return cached;
  const reverseKey = `${toCityId}|${fromCityId}`;
  const reverse = map.pathCache.get(reverseKey);
  if (reverse) {
    const path = [...reverse].reverse();
    map.pathCache.set(key, path);
    map.distCache.set(key, map.distCache.get(reverseKey) ?? Infinity);
    return path;
  }
  const from = map.cityById.get(fromCityId);
  const to = map.cityById.get(toCityId);
  if (!from || !to) return [];
  const found = search(map, from.y * map.width + from.x, to.y * map.width + to.x);
  const queue = routeBorders(map, fromCityId, toCityId).reduce((sum, b) => sum + b.hours * HOURS_TO_UNITS, 0);
  map.pathCache.set(key, found.path);
  map.distCache.set(key, found.cost + (found.path.length ? queue : 0));
  return found.path;
}

/** Units along a tile path. */
export function pathCost(map: WorldMap, path: number[]): number {
  if (!path.length) return Infinity;
  let c = 0;
  for (let i = 1; i < path.length; i++) c += stepCost(map, path[i - 1], path[i]);
  return c;
}

/** Road distance in game units (see KM_PER_UNIT); Infinity if the cities aren't connected. */
export function roadDistance(map: WorldMap, fromCityId: string, toCityId: string): number {
  if (fromCityId === toCityId) return 0;
  const key = `${fromCityId}|${toCityId}`;
  if (!map.distCache.has(key)) getCityPath(map, fromCityId, toCityId);
  return map.distCache.get(key) ?? Infinity;
}

/** Fractional tile-space position (tile centres at +0.5) after `progress` tiles along a path. */
export function positionOnPath(map: WorldMap, path: number[], progress: number) {
  if (!path.length) return { x: 0, y: 0, dir: 0 };
  const maxSeg = path.length - 1;
  const p = Math.max(0, Math.min(maxSeg, progress));
  const i = Math.min(Math.floor(p), Math.max(0, maxSeg - 1));
  const t = maxSeg === 0 ? 0 : p - i;
  const a = path[i];
  const b = path[Math.min(i + 1, maxSeg)];
  const ax = a % map.width;
  const ay = (a - ax) / map.width;
  const bx = b % map.width;
  const by = (b - bx) / map.width;
  // dir: 0 = +x, 1 = +y, 2 = -x, 3 = -y (iso screen: SE, SW, NW, NE)
  const dir = bx > ax ? 0 : by > ay ? 1 : bx < ax ? 2 : 3;
  return { x: ax + (bx - ax) * t + 0.5, y: ay + (by - ay) * t + 0.5, dir };
}

const cumCache = new WeakMap<number[], Float64Array>();

/** Where a vehicle `units` along the road from one town to another is (tile space). */
export function positionOnRoute(map: WorldMap, from: string, to: string, units: number) {
  const path = getCityPath(map, from, to);
  if (path.length < 2) return positionOnPath(map, path, 0);
  let cum = cumCache.get(path);
  if (!cum) {
    cum = new Float64Array(path.length);
    const queue = routeBorders(map, from, to).reduce((sum, b) => sum + b.hours * HOURS_TO_UNITS, 0);
    const at = borderIndex(map, path);
    for (let i = 1; i < path.length; i++) cum[i] = cum[i - 1] + stepCost(map, path[i - 1], path[i]) + (i === at ? queue : 0);
    cumCache.set(path, cum);
  }
  const u = Math.max(0, Math.min(cum[cum.length - 1], units));
  let i = 0;
  while (i < cum.length - 2 && cum[i + 1] < u) i++;
  const seg = cum[i + 1] - cum[i];
  return positionOnPath(map, path, i + (seg > 0 ? (u - cum[i]) / seg : 0));
}
