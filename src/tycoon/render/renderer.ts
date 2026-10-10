/**
 * Draws one frame of the isometric world.
 *
 * Painter's algorithm: walk tile diagonals back-to-front (x + y ascending),
 * drawing each tile's ground then whatever is anchored to it (trees, houses,
 * venues and warehouses anchored at their front-most footprint tile,
 * vehicles at the tile they're on). Labels, show markers and floodlight
 * beams go on top afterwards. Returns screen-space hit targets for picking.
 */
import { gigBookingBar } from '@/world/standing';
import { getModel, SHOW_END_HOUR, SHOW_START_HOUR, tierInfo } from '@/world/catalog';
import { dayOf, loadInHour, loadOutDoneHour, vehicleSpeed } from '@/world/core';
import { kmoney } from '../ui/format';
import { SHADOW_LAG } from './sprites';
import { tileCorners } from '@/world/mapgen';
import { CROSS_FERRY, CROSS_TUNNEL, crossKindAt, getCityPath, positionOnRoute } from '@/world/pathfinding';
import { Terrain, type City, type Gig, type TycoonState, type Venue, type Vehicle, type WorldMap } from '@/world/types';
import { TH, TW, groundZ, project, type Camera, type Pt } from './iso';
import { C, glow, hexToRgb, paint, setNight, type RGB } from './palette';
import { delegation, ferry, hash2, house, poly, tree, venue as drawVenue, vehicle as drawVehicle, warehouse, type RC } from './sprites';

export type Selection =
  | { kind: 'vehicle'; id: string }
  | { kind: 'venue'; id: string }
  | { kind: 'city'; id: string }
  | { kind: 'depot'; id: string }
  | null;

export interface RenderInput {
  map: WorldMap;
  state: TycoonState;
  cam: Camera;
  time: number;
  /** Fraction of the current game hour elapsed, for smooth motion. */
  alpha: number;
  hover: { x: number; y: number } | null;
  selection: Selection;
}

export interface HitTargets {
  vehicles: { id: string; x: number; y: number }[];
  markers: { gigIds: string[]; venueId: string; cityId?: string; x: number; y: number; w: number; h: number }[];
  labels: { cityId: string; x: number; y: number; w: number; h: number }[];
}

// ---------------------------------------------------------------------------
// Static per-map scenery index (built once per seed)
// ---------------------------------------------------------------------------

type StaticObj =
  | { t: 'house'; x: number; y: number; floors: number; color: number }
  | { t: 'tree'; x: number; y: number; size: number; conifer: boolean }
  | { t: 'rock'; x: number; y: number }
  | { t: 'venue'; venue: Venue }
  | { t: 'site'; city: City; lot: number };

interface StaticIndex {
  objs: Map<number, StaticObj[]>;
  urban: Uint8Array;
}

const staticCache = new WeakMap<WorldMap, StaticIndex>();

/** Each ferry crossing's water tiles in order from one shore to the other. */
const ferryLanes = new WeakMap<WorldMap, number[][]>();
function lanesOf(map: WorldMap): number[][] {
  const hit = ferryLanes.get(map);
  if (hit) return hit;
  const lanes: number[][] = [];
  map.crossings.forEach(cr => {
    if (!cr.tiles.length || crossKindAt(map, cr.tiles[0]) !== CROSS_FERRY) return;
    const set = new Set(cr.tiles);
    const nbs = (k: number) => [k - 1, k + 1, k - map.width, k + map.width];
    const start = cr.tiles.find(k => nbs(k).some(nb => map.road[nb] && map.crossingAt[nb] < 0)) ?? cr.tiles[0];
    const order = [start];
    const seen = new Set([start]);
    for (let h = 0; h < order.length; h++) nbs(order[h]).forEach(nb => {
      if (set.has(nb) && !seen.has(nb)) {
        seen.add(nb);
        order.push(nb);
      }
    });
    lanes.push(order);
  });
  ferryLanes.set(map, lanes);
  return lanes;
}

function staticIndex(map: WorldMap): StaticIndex {
  const cached = staticCache.get(map);
  if (cached) return cached;
  const objs = new Map<number, StaticObj[]>();
  const add = (x: number, y: number, o: StaticObj) => {
    const i = y * map.width + x;
    const list = objs.get(i);
    if (list) list.push(o);
    else objs.set(i, [o]);
  };
  const urban = new Uint8Array(map.width * map.height);
  const occupied = new Uint8Array(map.width * map.height);

  [...map.cities, ...map.abroad].forEach(city => {
    const r = city.radius + 1;
    for (let y = city.y - r; y <= city.y + r; y++)
      for (let x = city.x - r; x <= city.x + r; x++)
        if (x >= 0 && y >= 0 && x < map.width && y < map.height && Math.hypot(x - city.x, y - city.y) <= r + 0.5) {
          urban[y * map.width + x] = 1;
        }
    city.buildings.forEach(b => {
      add(b.x, b.y, { t: 'house', ...b });
      occupied[b.y * map.width + b.x] = 1;
    });
    city.venues.forEach(v => {
      add(v.x + v.w - 1, v.y + v.h - 1, { t: 'venue', venue: v });
      for (let j = 0; j < v.h; j++) for (let i = 0; i < v.w; i++) occupied[(v.y + j) * map.width + v.x + i] = 1;
    });
    city.lots.forEach((s, lot) => {
      add(s.x + 1, s.y + 1, { t: 'site', city, lot });
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) occupied[(s.y + j) * map.width + s.x + i] = 1;
    });
  });

  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const i = y * map.width + x;
      if (occupied[i] || map.road[i] || map.foreign[i]) continue;
      const t = map.terrain[i];
      if (t === Terrain.Forest) {
        const n = 2 + Math.floor(hash2(x, y, 3) * 2);
        for (let k = 0; k < n; k++) {
          add(x, y, {
            t: 'tree',
            x: x + 0.2 + hash2(x, y, 10 + k) * 0.6,
            y: y + 0.2 + hash2(x, y, 20 + k) * 0.6,
            size: 8 + hash2(x, y, 30 + k) * 4,
            conifer: hash2(x, y, 40 + k) < 0.7,
          });
        }
      } else if (t === Terrain.Grass && !urban[i] && hash2(x, y, 5) < 0.05) {
        add(x, y, { t: 'tree', x: x + 0.5, y: y + 0.5, size: 8, conifer: false });
      } else if (t === Terrain.Rough && hash2(x, y, 6) < 0.4) {
        add(x, y, { t: 'rock', x: x + 0.3 + hash2(x, y, 7) * 0.4, y: y + 0.3 + hash2(x, y, 8) * 0.4 });
      }
    }
  }
  // Within a tile, draw back objects first.
  objs.forEach(list => list.sort((a, b) => objDepth(a) - objDepth(b)));
  const index = { objs, urban };
  staticCache.set(map, index);
  return index;
}

