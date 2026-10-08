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
import { dayOf, loadInHour, loadOutDoneHour } from '@/world/core';
import { getCountry } from '@/world/content/countries';
import { tileCorners } from '@/world/mapgen';
import { getCityPath, positionOnPath } from '@/world/pathfinding';
import { Terrain, type City, type Gig, type TycoonState, type Venue, type Vehicle, type WorldMap } from '@/world/types';
import { TH, TW, groundZ, project, type Camera, type Pt } from './iso';
import { C, glow, hexToRgb, paint, setNight, type RGB } from './palette';
import { delegation, hash2, house, poly, tree, venue as drawVenue, vehicle as drawVehicle, warehouse, type RC } from './sprites';

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
  markers: { gigIds: string[]; venueId: string; x: number; y: number; w: number; h: number }[];
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

  map.cities.forEach(city => {
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
      if (occupied[i] || map.road[i]) continue;
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
  poly(rc, pts, paint(base, slopeLight * variation));

  if (t === Terrain.Water) {
    // Drifting glints.
    const phase = (rc.time / 1400 + hash2(x, y, 9)) % 1;
    if (phase < 0.35 && rc.cam.zoom >= 0.9) {
      const [gx, gy] = project(rc.cam, x + 0.3 + phase, y + 0.5, 0);
      rc.ctx.fillStyle = paint(C.waterGlint, 1, 0.55);
      rc.ctx.fillRect(gx, gy, 4 * rc.cam.zoom, Math.max(1, rc.cam.zoom * 0.6));
    }
  } else if (rc.cam.zoom >= 1.5) {
    rc.ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    rc.ctx.lineWidth = 1;
    rc.ctx.beginPath();
    rc.ctx.moveTo(pts[1][0], pts[1][1]);
    rc.ctx.lineTo(pts[2][0], pts[2][1]);
    rc.ctx.lineTo(pts[3][0], pts[3][1]);
    rc.ctx.stroke();
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
  const a = 0.3;
  const b = 0.7;
  const asphalt = paint(bridge ? C.bridge : C.road);
  rect(a, a, b, b, asphalt);
  if (n) rect(a, 0, b, a, asphalt);
  if (s) rect(a, b, b, 1, asphalt);
  if (w) rect(0, a, a, b, asphalt);
  if (e) rect(b, a, 1, b, asphalt);

  if (rc.cam.zoom >= 1.8) {
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
      const path = getCityPath(map, v.route.from, v.route.to);
      const moving = v.status === 'driving' ? getModel(v.modelId).speed * alpha : 0;
      const pos = positionOnPath(map, path, v.route.progress + moving);
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

  for (let d = dMin; d <= dMax; d++) {
    // bx = (x - y) * TW/2 = (2x - d) * TW/2  →  x range from visible bx range
    const xLo = Math.max(0, d - map.height + 1, Math.floor(((bxMin * 2) / TW + d) / 2) - 1);
    const xHi = Math.min(map.width - 1, d, Math.ceil(((bxMax * 2) / TW + d) / 2) + 1);
    for (let x = xLo; x <= xHi; x++) {
      const y = d - x;
      drawTile(rc, idx, x, y);
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
      placed.loose.get(ti)?.forEach((p, k) => drawPlaced({ ...p, x: p.x + k * 0.15, y: p.y + 0.2 }));
      placed.onRoad.get(ti)?.forEach(drawPlaced);
    }
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

  drawCityLabels(rc, state, hits);
  drawGigMarkers(rc, state, venueTop, hits, colorFor);
  return hits;
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

function drawCityLabels(rc: RC, state: TycoonState, hits: HitTargets) {
  const { ctx, cam, map } = rc;
  const scale = Math.max(0.85, Math.min(1.25, cam.zoom * 0.6));
  map.cities.forEach(city => {
    if (cam.zoom < 0.7 && city.size === 'village') return;
    // Anchor at the town's front edge (straight down-screen from the centre)
    // so the label never sits on top of the venues.
    const edge = city.radius * 0.75 + 1;
    const [sx, sy0] = project(cam, city.x + 0.5 + edge, city.y + 0.5 + edge, groundZ(map, city.x, city.y));
    const sy = sy0 + 12;
    if (sx < -100 || sx > cam.w + 100 || sy < -40 || sy > cam.h + 40) return;
    const name = city.name;
    const pop = city.population >= 1_000_000 ? `${(city.population / 1e6).toFixed(city.population >= 1e7 ? 0 : 1)}M` : `${Math.round(city.population / 1000)}k`;
    ctx.font = `700 ${Math.round(12 * scale)}px ui-rounded, system-ui, sans-serif`;
    const w = ctx.measureText(name).width + 34 * scale;
    const h = 18 * scale;
    const hasDepot = state.depots.some(d => d.cityId === city.id);
    ctx.fillStyle = 'rgba(16,18,26,0.78)';
    roundRect(ctx, sx - w / 2, sy - h / 2, w, h, 4 * scale);
    ctx.fill();
    if (hasDepot) {
      ctx.strokeStyle = state.company.color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, sx - w / 2 + 6 * scale, sy + 0.5);
    ctx.font = `500 ${Math.round(9 * scale)}px ui-rounded, system-ui, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.textAlign = 'right';
    ctx.fillText(pop, sx + w / 2 - 5 * scale, sy + 1);
    hits.labels.push({ cityId: city.id, x: sx - w / 2, y: sy - h / 2, w, h });
  });
}

function drawGigMarkers(rc: RC, state: TycoonState, venueTop: Map<string, Pt>, hits: HitTargets, colorFor: (o: string) => RGB) {
  const { ctx, cam, time } = rc;
  const today = dayOf(state.hour);
  const byVenue = new Map<string, Gig[]>();
  state.gigs.forEach(g => {
    const relevant =
      (g.status === 'offer' && g.acceptByDay >= today) ||
      (g.status === 'booked') ||
      (g.status === 'rival' && !g.result);
    if (!relevant) return;
    const list = byVenue.get(g.venueId);
    if (list) list.push(g);
    else byVenue.set(g.venueId, [g]);
  });

  const scale = Math.max(0.85, Math.min(1.2, cam.zoom * 0.55));
  const cur = getCountry(state.country).currency;
  byVenue.forEach((gigs, venueId) => {
    const top = venueTop.get(venueId);
    if (!top) return;
    const rank = (g: Gig) => (g.status === 'booked' ? 0 : g.status === 'offer' ? 1 : 2);
    gigs.sort((a, b) => rank(a) - rank(b) || a.day - b.day);
    const g = gigs[0];
    const bob = Math.sin(time / 380 + top[0]) * 2.5;
    const x = top[0];
    const y = top[1] - 14 * scale + bob;

    let label: string;
    let bg: string;
    let fg = '#fff';
    if (g.status === 'booked') {
      const days = g.day - today;
      label = g.overseas ? `★ ✈ ${Math.max(0, days)}d` : days <= 0 ? '★ TONIGHT' : `★ ${days}d`;
      bg = state.company.color;
    } else if (g.status === 'offer') {
      const locked = !!gigBookingBar(state, g).reason;
      label = `${g.tourId ? 'TOUR ' : ''}${locked ? '🔒 ' : g.asksForYou ? '♥ ' : ''}${cur}${g.fee >= 10000 ? `${Math.round(g.fee / 1000)}k` : `${(g.fee / 1000).toFixed(1)}k`}`;
      bg = locked ? '#3f3f46' : tierInfo(g.tier).color;
      fg = locked ? '#a1a1aa' : '#0b0d12';
    } else {
      label = '●';
      const c = colorFor(g.rivalId ?? '');
      bg = `rgb(${c[0]},${c[1]},${c[2]})`;
    }
    if (gigs.length > 1) label += ` +${gigs.length - 1}`;

    ctx.font = `700 ${Math.round(11 * scale)}px ui-rounded, system-ui, sans-serif`;
    const w = ctx.measureText(label).width + 12 * scale;
    const h = 17 * scale;
    // Stem + pin.
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, top[1]);
    ctx.stroke();
    ctx.fillStyle = bg;
    roundRect(ctx, x - w / 2, y - h, w, h, 5 * scale);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y - h / 2 + 0.5);
    hits.markers.push({ gigIds: gigs.map(x2 => x2.id), venueId, x: x - w / 2, y: y - h, w, h });
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
