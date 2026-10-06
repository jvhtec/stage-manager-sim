/**
 * Deterministic world generation. Same seed → same map, every time, so the
 * map itself is never saved (only `TycoonState.mapSeed` is).
 *
 * Pipeline: value-noise heightmap on tile corners (integer levels, TT-style
 * "adjacent corners differ by at most 1") → terrain classes → cities placed
 * on land with spacing → city areas flattened → venue / depot lots reserved
 * → inter-city roads laid with A* over terrain costs → town streets →
 * cosmetic buildings.
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

export const MAP_WIDTH = 72;
export const MAP_HEIGHT = 56;
const MAX_LEVEL = 5;
const CITY_COUNT = 16;
const CITY_SPACING = 10;

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
// Names
// ---------------------------------------------------------------------------

const NAME_PREFIXES = [
  'Brad', 'Ash', 'Wex', 'Hol', 'Mar', 'Dun', 'Kings', 'Thorn', 'Sil', 'Gal', 'Mill',
  'Red', 'Os', 'Fen', 'Craw', 'Elm', 'Bur', 'Lang', 'Wick', 'Stan', 'Bel', 'Car',
  'Ex', 'Gran', 'Hart', 'Lud', 'Nor', 'Pen', 'Rock', 'Tad', 'Wal', 'Whit',
];
const NAME_SUFFIXES = [
  'ford', 'ton', 'bury', 'field', 'wick', 'ham', 'mouth', 'by', 'stead', 'well',
  'port', 'ley', 'bridge', 'minster', 'dale', 'combe', 'chester', 'haven',
];
const PUB_ANIMALS = ['Fox', 'Crown', 'Stag', 'Swan', 'Plough', 'Bell', 'Lion', 'Anchor', 'Badger', 'Kettle'];
const PUB_OBJECTS = ['Fiddle', 'Hound', 'Lantern', 'Drum', 'Barrel', 'Feather', 'Key', 'Wheel'];
const CLUB_WORDS = ['Electric', 'Velvet', 'Basement', 'Neon', 'Warehouse', 'Lounge', 'Factory', 'Vault'];

function cityName(rng: Rng, used: Set<string>): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let name = rng.pick(NAME_PREFIXES) + rng.pick(NAME_SUFFIXES);
    if (rng.chance(0.12)) name = `${rng.pick(['East', 'Port', 'Upper', 'Great'])} ${name}`;
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
  }
  const fallback = `New Town ${used.size}`;
  used.add(fallback);
  return fallback;
}

function venueName(kind: VenueKind, city: string, rng: Rng): string {
  switch (kind) {
    case 'pub':
      return `The ${rng.pick(PUB_ANIMALS)} & ${rng.pick(PUB_OBJECTS)}`;
    case 'hall':
      return `${city} Town Hall`;
    case 'club':
      return `${rng.pick(CLUB_WORDS)} Club`;
    case 'theatre':
      return rng.chance(0.5) ? `${city} Playhouse` : `Royal Theatre ${city}`;
    case 'arena':
      return `${city} Arena`;
    case 'stadium':
      return `${city} Stadium`;
    case 'airport':
      return `${city} International Airport`;
  }
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

function populationFor(size: CitySize, rng: Rng): number {
  switch (size) {
    case 'metropolis':
      return rng.nextRange(850, 1300) * 1000;
    case 'city':
      return rng.nextRange(220, 480) * 1000;
    case 'town':
      return rng.nextRange(45, 160) * 1000;
    case 'village':
      return rng.nextRange(6, 35) * 1000;
  }
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

const worldCache = new Map<number, WorldMap>();

/** Memoised — the renderer, the sim and the UI all share one instance per seed. */
export function getWorld(seed: number): WorldMap {
  let world = worldCache.get(seed);
  if (!world) {
    world = generateWorld(seed);
    worldCache.set(seed, world);
  }
  return world;
}

