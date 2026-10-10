/**
 * Deterministic world generation. Same seed and country → same map, every time,
 * so the map itself is never saved (only `TycoonState.mapSeed` and `country` are).
 *
 * Each country is a miniature of the real thing: the coastline comes from a land
 * mask rasterised offline from Natural Earth (content/landmasks.ts), mountains
 * rise where the real ranges run, and the biggest towns sit where they really are
 * — drawn oversized, then nudged apart until they fit. The seed only varies the
 * lumps and bumps, the woods and the layout of each town.
 *
 * Pipeline: heightmap on tile corners (integer levels, TT-style "adjacent corners
 * differ by at most 1") → real towns placed on land → town areas flattened →
 * terrain classes → venue / depot lots reserved → inter-city roads laid with A*
 * over terrain costs → town streets → cosmetic buildings.
 */
import { createRng, type Rng } from '@/lib/rng';
import {
  Terrain,
  type City,
  type CitySize,
  type Venue,
  type VenueKind,
  type WorldMap,
} from './types';
import { MinHeap } from './heap';
import { DEFAULT_COUNTRY, getCountry } from './content/countries';
import { geoCities, geoExcluded, homeMask, sizeOfGeo, landMask, projectionFor, rangeLift } from './content/geo';

const MAX_LEVEL = 5;
const CITY_COUNT = 16;

const idx = (x: number, y: number, w: number) => y * w + x;

// ---------------------------------------------------------------------------
// Noise
// ---------------------------------------------------------------------------

function makeValueNoise(rng: Rng, width: number, height: number, cell: number) {
  const gw = Math.ceil(width / cell) + 2;
  const gh = Math.ceil(height / cell) + 2;
  const lattice = Array.from({ length: gw * gh }, () => rng.next());
  const smooth = (t: number) => t * t * (3 - 2 * t);
  return (x: number, y: number) => {
    const gx = x / cell;
    const gy = y / cell;
    const x0 = Math.floor(gx);
    const y0 = Math.floor(gy);
    const tx = smooth(gx - x0);
    const ty = smooth(gy - y0);
    const v = (i: number, j: number) => lattice[(y0 + j) * gw + (x0 + i)];
    const a = v(0, 0) + (v(1, 0) - v(0, 0)) * tx;
    const b = v(0, 1) + (v(1, 1) - v(0, 1)) * tx;
    return a + (b - a) * ty;
  };
}

// ---------------------------------------------------------------------------
// City programme: what each size of settlement gets
// ---------------------------------------------------------------------------

const SIZE_RADIUS: Record<CitySize, number> = { village: 2, town: 3, city: 4, metropolis: 6 };
const LOTS_PER_SIZE: Record<CitySize, number> = { village: 1, town: 2, city: 3, metropolis: 3 };

const VENUE_SPECS: Record<VenueKind, { tier: number; w: number; h: number; capacity: [number, number] }> = {
  pub: { tier: 1, w: 1, h: 1, capacity: [120, 300] },
  hall: { tier: 1, w: 1, h: 1, capacity: [300, 600] },
  club: { tier: 2, w: 1, h: 1, capacity: [600, 1500] },
  theatre: { tier: 2, w: 2, h: 1, capacity: [1200, 2600] },
  arena: { tier: 3, w: 2, h: 2, capacity: [8000, 16000] },
  stadium: { tier: 4, w: 3, h: 3, capacity: [45000, 80000] },
  // Not a show venue: where world-tour freight flies out from.
  airport: { tier: 4, w: 3, h: 2, capacity: [0, 1] },
};

const SIZE_VENUES: Record<CitySize, VenueKind[]> = {
  village: ['pub'],
  town: ['pub', 'hall', 'club'],
  city: ['pub', 'club', 'theatre', 'arena'],
  metropolis: ['pub', 'club', 'theatre', 'arena', 'stadium', 'airport'],
};

function sizeForRank(rank: number): CitySize {
  if (rank === 0) return 'metropolis';
  if (rank <= 2) return 'city';
  if (rank <= 7) return 'town';
  return 'village';
}

