/**
 * Vehicles only drive on road tiles. Paths are always city-centre to
 * city-centre (venues and depots hang off a town's streets), so there are
 * only O(cities²) distinct routes — each is computed once and cached on the
 * WorldMap.
 */
import { MinHeap } from './heap';
import type { WorldMap } from './types';

function search(map: WorldMap, startIdx: number, goalIdx: number): number[] {
  const { width, height, road } = map;
  const n = width * height;
  const cost = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const heap = new MinHeap();
  const gx = goalIdx % width;
  const gy = (goalIdx - gx) / width;
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
      const c = cost[cur] + 1;
      if (c < cost[nb]) {
        cost[nb] = c;
        prev[nb] = cur;
        const nx = nb % width;
        const ny = (nb - nx) / width;
        heap.push(nb, c + Math.abs(nx - gx) + Math.abs(ny - gy));
      }
    }
  }

  if (startIdx !== goalIdx && prev[goalIdx] === -1) return [];
  const path: number[] = [];
  for (let cur = goalIdx; cur !== -1; cur = prev[cur]) path.push(cur);
  return path.reverse();
}

/** Tile indices from one city centre to another (inclusive). Empty if unreachable. */
export function getCityPath(map: WorldMap, fromCityId: string, toCityId: string): number[] {
  const key = `${fromCityId}|${toCityId}`;
  const cached = map.pathCache.get(key);
  if (cached) return cached;
  const reverse = map.pathCache.get(`${toCityId}|${fromCityId}`);
  if (reverse) {
    const path = [...reverse].reverse();
    map.pathCache.set(key, path);
    return path;
  }
  const from = map.cityById.get(fromCityId);
  const to = map.cityById.get(toCityId);
  if (!from || !to) return [];
  const path = search(map, from.y * map.width + from.x, to.y * map.width + to.x);
  map.pathCache.set(key, path);
  return path;
}

/**
 * Game distance is real distance: one unit is this many kilometres, and vehicle speeds,
 * fuel, ranges and trip times are all measured in units. A 300 km run takes the same
 * time in Britain as in the States; only the map's tile size differs.
 */
export const KM_PER_UNIT = 18;
export const unitsPerTile = (map: Pick<WorldMap, 'kmPerTile'>) => map.kmPerTile / KM_PER_UNIT;
export const unitsToKm = (units: number) => Math.round(units * KM_PER_UNIT);

/** Road distance in game units (see KM_PER_UNIT); Infinity if the cities aren't connected. */
export function roadDistance(map: WorldMap, fromCityId: string, toCityId: string): number {
  if (fromCityId === toCityId) return 0;
  const path = getCityPath(map, fromCityId, toCityId);
  return path.length ? (path.length - 1) * unitsPerTile(map) : Infinity;
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