function objDepth(o: StaticObj): number {
  if (o.t === 'tree' || o.t === 'rock' || o.t === 'house') return o.x + o.y;
  return 1000;
}

// ---------------------------------------------------------------------------
// Terrain & roads
// ---------------------------------------------------------------------------

const TERRAIN_COLORS: Record<number, RGB> = {
  [Terrain.Water]: C.water,
  [Terrain.Grass]: C.grass,
  [Terrain.Forest]: C.forestFloor,
  [Terrain.Rough]: C.rough,
  [Terrain.Sand]: C.sand,
};

function drawTile(rc: RC, idx: StaticIndex, x: number, y: number) {
  const { map } = rc;
  const [hN, hE, hS, hW] = tileCorners(map, x, y);
  const i = y * map.width + x;
  const t = map.terrain[i];
  const pts: Pt[] = [project(rc.cam, x, y, hN), project(rc.cam, x + 1, y, hE), project(rc.cam, x + 1, y + 1, hS), project(rc.cam, x, y + 1, hW)];

  const dzdx = (hE + hS - hN - hW) / 2;
  const dzdy = (hW + hS - hN - hE) / 2;
  const slopeLight = 1 + 0.24 * (0.35 * dzdx - 0.6 * dzdy);
  const variation = 0.95 + hash2(x, y) * 0.08;
  let base = TERRAIN_COLORS[t];
  if (idx.urban[i] && t !== Terrain.Water) base = [138, 150, 112];
  // Winter: snow on the high ground.
  if (map.era?.winter && t !== Terrain.Water) {
    const avg = (hN + hE + hS + hW) / 4;
    if (avg >= 2.4) {
      const f = Math.min(0.9, (avg - 2.2) / 1.3);
      base = [base[0] + (236 - base[0]) * f, base[1] + (241 - base[1]) * f, base[2] + (248 - base[2]) * f];
    }
  }
  // Neighbouring countries sit there as a muted backdrop: you can see the shape of home.
  const abroad = map.foreign[i] === 1;
  if (abroad) base = [base[0] * 0.45 + 150 * 0.55, base[1] * 0.45 + 156 * 0.55, base[2] * 0.45 + 162 * 0.55];
  const isWater = (nx: number, ny: number) => nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && map.terrain[ny * map.width + nx] === Terrain.Water;
  const waterN = [isWater(x, y - 1), isWater(x + 1, y), isWater(x, y + 1), isWater(x - 1, y)];
  const shore = t === Terrain.Water && waterN.some(w => !w);
  // Open water is deeper; the shallows by the shore are lighter.
  const depth = t === Terrain.Water ? (shore ? 1.1 : 0.92 + hash2(x, y, 4) * 0.04) : 1;
  poly(rc, pts, paint(base, slopeLight * variation * depth));

  if (t === Terrain.Water) {
    // Foam along the edges that meet land.
    if (shore && rc.cam.zoom >= 0.8) {
      const edges: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 0]];
      rc.ctx.strokeStyle = paint(C.white, 1, 0.55 + 0.15 * Math.sin(rc.time / 600 + x + y));
      rc.ctx.lineWidth = Math.max(1, rc.cam.zoom * 0.9);
      rc.ctx.lineCap = 'round';
      rc.ctx.beginPath();
      edges.forEach(([a, b], k) => {
        if (waterN[k]) return;
        rc.ctx.moveTo(pts[a][0], pts[a][1]);
        rc.ctx.lineTo(pts[b][0], pts[b][1]);
      });
      rc.ctx.stroke();
    }
    // Drifting glints.
    const phase = (rc.time / 1400 + hash2(x, y, 9)) % 1;
    if (phase < 0.35 && rc.cam.zoom >= 0.9) {
      const [gx, gy] = project(rc.cam, x + 0.3 + phase, y + 0.5, 0);
      rc.ctx.fillStyle = paint(C.waterGlint, 1, 0.55);
      rc.ctx.fillRect(gx, gy, 4 * rc.cam.zoom, Math.max(1, rc.cam.zoom * 0.6));
    }
  } else if (rc.cam.zoom >= 1.3 && !abroad && !map.road[i] && !idx.urban[i] && (t === Terrain.Grass || t === Terrain.Forest || t === Terrain.Rough)) {
    // Tufts of grass (or scree) so big fields aren't flat colour.
    const light = t === Terrain.Rough ? 'rgba(170,158,128,0.55)' : 'rgba(150,200,110,0.45)';
    const dark = t === Terrain.Rough ? 'rgba(80,72,60,0.5)' : 'rgba(46,92,40,0.4)';
    for (let k = 0; k < 4; k++) {
      const u = 0.12 + hash2(x, y, 60 + k) * 0.76;
      const v = 0.12 + hash2(x, y, 70 + k) * 0.76;
      const [tx, ty] = project(rc.cam, x + u, y + v, groundZ(map, x + u, y + v));
      const h = (1.4 + hash2(x, y, 80 + k) * 1.4) * rc.cam.zoom;
      rc.ctx.strokeStyle = k % 2 ? light : dark;
      rc.ctx.lineWidth = Math.max(0.6, rc.cam.zoom * 0.45);
      rc.ctx.beginPath();
      rc.ctx.moveTo(tx - h * 0.4, ty);
      rc.ctx.lineTo(tx - h * 0.2, ty - h);
      rc.ctx.moveTo(tx, ty);
      rc.ctx.lineTo(tx + h * 0.05, ty - h * 1.15);
      rc.ctx.moveTo(tx + h * 0.4, ty);
      rc.ctx.lineTo(tx + h * 0.25, ty - h * 0.9);
      rc.ctx.stroke();
    }
  }
  if (t !== Terrain.Water && rc.cam.zoom >= 1.5) {
    rc.ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    rc.ctx.lineWidth = 1;
    rc.ctx.beginPath();
    rc.ctx.moveTo(pts[1][0], pts[1][1]);
    rc.ctx.lineTo(pts[2][0], pts[2][1]);
    rc.ctx.lineTo(pts[3][0], pts[3][1]);
    rc.ctx.stroke();
  }

  // Borders: a dashed line where home meets a neighbour (and the inner-German border while it stands).
  if (t !== Terrain.Water && rc.cam.zoom >= 0.5) {
    const era = map.era;
    const edge = (nx: number, ny: number, p: Pt, q: Pt) => {
      if (nx >= map.width || ny >= map.height) return;
      const j = ny * map.width + nx;
      if (map.terrain[j] === Terrain.Water) return;
      const country = map.foreign[i] !== map.foreign[j];
      const zi = map.zoneOf[i] >= 0 ? map.zoneOf[i] : map.zoneOf[j];
      const zone = !country && map.zoneOf[i] !== map.zoneOf[j] && !!era && era.zone[zi] > 0;
      if (!country && !zone) return;
      rc.ctx.strokeStyle = zone ? 'rgba(200,30,30,0.95)' : 'rgba(110,50,150,0.9)';
      rc.ctx.lineWidth = Math.max(1.6, rc.cam.zoom * 1.3);
      rc.ctx.setLineDash([rc.cam.zoom * 3, rc.cam.zoom * 2]);
      rc.ctx.beginPath();
      rc.ctx.moveTo(p[0], p[1]);
      rc.ctx.lineTo(q[0], q[1]);
      rc.ctx.stroke();
      rc.ctx.setLineDash([]);
    };
    edge(x + 1, y, pts[1], pts[2]);
    edge(x, y + 1, pts[2], pts[3]);
  }

  // Map-edge cliffs give the world a diorama slab.
  const dirt: RGB = [110, 84, 58];
  if (x === map.width - 1) {
    poly(rc, [pts[1], pts[2], project(rc.cam, x + 1, y + 1, -2), project(rc.cam, x + 1, y, -2)], paint(dirt, 0.6));
  }
  if (y === map.height - 1) {
    poly(rc, [pts[3], pts[2], project(rc.cam, x + 1, y + 1, -2), project(rc.cam, x, y + 1, -2)], paint(dirt, 0.85));
  }

  if (map.road[i]) drawRoad(rc, idx, x, y);
}