// ---------------------------------------------------------------------------
// Heights
// ---------------------------------------------------------------------------

function neighbourCorners(i: number, x: number, y: number, cw: number, ch: number): number[] {
  const out: number[] = [];
  if (x > 0) out.push(i - 1);
  if (x < cw - 1) out.push(i + 1);
  if (y > 0) out.push(i - cw);
  if (y < ch - 1) out.push(i + cw);
  return out;
}

/**
 * Enforce |Δh| ≤ 1 between orthogonally adjacent corners by only ever
 * *lowering* (or, with `raise`, only ever raising) corners — monotone, so it
 * always converges. `fixed` corners are left alone.
 */
function relaxHeights(h: Uint8Array, cw: number, ch: number, opts: { raise?: boolean; fixed?: Uint8Array } = {}) {
  let changed = true;
  while (changed) {
    changed = false;
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const i = idx(x, y, cw);
        if (opts.fixed?.[i]) continue;
        const nbs = neighbourCorners(i, x, y, cw, ch);
        let v = h[i];
        if (opts.raise) {
          nbs.forEach(n => (v = Math.max(v, h[n] - 1)));
        } else {
          nbs.forEach(n => (v = Math.min(v, h[n] + 1)));
        }
        if (v !== h[i]) {
          h[i] = v;
          changed = true;
        }
      }
    }
  }
}

export function tileCorners(map: Pick<WorldMap, 'heights' | 'width'>, x: number, y: number) {
  const cw = map.width + 1;
  return [
    map.heights[idx(x, y, cw)],
    map.heights[idx(x + 1, y, cw)],
    map.heights[idx(x + 1, y + 1, cw)],
    map.heights[idx(x, y + 1, cw)],
  ] as const;
}

export function isFlat(map: Pick<WorldMap, 'heights' | 'width'>, x: number, y: number): boolean {
  const [a, b, c, d] = tileCorners(map, x, y);
  return a === b && b === c && c === d;
}

