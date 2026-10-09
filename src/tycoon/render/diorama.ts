/**
 * Close-up isometric dioramas for the base and venue windows: a cutaway room
 * (back walls only, TT-style) drawn with the same box/face helpers as the map.
 * Everything is procedural and driven by the game state passed in — the racks
 * hold your actual stock, the staff you actually employ are at work, and a
 * venue shows what's happening there right now.
 */
import type { WorldMap } from '@/world/types';
import { toBase, type Camera, type Pt } from './iso';
import { C, getNight, glow, paint, setNight, type RGB } from './palette';
import { faceQuad, groundQuad, leftFace, poly, prism, rightFace, type Box, type RC } from './sprites';
import { project } from './iso';

// ---------------------------------------------------------------------------
// Scene plumbing
// ---------------------------------------------------------------------------

interface Item {
  depth: number;
  draw: () => void;
}

export interface Scene {
  rc: RC;
  W: number;
  D: number;
  H: number;
  items: Item[];
  time: number;
}

/** Fits a W×D×H room into the canvas. */
function makeScene(ctx: CanvasRenderingContext2D, w: number, h: number, W: number, D: number, H: number, time: number, open = false): Scene {
  const corners: Pt[] = [
    toBase(0, 0, H),
    toBase(W, 0, open ? 0 : H),
    toBase(0, D, open ? 0 : H),
    toBase(W, D, 0),
    toBase(W, 0, 0),
    toBase(0, D, 0),
  ];
  const xs = corners.map(c => c[0]);
  const ys = corners.map(c => c[1]);
  const bw = Math.max(...xs) - Math.min(...xs);
  const bh = Math.max(...ys) - Math.min(...ys);
  const zoom = Math.min((w - 12) / bw, (h - 10) / bh);
  const cam: Camera = { x: (Math.max(...xs) + Math.min(...xs)) / 2, y: (Math.max(...ys) + Math.min(...ys)) / 2, zoom, w, h };
  return { rc: { ctx, cam, map: {} as WorldMap, time }, W, D, H, items: [], time };
}

const add = (sc: Scene, x: number, y: number, draw: () => void) => sc.items.push({ depth: x + y, draw });

function flush(sc: Scene) {
  sc.items.sort((a, b) => a.depth - b.depth).forEach(i => i.draw());
  sc.items = [];
}

const P = (sc: Scene, x: number, y: number, z: number) => project(sc.rc.cam, x, y, z);