function drawRoad(rc: RC, idx: StaticIndex, x: number, y: number) {
  const { map } = rc;
  const i = y * map.width + x;
  const bridge = map.terrain[i] === Terrain.Water;
  const Z = (u: number, v: number) => (bridge ? 1 : groundZ(map, x + u, y + v) + 0.02);
  const Q = (u: number, v: number) => project(rc.cam, x + u, y + v, Z(u, v));
  const rect = (u0: number, v0: number, u1: number, v1: number, color: string) =>
    poly(rc, [Q(u0, v0), Q(u1, v0), Q(u1, v1), Q(u0, v1)], color);

  const has = (dx: number, dy: number) => {
    const nx = x + dx;
    const ny = y + dy;
    return nx >= 0 && ny >= 0 && nx < map.width && ny < map.height && map.road[ny * map.width + nx] === 1;
  };
  const n = has(0, -1);
  const s = has(0, 1);
  const w = has(-1, 0);
  const e = has(1, 0);

  // Ferries and the tunnel aren't roads on the water: a dashed lane (or a faint line under the sea).
  const kind = bridge ? crossKindAt(map, i) : 0;
  if (kind === CROSS_FERRY || kind === CROSS_TUNNEL) {
    if (rc.cam.zoom < 0.3) return;
    const c = project(rc.cam, x + 0.5, y + 0.5, 0);
    rc.ctx.strokeStyle = kind === CROSS_FERRY ? 'rgba(255,255,255,0.55)' : 'rgba(30,36,60,0.45)';
    rc.ctx.lineWidth = Math.max(1, rc.cam.zoom * (kind === CROSS_FERRY ? 0.7 : 1.1));
    rc.ctx.setLineDash(kind === CROSS_FERRY ? [rc.cam.zoom * 3, rc.cam.zoom * 3] : [rc.cam.zoom * 1.5, rc.cam.zoom * 2.5]);
    rc.ctx.beginPath();
    ([[n, 0.5, 0], [s, 0.5, 1], [w, 0, 0.5], [e, 1, 0.5]] as [boolean, number, number][]).forEach(([on, u, v]) => {
      if (!on) return;
      const p = project(rc.cam, x + u, y + v, 0);
      rc.ctx.moveTo(c[0], c[1]);
      rc.ctx.lineTo(p[0], p[1]);
    });
    rc.ctx.stroke();
    rc.ctx.setLineDash([]);
    return;
  }
  const motorway = !bridge && !!map.motorway?.[i];

  if (bridge) {
    // Piers down to the water.
    [0.25, 0.75].forEach(u => {
      const top = project(rc.cam, x + u, y + 0.5, 1);
      const bot = project(rc.cam, x + u, y + 0.5, 0);
      rc.ctx.fillStyle = paint(C.bridgeRail);
      rc.ctx.fillRect(top[0] - rc.cam.zoom, top[1], rc.cam.zoom * 2, bot[1] - top[1]);
    });
  }

  const urban = idx.urban[i];
  if (urban && !bridge) rect(0.08, 0.08, 0.92, 0.92, paint(C.pavement, 0.95));
  const a = motorway ? 0.2 : 0.3;
  const b = motorway ? 0.8 : 0.7;
  const asphalt = paint(bridge ? C.bridge : C.road, motorway ? 0.86 : 1);
  // A kerb: a slightly wider darker edge under the asphalt.
  if (rc.cam.zoom >= 1.1 && !bridge) {
    const kerb = paint(C.roadEdge, 1.05);
    const k = 0.045;
    rect(a - k, a - k, b + k, b + k, kerb);
    if (n) rect(a - k, 0, b + k, a, kerb);
    if (s) rect(a - k, b, b + k, 1, kerb);
    if (w) rect(0, a - k, a, b + k, kerb);
    if (e) rect(b, a - k, 1, b + k, kerb);
  }
  rect(a, a, b, b, asphalt);
  if (n) rect(a, 0, b, a, asphalt);
  if (s) rect(a, b, b, 1, asphalt);
  if (w) rect(0, a, a, b, asphalt);
  if (e) rect(b, a, 1, b, asphalt);

  if (motorway && rc.cam.zoom >= 0.9) {
    // A central reservation down the middle of the carriageways.
    rc.ctx.strokeStyle = 'rgba(214,222,206,0.85)';
    rc.ctx.lineWidth = Math.max(0.8, rc.cam.zoom * 0.55);
    rc.ctx.beginPath();
    const c = Q(0.5, 0.5);
    ([[n, 0.5, 0], [s, 0.5, 1], [w, 0, 0.5], [e, 1, 0.5]] as [boolean, number, number][]).forEach(([on, u, v]) => {
      if (!on) return;
      const p = Q(u, v);
      rc.ctx.moveTo(c[0], c[1]);
      rc.ctx.lineTo(p[0], p[1]);
    });
    rc.ctx.stroke();
  } else if (rc.cam.zoom >= 1.8) {
    rc.ctx.strokeStyle = paint(C.marking, 1, 0.75);
    rc.ctx.lineWidth = Math.max(0.6, rc.cam.zoom * 0.35);
    rc.ctx.setLineDash([rc.cam.zoom * 2, rc.cam.zoom * 2]);
    rc.ctx.beginPath();
    const c = Q(0.5, 0.5);
    ([[n, 0.5, 0], [s, 0.5, 1], [w, 0, 0.5], [e, 1, 0.5]] as [boolean, number, number][]).forEach(([on, u, v]) => {
      if (!on) return;
      const p = Q(u, v);
      rc.ctx.moveTo(c[0], c[1]);
      rc.ctx.lineTo(p[0], p[1]);
    });
    rc.ctx.stroke();
    rc.ctx.setLineDash([]);
  }
  if (bridge) {
    rc.ctx.strokeStyle = paint(C.bridgeRail);
    rc.ctx.lineWidth = Math.max(0.8, rc.cam.zoom * 0.5);
    rc.ctx.beginPath();
    const rail = (u0: number, v0: number, u1: number, v1: number) => {
      const p0 = project(rc.cam, x + u0, y + v0, 1.35);
      const p1 = project(rc.cam, x + u1, y + v1, 1.35);
      rc.ctx.moveTo(p0[0], p0[1]);
      rc.ctx.lineTo(p1[0], p1[1]);
    };
    if (e || w) {
      rail(0, a, 1, a);
      rail(0, b, 1, b);
    } else {
      rail(a, 0, a, 1);
      rail(b, 0, b, 1);
    }
    rc.ctx.stroke();
  }
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

interface PlacedVehicle {
  v: Vehicle;
  x: number;
  y: number;
  z: number;
  dir: number;
}

function placeVehicles(state: TycoonState, map: WorldMap, alpha: number) {
  const onRoad = new Map<number, PlacedVehicle[]>();
  const atSite = new Map<string, PlacedVehicle[]>(); // `${cityId}:${lot}` of the owner's warehouse
  const atVenue = new Map<string, PlacedVehicle[]>();
  const loose = new Map<number, PlacedVehicle[]>();
  const push = <K>(m: Map<K, PlacedVehicle[]>, k: K, p: PlacedVehicle) => {
    const list = m.get(k);
    if (list) list.push(p);
    else m.set(k, [p]);
  };

  state.vehicles.forEach(v => {
    if ((v.status === 'driving' || v.status === 'broken') && v.route) {
      const moving = v.status === 'driving' ? vehicleSpeed(v) * alpha : 0;
      const pos = positionOnRoute(map, v.route.from, v.route.to, v.route.progress + moving);
      // Keep to the left, TT-style.
      const off = 0.13;
      const ox = pos.dir === 1 ? off : pos.dir === 3 ? -off : 0;
      const oy = pos.dir === 0 ? -off : pos.dir === 2 ? off : 0;
      const x = pos.x + ox;
      const y = pos.y + oy;
      const tile = Math.floor(y) * map.width + Math.floor(x);
      push(onRoad, tile, { v, x, y, z: groundZ(map, x, y), dir: pos.dir });
      return;
    }
    const city = v.cityId ? map.cityById.get(v.cityId) : undefined;
    if (!city) return;
    if (v.status === 'on-site' && v.orders[0]) {
      const gig = state.gigs.find(g => g.id === v.orders[0]);
      if (gig && gig.cityId === city.id) {
        push(atVenue, gig.venueId, { v, x: 0, y: 0, z: 0, dir: 0 });
        return;
      }
    }
    const lot =
      v.owner === 'player'
        ? state.depots.find(d => d.cityId === city.id)?.lot
        : state.rivals.find(r => r.id === v.owner && r.hqCityId === city.id)?.lot;
    if (lot !== undefined) {
      push(atSite, `${city.id}:${lot}`, { v, x: 0, y: 0, z: 0, dir: 0 });
    } else {
      push(loose, city.y * map.width + city.x, { v, x: city.x + 0.5, y: city.y + 0.5, z: groundZ(map, city.x + 0.5, city.y + 0.5), dir: 0 });
    }
  });
  return { onRoad, atSite, atVenue, loose };
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

function nightFactor(hourOfDay: number): number {
  if (hourOfDay >= 7 && hourOfDay < 18) return 0;
  if (hourOfDay >= 18 && hourOfDay < 21) return (hourOfDay - 18) / 3;
  if (hourOfDay >= 5 && hourOfDay < 7) return 1 - (hourOfDay - 5) / 2;
  return 1;
}

export function renderWorld(ctx: CanvasRenderingContext2D, input: RenderInput): HitTargets {
  const { map, state, cam, time, alpha } = input;
  const rc: RC = { ctx, cam, map, time };
  const idx = staticIndex(map);
  const hits: HitTargets = { vehicles: [], markers: [], labels: [] };

  const hourOfDay = (((state.hour + alpha) % 24) + 24) % 24;
  setNight(nightFactor(hourOfDay) * 0.75);

  ctx.fillStyle = paint(C.sea);
  ctx.fillRect(0, 0, cam.w, cam.h);

  const companyRgb = hexToRgb(state.company.color);
  const rivalById = new Map(state.rivals.map(r => [r.id, r]));
  const colorFor = (owner: string): RGB => (owner === 'player' ? companyRgb : hexToRgb(rivalById.get(owner)?.color ?? '#888888'));

  // Which venues have a show on right now (lights, marquee, beams)?
  const today = dayOf(state.hour);
  const liveVenues = new Map<string, RGB>();
  state.gigs.forEach(g => {
    if (g.overseas || g.day !== today || hourOfDay < SHOW_START_HOUR - 1 || hourOfDay >= SHOW_END_HOUR + 1) return;
    if (g.status === 'booked' || g.status === 'done') liveVenues.set(g.venueId, companyRgb);
    else if (g.status === 'rival') liveVenues.set(g.venueId, colorFor(g.rivalId ?? ''));
  });

  // The airport "lights up" (freighters taking off) while any rig is abroad.
  state.gigs.forEach(g => {
    if (!g.overseas || (g.status !== 'booked' && g.status !== 'rival' && g.status !== 'done')) return;
    if (state.hour >= loadInHour(g) && state.hour < loadOutDoneHour(g)) liveVenues.set(g.venueId, companyRgb);
  });

  const lotOwners = new Map<string, { brand: RGB; hq: boolean; seed: number; kind: 'warehouse' | 'delegation'; size: number }>();
  state.rivals.forEach((r, i) => lotOwners.set(`${r.hqCityId}:${r.lot}`, { brand: hexToRgb(r.color), hq: true, seed: 50 + i, kind: 'warehouse', size: r.maxTier >= 4 ? 2 : 1 }));
  state.depots.forEach((d, i) =>
    lotOwners.set(`${d.cityId}:${d.lot}`, { brand: companyRgb, hq: d.cityId === state.company.hqCityId, seed: i, kind: d.kind ?? 'warehouse', size: d.size ?? 1 }),
  );

  const placed = placeVehicles(state, map, alpha);
  const selectedVehicle = input.selection?.kind === 'vehicle' ? input.selection.id : null;
  const venueTop = new Map<string, Pt>();

  const drawPlaced = (p: PlacedVehicle) => {
    const model = getModel(p.v.modelId);
    const pt = drawVehicle(rc, {
      x: p.x,
      y: p.y,
      z: p.z,
      dir: p.dir,
      kind: model.kind,
      color: colorFor(p.v.owner),
      broken: p.v.status === 'broken',
      selected: p.v.id === selectedVehicle,
    });
    if (p.v.owner === 'player') hits.vehicles.push({ id: p.v.id, x: pt[0], y: pt[1] });
  };

  // Visible diagonal range (generous margins for tall things and hills).
  const margin = 140 * cam.zoom;
  const bxMin = cam.x - (cam.w / 2 + margin) / cam.zoom;
  const bxMax = cam.x + (cam.w / 2 + margin) / cam.zoom;
  const byMin = cam.y - (cam.h / 2 + margin) / cam.zoom;
  const byMax = cam.y + (cam.h / 2 + margin * 0.3) / cam.zoom;
  const dMin = Math.max(0, Math.floor((byMin * 2) / TH));
  const dMax = Math.min(map.width + map.height - 2, Math.ceil(((byMax + 60) * 2) / TH));

  // Ferries ply their lanes back and forth.
  const boats = new Map<number, { x: number; y: number; along: 0 | 1 }>();
  lanesOf(map).forEach((lane, li) => {
    if (lane.length < 2) return;
    const span = lane.length - 1;
    const t = (time / 1000 / (span * 1.2) + li * 0.37) % 2;
    const p = (t < 1 ? t : 2 - t) * span;
    const k = Math.min(span - 1, Math.floor(p));
    const a = lane[k];
    const b = lane[k + 1];
    const ax = a % map.width;
    const ay = (a - ax) / map.width;
    const bx = b % map.width;
    const by = (b - bx) / map.width;
    const f = p - k;
    const x = ax + (bx - ax) * f + 0.5;
    const y = ay + (by - ay) * f + 0.5;
    boats.set(Math.floor(y) * map.width + Math.floor(x), { x, y, along: bx !== ax ? 0 : 1 });
  });

  const drawGround = (d: number) => {
    const xLo = Math.max(0, d - map.height + 1, Math.floor(((bxMin * 2) / TW + d) / 2) - 1);
    const xHi = Math.min(map.width - 1, d, Math.ceil(((bxMax * 2) / TW + d) / 2) + 1);
    for (let x = xLo; x <= xHi; x++) drawTile(rc, idx, x, d - x);
  };

  const drawObjects = (d: number) => {
    // bx = (x - y) * TW/2 = (2x - d) * TW/2  →  x range from visible bx range
    const xLo = Math.max(0, d - map.height + 1, Math.floor(((bxMin * 2) / TW + d) / 2) - 1);
    const xHi = Math.min(map.width - 1, d, Math.ceil(((bxMax * 2) / TW + d) / 2) + 1);
    for (let x = xLo; x <= xHi; x++) {
      const y = d - x;
      const ti = y * map.width + x;

      idx.objs.get(ti)?.forEach(o => {
        switch (o.t) {
          case 'tree':
            tree(rc, o.x, o.y, groundZ(map, o.x, o.y), o.size, o.conifer);
            break;
          case 'rock': {
            const [rx, ry] = project(cam, o.x, o.y, groundZ(map, o.x, o.y));
            poly(rc, [[rx - 4 * cam.zoom, ry], [rx - 2 * cam.zoom, ry - 4 * cam.zoom], [rx + 3 * cam.zoom, ry - 3 * cam.zoom], [rx + 4 * cam.zoom, ry]], paint(C.rock));
            break;
          }
          case 'house':
            house(rc, o.x, o.y, tileCorners(map, o.x, o.y)[0], o.floors, o.color, o.x * 131 + o.y);
            break;
          case 'venue': {
            const v = o.venue;
            const top = drawVenue(rc, {
              kind: v.kind,
              x: v.x,
              y: v.y,
              w: v.w,
              h: v.h,
              z: tileCorners(map, v.x, v.y)[0],
              live: liveVenues.has(v.id),
              liveColor: liveVenues.get(v.id) ?? companyRgb,
              seed: v.x * 17 + v.y,
            });
            venueTop.set(v.id, top);
            if (input.selection?.kind === 'venue' && input.selection.id === v.id) outlineFootprint(rc, v.x, v.y, v.w, v.h);
            placed.atVenue.get(v.id)?.forEach((p, k) => {
              const px = v.x + 0.3 + (k % 3) * 0.45;
              const py = v.y + v.h - 0.15 + Math.floor(k / 3) * 0.3;
              drawPlaced({ ...p, x: px, y: py, z: groundZ(map, px, py), dir: 0 });
            });
            break;
          }
          case 'site': {
            const key = `${o.city.id}:${o.lot}`;
            const owner = lotOwners.get(key);
            const s = o.city.lots[o.lot];
            if (!owner) break;
            const z = tileCorners(map, s.x, s.y)[0];
            if (owner.kind === 'delegation') delegation(rc, s.x, s.y, z, owner.brand, owner.seed);
            else warehouse(rc, s.x, s.y, z, owner.brand, owner.seed, owner.hq, owner.size);
            placed.atSite.get(key)?.forEach((p, k) => {
              const px = s.x + 0.32 + (k % 4) * 0.42;
              const py = s.y + 1.68;
              drawPlaced({ ...p, x: px, y: py, z, dir: 0 });
            });
            break;
          }
        }
      });
      const boat = boats.get(ti);
      if (boat) ferry(rc, boat.x, boat.y, boat.along);
      placed.loose.get(ti)?.forEach((p, k) => drawPlaced({ ...p, x: p.x + k * 0.15, y: p.y + 0.2 }));
      placed.onRoad.get(ti)?.forEach(drawPlaced);
    }
  };

  // Painter's order, with objects trailing the ground by SHADOW_LAG diagonals: a shadow (at most
  // that many diagonals long) lands on ground that's already drawn, while a hill more than that far
  // in front still hides what's behind it.
  for (let d = dMin; d <= dMax + SHADOW_LAG; d++) {
    if (d <= dMax) drawGround(d);
    if (d - SHADOW_LAG >= dMin) drawObjects(d - SHADOW_LAG);
  }

  // Hover cursor.
  if (input.hover) {
    const { x, y } = input.hover;
    const [a, b, c, dd] = tileCorners(map, x, y);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(1, cam.zoom * 0.6);
    ctx.beginPath();
    const pts = [project(cam, x, y, a), project(cam, x + 1, y, b), project(cam, x + 1, y + 1, c), project(cam, x, y + 1, dd)];
    ctx.moveTo(pts[0][0], pts[0][1]);
    pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.closePath();
    ctx.stroke();
  }
  if (input.selection?.kind === 'city') {
    const city = map.cityById.get(input.selection.id);
    if (city) outlineFootprint(rc, city.x - city.radius, city.y - city.radius, city.radius * 2 + 1, city.radius * 2 + 1);
  }

  // Floodlight beams over live shows, after dark.
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  liveVenues.forEach((color, venueId) => {
    const top = venueTop.get(venueId);
    if (!top || hourOfDay < SHOW_START_HOUR - 1) return;
    for (let k = 0; k < 3; k++) {
      const ang = -Math.PI / 2 + Math.sin(time / 700 + k * 2.1) * 0.6;
      const len = 120 * cam.zoom;
      const spread = 0.08;
      ctx.beginPath();
      ctx.moveTo(top[0], top[1] + 10 * cam.zoom);
      ctx.lineTo(top[0] + Math.cos(ang - spread) * len, top[1] + Math.sin(ang - spread) * len);
      ctx.lineTo(top[0] + Math.cos(ang + spread) * len, top[1] + Math.sin(ang + spread) * len);
      ctx.closePath();
      ctx.fillStyle = glow(k === 1 ? [255, 255, 255] : color, 0.16);
      ctx.fill();
    }
  });
  ctx.restore();

  const planned = selectedVehicle ? state.vehicles.find(v => v.id === selectedVehicle) : undefined;
  if (planned && planned.owner === 'player') drawRoutePlan(rc, state, planned);
  const markers = layoutGigMarkers(rc, state, venueTop, colorFor);
  drawCityLabels(rc, state, hits, markers.map(m => m.rect));
  drawGigMarkers(rc, markers, hits);
  return hits;
}

/** The selected truck's plan: where it is, each show it's heading to in order, and the way home. */
function drawRoutePlan(rc: RC, state: TycoonState, v: Vehicle) {
  const { ctx, cam, map } = rc;
  const stops: { cityId: string; label: string }[] = [];
  const here = v.status === 'driving' || v.status === 'broken' ? v.route?.to : v.cityId;
  if (here) stops.push({ cityId: here, label: '' });
  v.orders.forEach(id => {
    const g = state.gigs.find(x => x.id === id);
    if (!g || g.status !== 'booked') return;
    if (stops[stops.length - 1]?.cityId !== g.cityId) stops.push({ cityId: g.cityId, label: String(stops.length) });
  });
  if (stops.length < 1 || (stops.length === 1 && stops[0].cityId === v.homeCityId)) return;
  const last = stops[stops.length - 1];
  const homeLeg = last.cityId !== v.homeCityId;
  const trace = (a: string, b: string, style: { color: string; width: number; dash: number[] }) => {
    const path = getCityPath(map, a, b);
    if (path.length < 2) return;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = style.width * cam.zoom;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(style.dash.map(d => d * cam.zoom));
    ctx.beginPath();
    path.forEach((idx, i) => {
      const tx = idx % map.width;
      const ty = Math.floor(idx / map.width);
      const [sx, sy] = project(cam, tx + 0.5, ty + 0.5, groundZ(map, tx, ty));
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    });
    ctx.stroke();
  };
  ctx.save();
  // A dark casing under each line so it reads over any terrain.
  const legs: [string, string, boolean][] = stops.slice(1).map((s, i) => [stops[i].cityId, s.cityId, false]);
  if (homeLeg) legs.push([last.cityId, v.homeCityId, true]);
  legs.forEach(([a, b, home]) => trace(a, b, { color: 'rgba(0,0,0,0.45)', width: home ? 4 : 5.5, dash: [] }));
  legs.forEach(([a, b, home]) => trace(a, b, home ? { color: 'rgba(255,255,255,0.55)', width: 2, dash: [3, 4] } : { color: state.company.color, width: 3.2, dash: [8, 5] }));
  ctx.setLineDash([]);
  // Numbered stops.
  stops.forEach(s => {
    if (!s.label) return;
    const city = map.cityById.get(s.cityId);
    if (!city) return;
    const [sx, sy] = project(cam, city.x + 0.5, city.y + 0.5, groundZ(map, city.x, city.y));
    const r = 9 * Math.max(0.9, Math.min(1.3, cam.zoom * 0.7));
    ctx.beginPath();
    ctx.arc(sx, sy - r * 1.4, r, 0, Math.PI * 2);
    ctx.fillStyle = state.company.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `800 ${Math.round(r * 1.2)}px ui-rounded, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(s.label, sx, sy - r * 1.4 + 0.5);
  });
  ctx.restore();
}

function outlineFootprint(rc: RC, x: number, y: number, w: number, h: number) {
  const { ctx, cam, map } = rc;
  const z = (fx: number, fy: number) => groundZ(map, fx, fy);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(1, cam.zoom * 0.7);
  ctx.setLineDash([4 * cam.zoom, 3 * cam.zoom]);
  ctx.beginPath();
  const pts = [project(cam, x, y, z(x, y)), project(cam, x + w, y, z(x + w, y)), project(cam, x + w, y + h, z(x + w, y + h)), project(cam, x, y + h, z(x, y + h))];
  ctx.moveTo(pts[0][0], pts[0][1]);
  pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);
}

type Rect = { x: number; y: number; w: number; h: number };
const overlaps = (a: Rect, b: Rect, pad = 2) =>
  a.x < b.x + b.w + pad && b.x < a.x + a.w + pad && a.y < b.y + b.h + pad && b.y < a.y + a.h + pad;

/**
 * Town name tags, most important first (your bases, then the biggest towns): a tag that would
 * overlap one already placed — or a show marker — is left out rather than piled on top.
 */
function drawCityLabels(rc: RC, state: TycoonState, hits: HitTargets, taken: Rect[]) {
  const { ctx, cam, map } = rc;
  const scale = Math.max(0.85, Math.min(1.25, cam.zoom * 0.6));
  const hasDepot = (id: string) => state.depots.some(d => d.cityId === id);
  const towns = [...map.cities, ...map.abroad].sort(
    (a, b) => Number(hasDepot(b.id)) - Number(hasDepot(a.id)) || b.population - a.population,
  );
  towns.forEach(city => {
    if (cam.zoom < 0.7 && city.size === 'village' && !hasDepot(city.id)) return;
    // Anchor at the town's front edge (straight down-screen from the centre)
    // so the label never sits on top of the venues.
    const edge = city.radius * 0.75 + 1;
    const [sx, sy0] = project(cam, city.x + 0.5 + edge, city.y + 0.5 + edge, groundZ(map, city.x, city.y));
    const sy = sy0 + 12;
    if (sx < -100 || sx > cam.w + 100 || sy < -40 || sy > cam.h + 40) return;
    const name = city.abroad ? `${city.abroad.flag} ${city.name}` : city.name;
    const pop = city.population >= 1_000_000 ? `${(city.population / 1e6).toFixed(city.population >= 1e7 ? 0 : 1)}M` : `${Math.round(city.population / 1000)}k`;
    ctx.font = `700 ${Math.round(12 * scale)}px ui-rounded, system-ui, sans-serif`;
    const w = ctx.measureText(name).width + 34 * scale;
    const h = 18 * scale;
    const rect = { x: sx - w / 2, y: sy - h / 2, w, h };
    const mine = hasDepot(city.id);
    // Slide a big town's tag down past whatever's in the way; small towns just give way.
    const big = city.size === 'city' || city.size === 'metropolis';
    for (let k = 0; k < (big ? 3 : 1) && !mine && taken.some(t => overlaps(t, rect)); k++) {
      if (k > 0 || big) rect.y += h + 3;
    }
    if (!mine && !big && taken.some(t => overlaps(t, rect))) return;
    taken.push(rect);
    ctx.fillStyle = city.abroad ? 'rgba(52,44,70,0.78)' : 'rgba(16,18,26,0.78)';
    roundRect(ctx, rect.x, rect.y, w, h, 4 * scale);
    ctx.fill();
    if (mine) {
      ctx.strokeStyle = state.company.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const ty = rect.y + h / 2;
    ctx.fillText(name, sx - w / 2 + 6 * scale, ty + 0.5);
    ctx.font = `500 ${Math.round(9 * scale)}px ui-rounded, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(pop, sx + w / 2 - 5 * scale, ty + 1);
    hits.labels.push({ cityId: city.id, ...rect });
  });
}

interface MarkerLayout {
  gigs: Gig[];
  venueId: string;
  cityId?: string;
  x: number;
  y: number;
  stem: number;
  rect: Rect;
  label: string;
  bg: string;
  fg: string;
  font: string;
}

/** Zoomed out, a town's shows share one marker; closer in, each venue gets its own, stacked if they'd collide. */
const MARKERS_PER_TOWN_BELOW = 0.75;

function layoutGigMarkers(rc: RC, state: TycoonState, venueTop: Map<string, Pt>, colorFor: (o: string) => RGB): MarkerLayout[] {
  const { ctx, cam, time, map } = rc;
  const today = dayOf(state.hour);
  const perTown = cam.zoom < MARKERS_PER_TOWN_BELOW;
  const groups = new Map<string, Gig[]>();
  state.gigs.forEach(g => {
    const relevant = (g.status === 'offer' && g.acceptByDay >= today) || g.status === 'booked' || (g.status === 'rival' && !g.result);
    if (!relevant) return;
    const key = perTown ? g.cityId : g.venueId;
    const list = groups.get(key);
    if (list) list.push(g);
    else groups.set(key, [g]);
  });

  const scale = Math.max(0.85, Math.min(1.2, cam.zoom * 0.55));
  const font = `700 ${Math.round(11 * scale)}px ui-rounded, system-ui, sans-serif`;
  ctx.font = font;
  const rank = (g: Gig) => (g.status === 'booked' ? 0 : g.status === 'offer' ? 1 : 2);
  const out: MarkerLayout[] = [];
  [...groups.entries()]
    .map(([key, gigs]) => {
      gigs.sort((a, b) => rank(a) - rank(b) || b.fee - a.fee || a.day - b.day);
      return { key, gigs };
    })
    // Your booked shows get placed first, then the richest offers.
    .sort((a, b) => rank(a.gigs[0]) - rank(b.gigs[0]) || b.gigs[0].fee - a.gigs[0].fee)
    .forEach(({ key, gigs }) => {
      const g = gigs[0];
      const top = perTown
        ? (() => {
            const c = map.cityById.get(key);
            return c ? project(cam, c.x + 0.5, c.y + 0.5, groundZ(map, c.x, c.y) + 1.5) : undefined;
          })()
        : venueTop.get(key);
      if (!top) return;
      const bob = Math.sin(time / 380 + top[0]) * 2.5;
      let label: string;
      let bg: string;
      let fg = '#fff';
      const booked = gigs.filter(x => x.status === 'booked').length;
      const offers = gigs.filter(x => x.status === 'offer').length;
      if (g.status === 'booked') {
        const days = g.day - today;
        label = g.overseas ? `★ ✈ ${Math.max(0, days)}d` : days <= 0 ? '★ TONIGHT' : `★ ${days}d`;
        if (perTown && booked > 1) label = `★ ${booked} booked`;
        bg = state.company.color;
      } else if (g.status === 'offer') {
        const locked = !!gigBookingBar(state, g).reason;
        label = perTown && offers > 1 ? `${offers} offers · ${kmoney(g.fee)}` : `${g.tourId ? 'TOUR ' : ''}${locked ? '🔒 ' : g.asksForYou ? '♥ ' : ''}${kmoney(g.fee)}`;
        bg = locked ? '#3f3f46' : tierInfo(g.tier).color;
        fg = locked ? '#a1a1aa' : '#0b0d12';
      } else {
        label = '●';
        const c = colorFor(g.rivalId ?? '');
        bg = `rgb(${c[0]},${c[1]},${c[2]})`;
      }
      if (!perTown && gigs.length > 1) label += ` +${gigs.length - 1}`;
      const w = ctx.measureText(label).width + 12 * scale;
      const h = 17 * scale;
      let y = top[1] - 14 * scale + bob;
      let rect = { x: top[0] - w / 2, y: y - h, w, h };
      // Stack upwards out of the way of markers already placed; give up after a few tries.
      for (let tries = 0; tries < 4 && out.some(m => overlaps(m.rect, rect)); tries++) {
        y -= h + 3;
        rect = { x: top[0] - w / 2, y: y - h, w, h };
      }
      if (out.some(m => overlaps(m.rect, rect))) return;
      out.push({ gigs, venueId: perTown ? g.venueId : key, cityId: perTown ? key : undefined, x: top[0], y, stem: top[1], rect, label, bg, fg, font });
    });
  return out;
}

function drawGigMarkers(rc: RC, layouts: MarkerLayout[], hits: HitTargets) {
  const { ctx } = rc;
  layouts.forEach(m => {
    ctx.font = m.font;
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(m.x, m.y);
    ctx.lineTo(m.x, m.stem);
    ctx.stroke();
    ctx.fillStyle = m.bg;
    roundRect(ctx, m.rect.x, m.rect.y, m.rect.w, m.rect.h, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = m.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(m.label, m.x, m.rect.y + m.rect.h / 2 + 0.5);
    hits.markers.push({ gigIds: m.gigs.map(g => g.id), venueId: m.venueId, cityId: m.cityId, ...m.rect });
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