/** Bilinear terrain height at a fractional tile-space position. */
export function heightAt(map: Pick<WorldMap, 'heights' | 'width' | 'height'>, fx: number, fy: number): number {
  const x = Math.max(0, Math.min(map.width - 0.001, fx));
  const y = Math.max(0, Math.min(map.height - 0.001, fy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const tx = x - x0;
  const ty = y - y0;
  const [n, e, s, w] = tileCorners(map, x0, y0); // corners: (x0,y0) (x1,y0) (x1,y1) (x0,y1)
  const top = n + (e - n) * tx;
  const bottom = w + (s - w) * tx;
  return top + (bottom - top) * ty;
}

// ---------------------------------------------------------------------------
// Roads
// ---------------------------------------------------------------------------

function layRoad(
  map: WorldMap,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const { width, height, terrain, road } = map;
  const n = width * height;
  const start = idx(from.x, from.y, width);
  const goal = idx(to.x, to.y, width);
  const cost = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const heap = new MinHeap();
  cost[start] = 0;
  heap.push(start, 0);

  const stepCost = (i: number) => {
    if (road[i]) return 0.35;
    const x = i % width;
    const y = (i - x) / width;
    let c = 1;
    const t = terrain[i];
    if (t === Terrain.Water) c += 14; // bridges are expensive
    if (t === Terrain.Forest) c += 1.2;
    if (t === Terrain.Rough) c += 3;
    if (map.foreign[i]) c += 2.5; // keep to the home country where there's a choice
    if (!isFlat(map, x, y)) c += 1.5;
    return c;
  };

  while (heap.size) {
    const cur = heap.pop();
    if (cur === goal) break;
    const cx = cur % width;
    const cy = (cur - cx) / width;
    const neighbours = [
      cx > 0 ? cur - 1 : -1,
      cx < width - 1 ? cur + 1 : -1,
      cy > 0 ? cur - width : -1,
      cy < height - 1 ? cur + width : -1,
    ];
    for (const nb of neighbours) {
      if (nb < 0) continue;
      const nx = nb % width;
      const ny = (nb - nx) / width;
      // Keep a one-tile margin so roads don't hug the map edge.
      if (nx < 1 || ny < 1 || nx > width - 2 || ny > height - 2) continue;
      const c = cost[cur] + stepCost(nb);
      if (c < cost[nb]) {
        cost[nb] = c;
        prev[nb] = cur;
        heap.push(nb, c + (Math.abs(nx - to.x) + Math.abs(ny - to.y)) * 0.35);
      }
    }
  }

  let cur = goal;
  if (prev[cur] === -1 && cur !== start) return;
  while (cur !== -1) {
    road[cur] = 1;
    cur = prev[cur];
  }
}

// ---------------------------------------------------------------------------
// Main entry
// ---------------------------------------------------------------------------

const worldCache = new Map<string, WorldMap>();

/** Memoised — the renderer, the sim and the UI all share one instance per (seed, country). */
export function getWorld(seed: number, country: string = DEFAULT_COUNTRY): WorldMap {
  const key = `${seed}:${country}`;
  let world = worldCache.get(key);
  if (!world) {
    world = generateWorld(seed, country);
    worldCache.set(key, world);
  }
  return world;
}

/** The world a saved game is played on. */
export function worldOf(state: { mapSeed: number; country?: string }): WorldMap {
  return getWorld(state.mapSeed, state.country);
}

interface Seat {
  name: string;
  population: number;
  radius: number;
  /** Where it really is, in tile coordinates. */
  ideal: { x: number; y: number };
  x: number;
  y: number;
}

/** Corners → distance (in steps) to the nearest sea corner. */
function seaDistance(land: Uint8Array, cw: number, ch: number): Uint16Array {
  const dist = new Uint16Array(cw * ch).fill(0xffff);
  const queue: number[] = [];
  land.forEach((l, i) => {
    if (!l) {
      dist[i] = 0;
      queue.push(i);
    }
  });
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head];
    const x = i % cw;
    const y = (i - x) / cw;
    neighbourCorners(i, x, y, cw, ch).forEach(n => {
      if (dist[n] === 0xffff) {
        dist[n] = dist[i] + 1;
        queue.push(n);
      }
    });
  }
  return dist;
}