export function generateWorld(seed: number): WorldMap {
  const width = MAP_WIDTH;
  const height = MAP_HEIGHT;
  const rng = createRng(seed ^ 0x5eed);
  const cw = width + 1;
  const ch = height + 1;

  // 1. Elevation noise on corners, with an island falloff so the map has a coast.
  const n1 = makeValueNoise(rng, cw, ch, 14);
  const n2 = makeValueNoise(rng, cw, ch, 6);
  const n3 = makeValueNoise(rng, cw, ch, 3);
  const forestNoise = makeValueNoise(rng, width, height, 5);
  const heights = new Uint8Array(cw * ch);
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      let e = n1(x, y) * 0.6 + n2(x, y) * 0.3 + n3(x, y) * 0.1;
      const dx = (x / width - 0.5) * 2;
      const dy = (y / height - 0.5) * 2;
      const d = Math.sqrt(dx * dx * 0.9 + dy * dy * 0.9);
      e += 0.12 - Math.max(0, d - 0.62) * 0.9;
      const level = e < 0.4 ? 0 : Math.min(MAX_LEVEL, 1 + Math.floor((e - 0.4) / 0.09));
      heights[idx(x, y, cw)] = level;
    }
  }
  relaxHeights(heights, cw, ch);

  const map: WorldMap = {
    seed,
    width,
    height,
    terrain: new Uint8Array(width * height),
    road: new Uint8Array(width * height),
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
        else if (min >= 4) t = Terrain.Rough;
        else if (forestNoise(x, y) > 0.62) t = Terrain.Forest;
        map.terrain[idx(x, y, width)] = t;
      }
    }
  };
  classifyTerrain();

  // 2. Cities: land tiles, spaced apart, preferring flatter mid-height ground.
  const margin = 6;
  const centers: { x: number; y: number }[] = [];
  for (let attempt = 0; attempt < 4000 && centers.length < CITY_COUNT; attempt++) {
    const x = rng.nextRange(margin, width - margin);
    const y = rng.nextRange(margin, height - margin);
    if (map.terrain[idx(x, y, width)] === Terrain.Water || map.terrain[idx(x, y, width)] === Terrain.Sand) continue;
    const [a] = tileCorners(map, x, y);
    if (a >= 4 && rng.chance(0.7)) continue;
    if (centers.some(c => Math.hypot(c.x - x, c.y - y) < CITY_SPACING)) continue;
    centers.push({ x, y });
  }

  const usedNames = new Set<string>();
  const fixed = new Uint8Array(cw * ch);
  // The most central, lowest-lying city becomes the metropolis.
  const ranked = centers
    .map(c => ({ ...c, score: Math.hypot(c.x - width / 2, c.y - height / 2) + rng.next() * 12 }))
    .sort((a, b) => a.score - b.score);

  ranked.forEach((center, rank) => {
    const size = sizeForRank(rank);
    const radius = SIZE_RADIUS[size];
    const level = Math.max(1, heights[idx(center.x, center.y, cw)]);
    for (let y = center.y - radius - 1; y <= center.y + radius + 2; y++) {
      for (let x = center.x - radius - 1; x <= center.x + radius + 2; x++) {
        if (x < 0 || y < 0 || x >= cw || y >= ch) continue;
        heights[idx(x, y, cw)] = level;
        fixed[idx(x, y, cw)] = 1;
      }
    }
    const name = cityName(rng, usedNames);
    map.cities.push({
      id: `city-${rank}`,
      name,
      x: center.x,
      y: center.y,
      population: populationFor(size, rng),
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

  // 3. Town streets: a cross through the centre (two for big places).
  map.cities.forEach(city => {
    const arm = city.radius;
    for (let d = -arm; d <= arm; d++) {
      map.road[idx(city.x + d, city.y, width)] = 1;
      map.road[idx(city.x, city.y + d, width)] = 1;
    }
    if (city.size === 'city' || city.size === 'metropolis') {
      const off = Math.ceil(arm / 2) + 1;
      for (let d = -arm + 1; d <= arm - 1; d++) {
        map.road[idx(city.x + d, city.y + off, width)] = 1;
        map.road[idx(city.x - off, city.y + d, width)] = 1;
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
  const footprintFree = (x: number, y: number, w: number, h: number) => {
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const tx = x + i;
        const ty = y + j;
        if (tx < 1 || ty < 1 || tx >= width - 1 || ty >= height - 1) return false;
        const k = idx(tx, ty, width);
        if (map.road[k] || taken[k] || map.terrain[k] === Terrain.Water) return false;
        if (!isFlat(map, tx, ty)) return false;
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
    const maxR = city.radius + 3;
    const candidates: { x: number; y: number; d: number }[] = [];
    for (let y = city.y - maxR; y <= city.y + maxR; y++) {
      for (let x = city.x - maxR; x <= city.x + maxR; x++) {
        const d = Math.hypot(x + w / 2 - city.x, y + h / 2 - city.y);
        candidates.push({ x, y, d: d + rng.next() * 1.5 });
      }
    }
    candidates.sort((a, b) => a.d - b.d);
    for (const c of candidates) {
      if (footprintFree(c.x, c.y, w, h) && touchesRoad(c.x, c.y, w, h)) {
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) taken[idx(c.x + i, c.y + j, width)] = 1;
        return { x: c.x, y: c.y };
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
        name: venueName(kind, city.name, rng),
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
        if (map.road[k] || taken[k] || map.terrain[k] === Terrain.Water) continue;
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