/** Deterministic pseudo-random in [0,1) from a few ints. */
function rnd(a: number, b = 0, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hexRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function floor(sc: Scene, color: RGB, grid?: RGB) {
  groundQuad(sc.rc, 0, 0, sc.W, sc.D, 0, paint(color));
  if (!grid) return;
  const { ctx } = sc.rc;
  ctx.strokeStyle = paint(grid, 1, 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < sc.W; x++) {
    const a = P(sc, x, 0, 0);
    const b = P(sc, x, sc.D, 0);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  for (let y = 1; y < sc.D; y++) {
    const a = P(sc, 0, y, 0);
    const b = P(sc, sc.W, y, 0);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
}

/** The two back walls (the cutaway hides the front ones). */
function backWalls(sc: Scene, wall: RGB, band?: RGB) {
  const left: Box = { x0: -0.25, y0: 0, x1: 0, y1: sc.D, z0: 0, z1: sc.H };
  const right: Box = { x0: 0, y0: -0.25, x1: sc.W, y1: 0, z0: 0, z1: sc.H };
  prism(sc.rc, right, wall, [90, 92, 98], false);
  prism(sc.rc, left, wall, [90, 92, 98], false);
  if (band) {
    poly(sc.rc, faceQuad(leftFace(sc.rc, right), 0, 1, 0.78, 0.86), paint(band, 0.95));
    poly(sc.rc, faceQuad(rightFace(sc.rc, left), 0, 1, 0.78, 0.86), paint(band, 0.75));
  }
}

function flightCase(sc: Scene, x: number, y: number, z: number, color: RGB, w = 0.42, d = 0.42, h = 0.9) {
  const b: Box = { x0: x, y0: y, x1: x + w, y1: y + d, z0: z, z1: z + h };
  prism(sc.rc, b, [44, 44, 50], [62, 62, 70]);
  poly(sc.rc, faceQuad(leftFace(sc.rc, b), 0.1, 0.9, 0.55, 0.75), paint(color, 1.05));
  poly(sc.rc, faceQuad(rightFace(sc.rc, b), 0.1, 0.9, 0.55, 0.75), paint(color, 0.85));
}

/** A little person, with an optional bob for walking/dancing. */
function person(sc: Scene, x: number, y: number, z: number, shirt: RGB, bob = 0, scale = 1) {
  const s = 0.11 * scale;
  const zb = z + bob;
  prism(sc.rc, { x0: x - s, y0: y - s, x1: x + s, y1: y + s, z0: zb, z1: zb + 1.0 * scale }, [48, 52, 70], [48, 52, 70], false);
  prism(sc.rc, { x0: x - s * 1.25, y0: y - s * 1.1, x1: x + s * 1.25, y1: y + s * 1.1, z0: zb + 1.0 * scale, z1: zb + 1.9 * scale }, shirt, shirt, false);
  const [hx, hy] = P(sc, x, y, zb + 2.25 * scale);
  const r = Math.max(1.2, 2.4 * sc.rc.cam.zoom * scale);
  sc.rc.ctx.fillStyle = paint([232, 190, 160]);
  sc.rc.ctx.beginPath();
  sc.rc.ctx.arc(hx, hy, r, 0, Math.PI * 2);
  sc.rc.ctx.fill();
}

const SHIRTS: RGB[] = [
  [30, 30, 34],
  [30, 30, 34],
  [52, 64, 96],
  [140, 40, 48],
  [60, 110, 70],
  [200, 160, 60],
];

function rack(sc: Scene, x0: number, y0: number, along: 'x' | 'y', length: number, levels: number, fill: (slot: number) => RGB | null) {
  const depth = 0.55;
  const levelH = 1.25;
  const slotsPerLevel = Math.floor(length / 0.5);
  const box = (u0: number, u1: number, z0: number, z1: number, d0 = 0, d1 = depth): Box =>
    along === 'x' ? { x0: x0 + u0, x1: x0 + u1, y0: y0 + d0, y1: y0 + d1, z0, z1 } : { x0: x0 + d0, x1: x0 + d1, y0: y0 + u0, y1: y0 + u1, z0, z1 };
  // Uprights (orange) and beams (blue), like real pallet racking.
  for (let i = 0; i <= Math.ceil(length / 2); i++) {
    const u = Math.min(length - 0.08, i * 2);
    prism(sc.rc, box(u, u + 0.08, 0, levels * levelH + 0.2), [220, 120, 40], [220, 120, 40], false);
  }
  for (let l = 0; l < levels; l++) {
    const z = l * levelH;
    prism(sc.rc, box(0, length, z + 0.05, z + 0.15), [40, 90, 170], [60, 110, 190], false);
    for (let k = 0; k < slotsPerLevel; k++) {
      const c = fill(l * slotsPerLevel + k);
      if (!c) continue;
      const u = 0.06 + k * 0.5;
      const b = box(u, u + 0.42, z + 0.15, z + 1.0, 0.06, 0.48);
      prism(sc.rc, b, [44, 44, 50], [62, 62, 70], false);
      poly(sc.rc, faceQuad(along === 'x' ? leftFace(sc.rc, b) : rightFace(sc.rc, b), 0.12, 0.88, 0.5, 0.72), paint(c));
    }
  }
}

function desk(sc: Scene, x: number, y: number, year: number, staffed: boolean, shirt: RGB) {
  prism(sc.rc, { x0: x, y0: y, x1: x + 0.9, y1: y + 0.5, z0: 0, z1: 0.75 }, [150, 120, 90], [176, 146, 112]);
  if (year < 1998) prism(sc.rc, { x0: x + 0.3, y0: y + 0.05, x1: x + 0.62, y1: y + 0.35, z0: 0.75, z1: 1.3 }, [214, 206, 186], [200, 194, 176]);
  else prism(sc.rc, { x0: x + 0.25, y0: y + 0.05, x1: x + 0.7, y1: y + 0.1, z0: 0.85, z1: 1.45 }, [30, 30, 36], [30, 30, 36]);
  const [sx, sy] = P(sc, x + 0.47, y + 0.12, 1.1);
  sc.rc.ctx.fillStyle = glow(year < 1998 ? [120, 220, 140] : [140, 190, 255], 0.8);
  sc.rc.ctx.fillRect(sx - 2 * sc.rc.cam.zoom, sy - 1.2 * sc.rc.cam.zoom, 4 * sc.rc.cam.zoom, 2.4 * sc.rc.cam.zoom);
  if (staffed) person(sc, x + 0.45, y + 0.85, 0, shirt, 0, 0.85);
}

function forklift(sc: Scene, x: number, y: number, t: number) {
  const dx = Math.sin(t / 1800) * 0.6;
  const fx = x + dx;
  prism(sc.rc, { x0: fx, y0: y, x1: fx + 0.7, y1: y + 0.5, z0: 0.15, z1: 0.9 }, [240, 190, 30], [250, 210, 60]);
  prism(sc.rc, { x0: fx + 0.7, y0: y + 0.05, x1: fx + 0.78, y1: y + 0.45, z0: 0.1, z1: 2.4 }, [60, 60, 64], [60, 60, 64], false);
  prism(sc.rc, { x0: fx + 0.15, y0: y + 0.1, x1: fx + 0.45, y1: y + 0.4, z0: 0.9, z1: 1.8 }, [60, 60, 64], [40, 40, 44], false);
}

/** A vehicle backed into a loading bay, nose towards the viewer, drawn at room scale. */
function bayVehicle(sc: Scene, x: number, y: number, kind: 'van' | 'truck' | 'semi' | 'bus', color: RGB) {
  const dims = { van: [1.5, 1.3, 0], truck: [2.3, 2.0, 0.7], semi: [3.3, 2.3, 0.8], bus: [3.0, 2.1, 0] }[kind];
  const [len, tall, cab] = dims;
  const hw = 0.42;
  // Wheels.
  [y - len + 0.4, y - 0.45].forEach(wy => prism(sc.rc, { x0: x - hw - 0.04, y0: wy - 0.18, x1: x + hw + 0.04, y1: wy + 0.18, z0: 0, z1: 0.35 }, [24, 24, 28], [24, 24, 28], false));
  if (cab) {
    const body: Box = { x0: x - hw, y0: y - len, x1: x + hw, y1: y - cab - 0.05, z0: 0.3, z1: tall };
    prism(sc.rc, body, kind === 'semi' ? [228, 228, 232] : color, [220, 220, 224]);
    poly(sc.rc, faceQuad(rightFace(sc.rc, body), 0.08, 0.92, 0.4, 0.65), paint(kind === 'semi' ? color : [235, 235, 238]));
    const cabBox: Box = { x0: x - hw, y0: y - cab, x1: x + hw, y1: y, z0: 0.3, z1: tall * 0.72 };
    prism(sc.rc, cabBox, color, color);
    poly(sc.rc, faceQuad(leftFace(sc.rc, cabBox), 0.12, 0.88, 0.55, 0.88), paint([40, 54, 70]));
  } else {
    const body: Box = { x0: x - hw, y0: y - len, x1: x + hw, y1: y, z0: 0.3, z1: tall };
    prism(sc.rc, body, color, [225, 225, 228]);
    poly(sc.rc, faceQuad(leftFace(sc.rc, body), 0.1, 0.9, 0.55, 0.85), paint([40, 54, 70]));
    poly(sc.rc, faceQuad(rightFace(sc.rc, body), 0.05, 0.6, 0.55, 0.8), paint([40, 54, 70]));
  }
}

// ---------------------------------------------------------------------------
// Bases
// ---------------------------------------------------------------------------

export interface BaseSceneInput {
  kind: 'warehouse' | 'delegation';
  size: number;
  brand: string;
  year: number;
  /** Units on the racks, per department colour (hex). */
  stock: { color: string; units: number }[];
  prepStaff: number;
  officeStaff: number;
  gigTechs: number;
  workshop: 'none' | 'basic' | 'full';
  /** Annex levels (annexes.ts): rehearsal stage, workshop bench, crew lounge. */
  rehearsal?: number;
  bench?: number;
  lounge?: number;
  /** Vehicles parked at the base. */
  vehicles: { kind: 'van' | 'truck' | 'semi' | 'bus' }[];
  /** Vehicles out on jobs (empty bays). */
  away: number;
}

export function drawBaseScene(ctx: CanvasRenderingContext2D, w: number, h: number, input: BaseSceneInput, time: number) {
  const prevNight = getNight();
  setNight(0);
  const brand = hexRgb(input.brand);
  if (input.kind === 'delegation') drawDelegation(ctx, w, h, input, brand, time);
  else drawWarehouse(ctx, w, h, input, brand, time);
  setNight(prevNight);
}

function stockColors(input: BaseSceneInput, slots: number): (RGB | null)[] {
  const total = input.stock.reduce((s, x) => s + x.units, 0);
  const shown = Math.min(slots, total);
  const out: (RGB | null)[] = [];
  input.stock.forEach(s => {
    const n = total ? Math.round((s.units / total) * shown) : 0;
    for (let i = 0; i < n; i++) out.push(hexRgb(s.color));
  });
  while (out.length < slots) out.push(null);
  return out.slice(0, slots);
}

function drawWarehouse(ctx: CanvasRenderingContext2D, w: number, h: number, input: BaseSceneInput, brand: RGB, time: number) {
  const W0 = [0, 10, 12, 14, 16][input.size] ?? 10;
  const D = [0, 7, 8, 9, 10][input.size] ?? 7;
  const stage = input.rehearsal ?? 0;
  // A soundstage annex runs along the right-hand side.
  const W = W0 + (stage ? 4.2 : 0);
  const sc = makeScene(ctx, w, h, W, D, 6, time);
  floor(sc, [176, 176, 170], [120, 120, 116]);
  // Safety walkway and the brand painted on the floor.
  groundQuad(sc.rc, 0.2, D - 2.6, W - 0.2, D - 2.45, 0, paint([240, 200, 40]));
  backWalls(sc, [206, 208, 212], brand);
  // Roller doors on the back-right wall.
  const doorWall: Box = { x0: 0, y0: -0.25, x1: W0, y1: 0, z0: 0, z1: sc.H };
  for (let i = 0; i < input.size + 1; i++) {
    const u0 = 0.55 + i * 0.13;
    poly(sc.rc, faceQuad(leftFace(sc.rc, doorWall), u0, u0 + 0.1, 0, 0.55), paint([120, 126, 134]));
  }

  // Racks: along the back-left wall and down the middle.
  const levels = 2 + input.size;
  const lenY = D - 3;
  const lenX = W0 * 0.45;
  const slotsY = Math.floor(lenY / 0.5) * levels;
  const slotsX = Math.floor(lenX / 0.5) * levels;
  const colors = stockColors(input, slotsY + slotsX);
  add(sc, 0.6, lenY, () => rack(sc, 0.15, 0.4, 'y', lenY, levels, i => colors[i]));
  add(sc, lenX + 1.5, 2.2, () => rack(sc, 1.5, 1.6, 'x', lenX, levels, i => colors[slotsY + i]));

  // Prep floor: a few cases out, the prep crew at work.
  for (let i = 0; i < Math.min(6, input.prepStaff * 2 + 1); i++) {
    const cx = 2 + (i % 3) * 0.6;
    const cy = D - 4 + Math.floor(i / 3) * 0.6;
    const c = colors[(i * 7) % Math.max(1, colors.length)] ?? [80, 80, 90];
    add(sc, cx + 0.4, cy + 0.4, () => flightCase(sc, cx, cy, 0, c ?? [80, 80, 90]));
  }
  for (let i = 0; i < input.prepStaff; i++) {
    const t = time / 2400 + i * 1.7;
    const px = 1.8 + ((i * 1.3) % 3) + Math.sin(t) * 0.6;
    const py = D - 3.2 + ((i * 0.7) % 1.2) + Math.cos(t * 0.7) * 0.3;
    add(sc, px, py, () => person(sc, px, py, 0, [240, 140, 30], Math.abs(Math.sin(t * 6)) * 0.05));
  }
  if (input.prepStaff >= 2 || input.size >= 2) add(sc, W0 * 0.55 + 0.8, D - 3.6, () => forklift(sc, W0 * 0.55, D - 4, time));

  // Office in the back corner, glass-fronted.
  const ox = W0 - 3.6;
  add(sc, W0 - 0.2, 2.4, () => {
    const office: Box = { x0: ox, y0: 0, x1: W0, y1: 2.2, z0: 0, z1: 2.6 };
    poly(sc.rc, faceQuad(leftFace(sc.rc, office), 0, 1, 0, 1), glow([160, 200, 230], 0.25), paint([90, 100, 110]));
    poly(sc.rc, faceQuad(rightFace(sc.rc, office), 0, 1, 0, 1), glow([160, 200, 230], 0.18), paint([90, 100, 110]));
  });
  for (let i = 0; i < Math.max(1, input.officeStaff); i++) {
    const dx = ox + 0.3 + (i % 3) * 1.1;
    const dy = 0.35 + Math.floor(i / 3) * 0.9;
    add(sc, dx + 0.9, dy + 0.6, () => desk(sc, dx, dy, input.year, i < input.officeStaff, [70, 90, 140]));
  }

  if (stage) drawStage(sc, W0, W, D, stage, time);
  // Extra annex furniture: a second bench and bunks.
  if ((input.bench ?? 0) >= 2) add(sc, 3.2, D - 1.2, () => prism(sc.rc, { x0: 1.8, y0: D - 1.3, x1: 3.2, y1: D - 0.9, z0: 0, z1: 0.85 }, [110, 110, 120], [140, 140, 150]));
  if ((input.lounge ?? 0) >= 2) add(sc, 5.4, D - 0.3, () => prism(sc.rc, { x0: 4.8, y0: D - 1.0, x1: 5.4, y1: D - 0.4, z0: 0, z1: 1.2 }, [90, 70, 120], [110, 90, 150]));
  // Workshop bench.
  if (input.workshop !== 'none' || (input.bench ?? 0) > 0) {
    add(sc, 1.6, D - 0.6, () => {
      prism(sc.rc, { x0: 0.3, y0: D - 1.3, x1: 1.6, y1: D - 0.7, z0: 0, z1: 0.85 }, [120, 90, 60], [150, 116, 80]);
      if (Math.floor(time / 300) % 3 === 0) {
        const [sx, sy] = P(sc, 0.9, D - 1.0, 1.0);
        sc.rc.ctx.fillStyle = glow([255, 230, 140], 0.9);
        sc.rc.ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
      }
    });
    if (input.workshop === 'full' || (input.bench ?? 0) >= 2) add(sc, 1.0, D - 0.4, () => person(sc, 1.0, D - 0.35, 0, [90, 90, 96]));
  }

  // Gig techs on the break-room sofa.
  const shown = Math.min(8, input.gigTechs);
  add(sc, 4.6, D - 0.5, () => prism(sc.rc, { x0: 2.6, y0: D - 0.9, x1: 4.6, y1: D - 0.5, z0: 0, z1: 0.55 }, [70, 60, 110], [90, 80, 140]));
  for (let i = 0; i < shown; i++) {
    const px = 2.8 + (i % 4) * 0.5;
    const py = D - 0.25 - Math.floor(i / 4) * 0.55;
    add(sc, px, py + 0.1, () => person(sc, px, py, 0, SHIRTS[i % SHIRTS.length], 0, 0.9));
  }

  // Loading bays along the front: parked vehicles, empty bays for the ones out on jobs.
  const bays = Math.max(input.vehicles.length + input.away, 2);
  for (let i = 0; i < bays; i++) {
    const bx = W0 - 0.7 - i * 1.15;
    const by = D - 0.15;
    const v = input.vehicles[i];
    if (bx < 5.4) break;
    sc.items.push({ depth: -1, draw: () => groundQuad(sc.rc, bx - 0.5, by - 3.4, bx + 0.5, by, 0.01, paint([150, 150, 146])) });
    if (v) add(sc, bx + 0.4, by, () => bayVehicle(sc, bx, by, v.kind, brand));
  }
  flush(sc);
}

/** A rehearsal stage in the annex: a platform, back line, a lighting bar and a band at work. */
function drawStage(sc: Scene, x0: number, x1: number, D: number, level: number, time: number) {
  const px0 = x0 + 0.35;
  const px1 = x1 - 0.3;
  const py1 = Math.min(D - 3.6, 2.2 + level * 0.45);
  // Platform.
  add(sc, px0, 0.1, () => prism(sc.rc, { x0: px0, y0: 0.5, x1: px1, y1: py1, z0: 0, z1: 0.4 }, [58, 58, 66], [78, 78, 88]));
  // Back screen / wall at the larger sizes.
  if (level >= 3) {
    const wall: Box = { x0: px0, y0: 0.08, x1: px1, y1: 0.28, z0: 0.4, z1: 3.2 };
    add(sc, px0, 0.3, () => {
      prism(sc.rc, wall, [20, 20, 26], [20, 20, 26], false);
      const hue = (time / 40) % 360;
      poly(sc.rc, faceQuad(leftFace(sc.rc, wall), 0.05, 0.95, 0.1, 0.9), glow(hueRgb(hue), 0.55));
    });
  }
  // Lighting bar on two uprights, with coloured lamps.
  const barZ = 2.9 + (level >= 3 ? 0.4 : 0);
  add(sc, px1, 0.9, () => {
    prism(sc.rc, { x0: px0, y0: py1 - 0.1, x1: px0 + 0.1, y1: py1, z0: 0.4, z1: barZ }, [30, 30, 36], [30, 30, 36], false);
    prism(sc.rc, { x0: px1 - 0.1, y0: py1 - 0.1, x1: px1, y1: py1, z0: 0.4, z1: barZ }, [30, 30, 36], [30, 30, 36], false);
    prism(sc.rc, { x0: px0, y0: py1 - 0.1, x1: px1, y1: py1, z0: barZ, z1: barZ + 0.1 }, [30, 30, 36], [30, 30, 36], false);
    const lamps = 3 + level;
    for (let i = 0; i < lamps; i++) {
      const lx = px0 + 0.3 + ((px1 - px0 - 0.6) * i) / Math.max(1, lamps - 1);
      const [sx, sy] = P(sc, lx, py1 - 0.05, barZ);
      sc.rc.ctx.fillStyle = glow(hueRgb(((time / 12 + i * 70) % 360 + 360) % 360), 0.9);
      sc.rc.ctx.beginPath();
      sc.rc.ctx.arc(sx, sy, Math.max(1.2, 1.6 * sc.rc.cam.zoom), 0, Math.PI * 2);
      sc.rc.ctx.fill();
    }
  });
  // Back line: amps and a drum riser; the band.
  const mid = (px0 + px1) / 2;
  add(sc, px0 + 0.9, 1.0, () => prism(sc.rc, { x0: px0 + 0.3, y0: 0.6, x1: px0 + 0.9, y1: 1.0, z0: 0.4, z1: 1.3 }, [40, 40, 46], [60, 60, 68]));
  add(sc, px1 - 0.4, 1.0, () => prism(sc.rc, { x0: px1 - 1.0, y0: 0.6, x1: px1 - 0.4, y1: 1.0, z0: 0.4, z1: 1.3 }, [40, 40, 46], [60, 60, 68]));
  add(sc, mid + 0.4, 1.3, () => prism(sc.rc, { x0: mid - 0.4, y0: 0.7, x1: mid + 0.4, y1: 1.3, z0: 0.4, z1: 1.0 }, [150, 40, 50], [180, 60, 70]));
  const members = Math.min(4, 1 + level);
  for (let i = 0; i < members; i++) {
    const t = time / 500 + i * 1.3;
    const bx = px0 + 0.9 + ((px1 - px0 - 1.8) * (i + 0.5)) / members;
    const by = py1 - 0.7 - (i % 2) * 0.35;
    add(sc, bx, by, () => person(sc, bx, by, 0.4, SHIRTS[(i + 3) % SHIRTS.length], Math.abs(Math.sin(t * 3)) * 0.07));
  }
}

function hueRgb(h: number): RGB {
  const k = (n: number) => (n + h / 60) % 6;
  const f = (n: number) => 1 - Math.max(0, Math.min(k(n), 4 - k(n), 1));
  return [Math.round(80 + 175 * f(5)), Math.round(80 + 175 * f(3)), Math.round(80 + 175 * f(1))];
}

function drawDelegation(ctx: CanvasRenderingContext2D, w: number, h: number, input: BaseSceneInput, brand: RGB, time: number) {
  const sc = makeScene(ctx, w, h, 8, 6, 4.5, time);
  floor(sc, [168, 150, 128], [140, 124, 104]);
  // Carpet tiles under the desks.
  groundQuad(sc.rc, 0.3, 0.3, 5.2, 3.6, 0.01, paint([86, 96, 120]));
  backWalls(sc, [226, 222, 214], brand);
  // Posters on the wall: past shows.
  const wall: Box = { x0: 0, y0: -0.25, x1: 8, y1: 0, z0: 0, z1: 4.5 };
  [0.12, 0.3, 0.48].forEach((u, i) => poly(sc.rc, faceQuad(leftFace(sc.rc, wall), u, u + 0.1, 0.4, 0.75), paint(SHIRTS[(i + 2) % SHIRTS.length], 1.2)));
  // Window on the side wall with daylight.
  const side: Box = { x0: -0.25, y0: 0, x1: 0, y1: 6, z0: 0, z1: 4.5 };
  poly(sc.rc, faceQuad(rightFace(sc.rc, side), 0.25, 0.75, 0.35, 0.8), glow([180, 220, 250], 0.85));

  for (let i = 0; i < Math.max(2, input.officeStaff); i++) {
    const dx = 0.6 + (i % 3) * 1.55;
    const dy = 0.5 + Math.floor(i / 3) * 1.5;
    add(sc, dx + 0.9, dy + 0.6, () => desk(sc, dx, dy, input.year, i < input.officeStaff, [70, 90, 140]));
  }
  // Reception counter with the brand on it.
  add(sc, 7.4, 4.4, () => {
    const b: Box = { x0: 5.8, y0: 3.6, x1: 7.4, y1: 4.2, z0: 0, z1: 1.1 };
    prism(sc.rc, b, [230, 230, 232], [200, 200, 204]);
    poly(sc.rc, faceQuad(leftFace(sc.rc, b), 0.1, 0.9, 0.3, 0.7), paint(brand));
  });
  // Lock-up cage with the few cases kept here.
  const colors = stockColors(input, 12);
  add(sc, 7.6, 2.4, () => {
    groundQuad(sc.rc, 5.8, 0.2, 7.8, 2.4, 0.01, paint([120, 120, 118]));
    colors.forEach((c, i) => {
      if (!c) return;
      const cx = 5.95 + (i % 4) * 0.45;
      const cy = 0.35 + Math.floor(i / 4) * 0.6;
      flightCase(sc, cx, cy, 0, c, 0.4, 0.45, 0.8);
    });
    const cage: Box = { x0: 5.8, y0: 0.2, x1: 7.8, y1: 2.4, z0: 0, z1: 2.2 };
    poly(sc.rc, faceQuad(leftFace(sc.rc, cage), 0, 1, 0, 1), paint([150, 150, 150], 1, 0.22), paint([110, 110, 110]));
    poly(sc.rc, faceQuad(rightFace(sc.rc, cage), 0, 1, 0, 1), paint([150, 150, 150], 1, 0.18), paint([110, 110, 110]));
  });
  // A couple of gig techs dropping by.
  for (let i = 0; i < Math.min(3, input.gigTechs); i++) {
    const t = time / 2600 + i;
    const px = 4.2 + Math.sin(t) * 0.8 + i * 0.4;
    const py = 4.7 + Math.cos(t) * 0.3;
    add(sc, px, py, () => person(sc, px, py, 0, SHIRTS[i]));
  }
  flush(sc);
}

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

export type VenuePhase = 'idle' | 'load-in' | 'show' | 'load-out';

export interface VenueSceneInput {
  kind: 'pub' | 'hall' | 'club' | 'theatre' | 'arena' | 'stadium' | 'airport';
  year: number;
  phase: VenuePhase;
  /** Supplier's colour (yours or a rival's) for the rig trim. */
  brand: string;
  rig: { audio: number; lighting: number; video: number; stage: number; console: number };
  /** Rig installed by your house contract. */
  house?: boolean;
  seed: number;
}

const ROOM: Record<VenueSceneInput['kind'], [number, number, number]> = {
  pub: [7, 5, 3.6],
  club: [9, 6, 4.2],
  hall: [10, 7, 5],
  theatre: [11, 8, 6],
  arena: [14, 10, 7],
  stadium: [16, 12, 0],
  airport: [10, 7, 5],
};

export function drawVenueScene(ctx: CanvasRenderingContext2D, w: number, h: number, input: VenueSceneInput, time: number) {
  const prevNight = getNight();
  const [W, D, H] = ROOM[input.kind];
  const open = input.kind === 'stadium';
  const lit = input.phase !== 'show';
  setNight(input.phase === 'show' ? 0.8 : open ? 0.15 : 0.05);
  const sc = makeScene(ctx, w, h, W, D, open ? 9 : H, time, open);
  const brand = hexRgb(input.brand);

  if (open) {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, input.phase === 'show' ? '#0b1026' : '#7fb4e6');
    g.addColorStop(1, input.phase === 'show' ? '#1d2448' : '#cfe6f5');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  const floorColor: RGB = input.kind === 'pub' ? [120, 84, 56] : input.kind === 'stadium' ? C.pitch : input.kind === 'theatre' ? [96, 40, 44] : [54, 54, 60];
  floor(sc, floorColor, input.kind === 'pub' ? [90, 62, 40] : undefined);
  if (!open) backWalls(sc, input.kind === 'theatre' ? [120, 50, 56] : input.kind === 'pub' ? [168, 130, 96] : [70, 70, 78]);
  else {
    // Stands along the back.
    for (let r = 0; r < 4; r++) {
      const z0 = r * 0.9;
      prism(sc.rc, { x0: -1.6 + r * 0.4, y0: -0.4, x1: -1.2 + r * 0.4, y1: D, z0: 0, z1: z0 + 1.2 }, [150, 150, 156], [120, 30, 40], false);
    }
  }

  // Stage along the back-right wall.
  const stageD = Math.min(3.2, D * 0.32);
  const stageZ = input.kind === 'pub' ? 0.4 : input.kind === 'stadium' ? 2 : 1;
  const sx0 = input.kind === 'pub' ? 0.4 : W * 0.15;
  const sx1 = input.kind === 'pub' ? W * 0.55 : W * 0.85;
  add(sc, sx1, 0.1, () => {
    prism(sc.rc, { x0: sx0, y0: 0, x1: sx1, y1: stageD, z0: 0, z1: stageZ }, [40, 40, 46], [64, 64, 72]);
    if (open) {
      // Stage roof on towers.
      [sx0, sx1 - 0.3].forEach(x => prism(sc.rc, { x0: x, y0: 0.1, x1: x + 0.3, y1: 0.4, z0: 0, z1: 8 }, [80, 80, 86], [80, 80, 86], false));
      prism(sc.rc, { x0: sx0 - 0.3, y0: 0, x1: sx1 + 0.3, y1: stageD + 0.4, z0: 8, z1: 8.4 }, [60, 60, 66], [40, 40, 46], false);
    }
  });

  // LED screen / projection behind the band.
  if (input.rig.video > 0) {
    add(sc, (sx0 + sx1) / 2, 0.05, () => {
      const scr: Box = { x0: sx0 + (sx1 - sx0) * 0.2, y0: 0.05, x1: sx1 - (sx1 - sx0) * 0.2, y1: 0.15, z0: stageZ + 1.2, z1: stageZ + (open ? 6 : H * 0.8) };
      const live = input.phase === 'show';
      const hue = (time / 40 + input.seed * 60) % 360;
      const q = faceQuad(leftFace(sc.rc, scr), 0, 1, 0, 1);
      poly(sc.rc, q, live ? `hsl(${hue} 80% 55%)` : paint([24, 24, 28]));
      if (live && input.year >= 1995) {
        // LED pixel grid.
        sc.rc.ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        sc.rc.ctx.lineWidth = 1;
        const f = leftFace(sc.rc, scr);
        sc.rc.ctx.beginPath();
        for (let i = 1; i < 8; i++) {
          const a = f(i / 8, 0);
          const b = f(i / 8, 1);
          sc.rc.ctx.moveTo(a[0], a[1]);
          sc.rc.ctx.lineTo(b[0], b[1]);
        }
        sc.rc.ctx.stroke();
      }
    });
  }

  // PA: stacks before the line-array era, hangs after.
  const boxes = Math.max(2, Math.min(12, Math.ceil(input.rig.audio / 2)));
  const lineArray = input.year >= 1993 && input.kind !== 'pub';
  [sx0 - 0.7, sx1 + 0.1].forEach((px, side) => {
    add(sc, px + 0.6, stageD, () => {
      for (let i = 0; i < boxes; i++) {
        const b: Box = lineArray
          ? { x0: px + i * 0.015 * (side ? 1 : -1), y0: stageD - 0.8, x1: px + 0.6 + i * 0.015 * (side ? 1 : -1), y1: stageD - 0.2, z0: (open ? 7 : H - 0.6) - (i + 1) * 0.45, z1: (open ? 7 : H - 0.6) - i * 0.45 }
          : { x0: px, y0: stageD - 0.8, x1: px + 0.6, y1: stageD - 0.2, z0: i * 0.7, z1: i * 0.7 + 0.68 };
        prism(sc.rc, b, [36, 36, 40], [50, 50, 56]);
        poly(sc.rc, faceQuad(leftFace(sc.rc, b), 0.15, 0.85, 0.2, 0.8), paint([20, 20, 22]));
      }
      if (lineArray) prism(sc.rc, { x0: px, y0: stageD - 0.8, x1: px + 0.6, y1: stageD - 0.2, z0: 0, z1: 1.2 }, [30, 30, 34], [44, 44, 50]);
    });
  });

  // Lighting truss over the stage, fixtures hanging off it.
  const trussZ = open ? 7.4 : H - 0.4;
  const fixtures = Math.max(2, Math.min(16, input.rig.lighting));
  const fixturePos: [number, number][] = [];
  for (let i = 0; i < fixtures; i++) fixturePos.push([sx0 + 0.3 + ((sx1 - sx0 - 0.6) * (i + 0.5)) / fixtures, stageD * 0.55]);
  add(sc, sx1, stageD * 0.6, () => {
    prism(sc.rc, { x0: sx0, y0: stageD * 0.5, x1: sx1, y1: stageD * 0.62, z0: trussZ, z1: trussZ + 0.18 }, [170, 170, 176], [200, 200, 206], false);
    fixturePos.forEach(([fx, fy]) => prism(sc.rc, { x0: fx - 0.12, y0: fy - 0.1, x1: fx + 0.12, y1: fy + 0.1, z0: trussZ - 0.4, z1: trussZ }, [30, 30, 34], brand, false));
  });

  // Band (or crew during load-in/out) on stage.
  const onStage = input.phase === 'show' ? 4 : input.phase === 'idle' ? 0 : 3;
  for (let i = 0; i < onStage; i++) {
    const px = sx0 + 0.8 + ((sx1 - sx0 - 1.6) * i) / Math.max(1, onStage - 1);
    const py = stageD * 0.55 + (i % 2) * 0.5;
    const bob = input.phase === 'show' ? Math.abs(Math.sin(time / 220 + i)) * 0.12 : 0;
    add(sc, px, py + 0.2, () => person(sc, px, py, stageZ, input.phase === 'show' ? SHIRTS[(i + 3) % SHIRTS.length] : [30, 30, 34], bob));
  }

  // Cases on the floor during load-in/out, crew pushing them.
  if (input.phase === 'load-in' || input.phase === 'load-out') {
    for (let i = 0; i < 8; i++) {
      const cx = sx0 + (i % 4) * 0.7 + 0.3;
      const cy = stageD + 0.6 + Math.floor(i / 4) * 0.7;
      add(sc, cx + 0.4, cy + 0.4, () => flightCase(sc, cx, cy, 0, brand));
    }
    for (let i = 0; i < 4; i++) {
      const t = time / 1500 + i * 1.3;
      const px = W * 0.3 + Math.sin(t) * W * 0.2;
      const py = D * 0.65 + Math.cos(t * 0.8) * 0.8;
      add(sc, px, py, () => person(sc, px, py, 0, [30, 30, 34]));
    }
  }

  // FOH riser in the middle of the room.
  const fohX = W * 0.5;
  const fohY = Math.min(D - 1.2, stageD + (D - stageD) * 0.62);
  if (input.kind !== 'pub' || input.phase !== 'idle') {
    add(sc, fohX + 1, fohY + 0.8, () => {
      prism(sc.rc, { x0: fohX - 0.8, y0: fohY, x1: fohX + 0.8, y1: fohY + 0.8, z0: 0, z1: 0.3 }, [50, 50, 56], [70, 70, 78]);
      const consoles = Math.max(1, Math.min(3, input.rig.console));
      for (let i = 0; i < consoles; i++) {
        const cx = fohX - 0.7 + i * 0.5;
        prism(sc.rc, { x0: cx, y0: fohY + 0.1, x1: cx + 0.42, y1: fohY + 0.4, z0: 0.3, z1: 0.75 }, [40, 40, 46], [90, 90, 100]);
        if (input.phase === 'show') {
          const [lx, ly] = P(sc, cx + 0.21, fohY + 0.25, 0.78);
          sc.rc.ctx.fillStyle = glow([120, 255, 140], 0.9);
          sc.rc.ctx.fillRect(lx - 3, ly - 1, 6, 2);
        }
      }
      if (input.phase !== 'idle') person(sc, fohX, fohY + 0.6, 0.3, [30, 30, 34]);
    });
  }

  // Theatre seats.
  if (input.kind === 'theatre' && input.phase !== 'show') {
    for (let r = 0; r < 4; r++)
      add(sc, W - 1, stageD + 1.2 + r * 0.9, () =>
        prism(sc.rc, { x0: 1, y0: stageD + 1 + r * 0.9, x1: W - 1, y1: stageD + 1.4 + r * 0.9, z0: 0, z1: 0.5 + r * 0.15 }, [150, 30, 40], [170, 40, 50], false),
      );
  }
  // Pub tables and stools.
  if (input.kind === 'pub' && input.phase !== 'show') {
    for (let i = 0; i < 4; i++) {
      const tx = 1 + (i % 2) * 2.2;
      const ty = 2.6 + Math.floor(i / 2) * 1.3;
      add(sc, tx + 0.5, ty + 0.5, () => {
        prism(sc.rc, { x0: tx, y0: ty, x1: tx + 0.6, y1: ty + 0.6, z0: 0.7, z1: 0.8 }, [90, 60, 36], [120, 84, 52]);
        prism(sc.rc, { x0: tx + 0.25, y0: ty + 0.25, x1: tx + 0.35, y1: ty + 0.35, z0: 0, z1: 0.7 }, [60, 40, 24], [60, 40, 24], false);
        [[-0.25, 0.2], [0.75, 0.3]].forEach(([dx, dy]) =>
          prism(sc.rc, { x0: tx + dx, y0: ty + dy, x1: tx + dx + 0.2, y1: ty + dy + 0.2, z0: 0, z1: 0.45 }, [70, 46, 30], [100, 70, 44], false),
        );
      });
    }
  }
  // Pub bar.
  if (input.kind === 'pub') {
    add(sc, W - 0.2, D - 0.3, () => {
      prism(sc.rc, { x0: W - 1.2, y0: 1.2, x1: W - 0.3, y1: D - 0.3, z0: 0, z1: 1.1 }, [110, 70, 40], [140, 96, 60]);
    });
  }

  // The crowd.
  if (input.phase === 'show') {
    const rows = input.kind === 'pub' ? 3 : input.kind === 'club' ? 4 : 6;
    const cols = Math.round(W * (input.kind === 'stadium' ? 1.5 : 1.1));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (rnd(input.seed, r, c) < 0.18) continue;
        const px = 0.4 + (c + rnd(c, r, 1) * 0.6) * ((W - 0.8) / cols);
        const py = stageD + 0.5 + r * ((D - stageD - 0.8) / rows) + rnd(r, c, 2) * 0.3;
        if (Math.abs(px - fohX) < 1 && Math.abs(py - fohY - 0.4) < 0.8) continue;
        const bob = Math.abs(Math.sin(time / 260 + c * 0.7 + r)) * 0.15;
        add(sc, px, py, () => person(sc, px, py, 0, SHIRTS[(r * 3 + c) % SHIRTS.length], bob, 0.85));
      }
    }
  }

  flush(sc);

  // Beams on top of everything (additive light).
  if (input.phase === 'show') {
    const { ctx: c } = sc.rc;
    c.save();
    c.globalCompositeOperation = 'lighter';
    fixturePos.forEach(([fx, fy], i) => {
      const sweep = Math.sin(time / 700 + i * 0.9) * 2.2;
      const [ax, ay] = P(sc, fx, fy, trussZ - 0.4);
      const [bx, by] = P(sc, fx + sweep, fy + 2.5 + Math.cos(time / 900 + i) * 1.2, 0);
      const hue = (i * 47 + time / 30) % 360;
      const spread = 10 * sc.rc.cam.zoom;
      const g = c.createLinearGradient(ax, ay, bx, by);
      g.addColorStop(0, `hsla(${hue},90%,65%,0.55)`);
      g.addColorStop(1, `hsla(${hue},90%,65%,0)`);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(ax - 1, ay);
      c.lineTo(bx - spread, by);
      c.lineTo(bx + spread, by);
      c.lineTo(ax + 1, ay);
      c.closePath();
      c.fill();
    });
    c.restore();
  } else if (lit && input.phase !== 'idle') {
    // Work lights.
    const [wx, wy] = P(sc, W / 2, D / 2, 0);
    const g = ctx.createRadialGradient(wx, wy, 0, wx, wy, w * 0.6);
    g.addColorStop(0, 'rgba(255,240,200,0.12)');
    g.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  if (input.house) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(6, h - 20, 110, 16);
    ctx.fillStyle = '#fff';
    ctx.font = '600 10px system-ui, sans-serif';
    ctx.fillText('Your house rig', 12, h - 8);
  }
  setNight(prevNight);
}