export function generateWorld(seed: number, countryCode: string = DEFAULT_COUNTRY): WorldMap {
  const country = getCountry(countryCode);
  const [width, height] = sizeOfGeo(country.code);
  const rng = createRng(seed ^ 0x5eed ^ (country.code.charCodeAt(0) * 131 + country.code.charCodeAt(1)));
  const cw = width + 1;
  const ch = height + 1;

  // 1. The real country: coast, mountains.
  const land = landMask(country.code);
  const proj0 = projectionFor(country.code);
  const home = homeMask(country.code);
  const lift = rangeLift(country.code);
  const toSea = seaDistance(land, cw, ch);
  const n1 = makeValueNoise(rng, cw, ch, 12);
  const n2 = makeValueNoise(rng, cw, ch, 5);
  const forestNoise = makeValueNoise(rng, width, height, 5);
  const heights = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const i = idx(x, y, cw);
      if (!land[i]) continue;
      // Gentle rolling country, mountains where the real ranges are, flat by the sea.
      const rolling = Math.max(0, n1(x, y) * 0.7 + n2(x, y) * 0.3 - 0.52) * 2;
      const raw = 1 + rolling + lift(x, y) * 5.6;
      const level = 1 + Math.round((raw - 1) * Math.min(1, toSea[i] / 3));
      heights[i] = Math.max(1, Math.min(MAX_LEVEL, level));
    }
  }
  relaxHeights(heights, cw, ch);

  const map: WorldMap = {
    seed,
    width,
    height,
    kmPerTile: proj0.kmPerTile,
    terrain: new Uint8Array(width * height),
    road: new Uint8Array(width * height),
    foreign: new Uint8Array(width * height),
    heights,
    cities: [],
    cityById: new Map(),
    venueById: new Map(),
    pathCache: new Map(),
  };

  const classifyTerrain = () => {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const [a, b, c, d] = tileCorners(map, x, y);
        const max = Math.max(a, b, c, d);
        const min = Math.min(a, b, c, d);
        let t = Terrain.Grass;
        if (max === 0) t = Terrain.Water;
        else if (min === 0) t = Terrain.Sand;
        else if (min >= 3) t = Terrain.Rough;
        else if (forestNoise(x, y) > 0.62) t = Terrain.Forest;
        map.terrain[idx(x, y, width)] = t;
        const mine = home[idx(x, y, cw)] + home[idx(x + 1, y, cw)] + home[idx(x + 1, y + 1, cw)] + home[idx(x, y + 1, cw)];
        map.foreign[idx(x, y, width)] = t !== Terrain.Water && mine < 2 ? 1 : 0;
      }
    }
  };

  // 2. The real towns, biggest first, where they really are — then oversized.
  const proj = projectionFor(country.code);
  const where = geoCities(country.code);
  const skip = new Set(geoExcluded(country.code));
  const seats: Seat[] = country.cities
    .filter(([name]) => where[name] && !skip.has(name))
    .slice(0, CITY_COUNT)
    .map(([name, population], rank) => {
      const ideal = proj.toTile(where[name][0], where[name][1]);
      return { name, population, radius: SIZE_RADIUS[sizeForRank(rank)], ideal, x: ideal.x, y: ideal.y };
    });

  // A town fits where the centre tile and its neighbours are land with a little room to the sea.
  const roomy = (x: number, y: number, r: number) => {
    const tx = Math.floor(x);
    const ty = Math.floor(y);
    if (tx < r + 2 || ty < r + 2 || tx > width - r - 3 || ty > height - r - 3) return false;
    for (let j = 0; j <= 1; j++) for (let i = 0; i <= 1; i++) if (!land[idx(tx + i, ty + j, cw)] || !home[idx(tx + i, ty + j, cw)]) return false;
    // Enough dry home ground around it for streets, venues and warehouse lots.
    let ok = 0;
    let all = 0;
    for (let j = -r; j <= r + 1; j++) {
      for (let i = -r; i <= r + 1; i++) {
        all++;
        if (land[idx(tx + i, ty + j, cw)] && home[idx(tx + i, ty + j, cw)]) ok++;
      }
    }
    return ok >= all * 0.4;
  };
  // Biggest first: each town takes the roomy ground nearest to where it really is that leaves
  // the towns already placed their elbow room (real distances are far smaller than oversized
  // towns need, so crowded regions fan out).
  const roomyTiles: { x: number; y: number }[] = [];
  for (let ty = 2; ty < height - 2; ty++) for (let tx = 2; tx < width - 2; tx++) roomyTiles.push({ x: tx + 0.5, y: ty + 0.5 });
  const placed: Seat[] = [];
  seats.forEach(seat => {
    // Keep the full elbow room if a spot within a few tiles of the real one has it; in crowded
    // regions let neighbouring towns sprawl into each other (a conurbation) rather than be exiled.
    let chosen: { x: number; y: number } | null = null;
    for (let slack = 1; slack >= 0.3; slack -= 0.1) {
      let best: { x: number; y: number } | null = null;
      let bestD = Infinity;
      for (const t of roomyTiles) {
        const d = Math.hypot(t.x - seat.ideal.x, t.y - seat.ideal.y);
        if (d >= bestD || !roomy(t.x, t.y, seat.radius)) continue;
        if (placed.some(o => Math.hypot(o.x - t.x, o.y - t.y) < (o.radius + seat.radius + 1) * slack)) continue;
        bestD = d;
        best = t;
      }
      if (best && (bestD <= Math.max(1.5, 20 / proj.kmPerTile) || slack < 0.35)) {
        chosen = best;
        break;
      }
      if (best && !chosen) chosen = best;
    }
    if (chosen) Object.assign(seat, chosen);
    placed.push(seat);
  });

  const fixed = new Uint8Array(cw * ch);
  land.forEach((l, i) => {
    if (!l) fixed[i] = 1;
  });
  seats.forEach((seat, rank) => {
    const size = sizeForRank(rank);
    const radius = seat.radius;
    const cx = Math.floor(seat.x);
    const cy = Math.floor(seat.y);
    // Inland towns may stand on a low plateau; anything near the sea sits at beach level.
    const level = toSea[idx(cx, cy, cw)] > radius + 3 ? Math.max(1, Math.min(3, heights[idx(cx, cy, cw)])) : 1;
    for (let y = cy - radius - 1; y <= cy + radius + 2; y++) {
      for (let x = cx - radius - 1; x <= cx + radius + 2; x++) {
        if (x < 0 || y < 0 || x >= cw || y >= ch) continue;
        const i = idx(x, y, cw);
        if (!land[i]) continue;
        heights[i] = level;
        fixed[i] = 1;
      }
    }
    map.cities.push({
      id: `city-${rank}`,
      name: seat.name,
      x: cx,
      y: cy,
      population: seat.population,
      size,
      radius,
      venues: [],
      buildings: [],
      lots: [],
    });
  });
  // Ramp the land up to meet raised town plateaus, then settle any clashes
  // where two towns at different levels meet.
  relaxHeights(heights, cw, ch, { raise: true, fixed });
  relaxHeights(heights, cw, ch);
  classifyTerrain();

  // 3. Town streets: a cross through the centre (two for big places), dry land only.
  const lay = (x: number, y: number) => {
    if (x < 1 || y < 1 || x > width - 2 || y > height - 2) return;
    if (map.terrain[idx(x, y, width)] === Terrain.Water) return;
    map.road[idx(x, y, width)] = 1;
  };
  map.cities.forEach(city => {
    const arm = city.radius;
    for (let d = -arm; d <= arm; d++) {
      lay(city.x + d, city.y);
      lay(city.x, city.y + d);
    }
    if (city.size === 'city' || city.size === 'metropolis') {
      const off = Math.ceil(arm / 2) + 1;
      for (let d = -arm + 1; d <= arm - 1; d++) {
        lay(city.x + d, city.y + off);
        lay(city.x - off, city.y + d);
      }
    }
  });

  // 4. Inter-city roads: a minimum spanning tree plus a few short loops.
  const edges: [number, number][] = [];
  const inTree = new Set<number>([0]);
  while (inTree.size < map.cities.length) {
    let best: [number, number] | null = null;
    let bestD = Infinity;
    inTree.forEach(i => {
      map.cities.forEach((c, j) => {
        if (inTree.has(j)) return;
        const d = Math.hypot(c.x - map.cities[i].x, c.y - map.cities[i].y);
        if (d < bestD) {
          bestD = d;
          best = [i, j];
        }
      });
    });
    if (!best) break;
    edges.push(best);
    inTree.add(best[1]);
  }
  map.cities.forEach((c, i) => {
    const nearest = map.cities
      .map((o, j) => ({ j, d: Math.hypot(o.x - c.x, o.y - c.y) }))
      .filter(o => o.j !== i)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2);
    nearest.forEach(({ j, d }) => {
      const exists = edges.some(([a, b]) => (a === i && b === j) || (a === j && b === i));
      if (!exists && d < 22) edges.push([i, j]);
    });
  });
  edges.forEach(([a, b]) => layRoad(map, map.cities[a], map.cities[b]));

  // 5. Lots: venues and the depot site, nearest free road-adjacent ground first.
  const taken = new Uint8Array(width * height);
  const footprintFree = (x: number, y: number, w: number, h: number, flat = true) => {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const tx = x + i;
        const ty = y + j;
        if (tx < 1 || ty < 1 || tx >= width - 1 || ty >= height - 1) return false;
        const k = idx(tx, ty, width);
        if (map.road[k] || taken[k] || map.foreign[k] || map.terrain[k] === Terrain.Water) return false;
        if (flat && !isFlat(map, tx, ty)) return false;
      }
    }
    return true;
  };
  const touchesRoad = (x: number, y: number, w: number, h: number) => {
    for (let j = -1; j <= h; j++) {
      for (let i = -1; i <= w; i++) {
        const edge = j === -1 || j === h || i === -1 || i === w;
        const corner = (j === -1 || j === h) && (i === -1 || i === w);
        if (!edge || corner) continue;
        if (map.road[idx(x + i, y + j, width)]) return true;
      }
    }
    return false;
  };
  const claimLot = (city: City, w: number, h: number) => {
    // Nearest free road-side ground first; a crowded or coastal town looks a little further out.
    // Last resort (a narrow peninsula like Florida): any dry ground, even a gentle slope.
    for (const [reach, needRoad, flat] of [[3, true, true], [7, true, true], [7, false, true], [7, false, false]] as const) {
      const maxR = city.radius + reach;
      const candidates: { x: number; y: number; d: number }[] = [];
      for (let y = city.y - maxR; y <= city.y + maxR; y++) {
        for (let x = city.x - maxR; x <= city.x + maxR; x++) {
          const d = Math.hypot(x + w / 2 - city.x, y + h / 2 - city.y);
          candidates.push({ x, y, d: d + rng.next() * 1.5 });
        }
      }
      candidates.sort((a, b) => a.d - b.d);
      for (const c of candidates) {
        if (footprintFree(c.x, c.y, w, h, flat) && (!needRoad || touchesRoad(c.x, c.y, w, h))) {
          for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) taken[idx(c.x + i, c.y + j, width)] = 1;
          return { x: c.x, y: c.y };
        }
      }
    }
    return null;
  };

  map.cities.forEach(city => {
    // Biggest footprints first so the stadium gets a lot before the pub.
    const kinds = [...SIZE_VENUES[city.size]].sort(
      (a, b) => VENUE_SPECS[b].w * VENUE_SPECS[b].h - VENUE_SPECS[a].w * VENUE_SPECS[a].h,
    );
    kinds.forEach((kind, i) => {
      const spec = VENUE_SPECS[kind];
      const lot = claimLot(city, spec.w, spec.h);
      if (!lot) return;
      const venue: Venue = {
        id: `${city.id}-v${i}`,
        cityId: city.id,
        name: country.landmarks[city.name]?.[kind] ?? country.venueNames[kind](city.name, rng),
        kind,
        tier: spec.tier,
        capacity: rng.nextRange(spec.capacity[0], spec.capacity[1]),
        x: lot.x,
        y: lot.y,
        w: spec.w,
        h: spec.h,
      };
      city.venues.push(venue);
      map.venueById.set(venue.id, venue);
    });
    city.venues.sort((a, b) => a.tier - b.tier);
    // Warehouse lots: room for you and rivals to share the bigger towns.
    for (let i = 0; i < LOTS_PER_SIZE[city.size]; i++) {
      const lot = claimLot(city, 2, 2);
      if (lot) city.lots.push(lot);
    }
  });

  // 6. Cosmetic buildings, denser and taller toward the centre of big places.
  const maxFloors: Record<CitySize, number> = { village: 1, town: 3, city: 5, metropolis: 9 };
  map.cities.forEach(city => {
    const r = city.radius + 1;
    for (let y = city.y - r; y <= city.y + r; y++) {
      for (let x = city.x - r; x <= city.x + r; x++) {
        if (x < 1 || y < 1 || x >= width - 1 || y >= height - 1) continue;
        const k = idx(x, y, width);
        if (map.road[k] || taken[k] || map.foreign[k] || map.terrain[k] === Terrain.Water) continue;
        const d = Math.hypot(x - city.x, y - city.y);
        if (d > r + 0.3) continue;
        const density = 0.95 - (d / (r + 0.5)) * 0.7;
        if (!rng.chance(density)) continue;
        const centrality = 1 - d / (r + 1);
        const floors = 1 + Math.floor(rng.next() * maxFloors[city.size] * centrality);
        city.buildings.push({ x, y, floors, color: rng.nextInt(6) });
        taken[k] = 1;
      }
    }
  });

  map.cities.forEach(c => map.cityById.set(c.id, c));
  return map;
}
