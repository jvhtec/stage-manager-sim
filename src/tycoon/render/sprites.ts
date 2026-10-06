/**
 * Procedural isometric sprites. Everything is drawn from tile-space boxes,
 * faces and ellipses projected through the camera — no image assets.
 */
import type { WorldMap } from '@/world/types';
import { TH, TW, project, type Camera, type Pt } from './iso';
import { BUILDING_WALLS, C, glow, getNight, paint, type RGB } from './palette';

export interface RC {
  ctx: CanvasRenderingContext2D;
  cam: Camera;
  map: WorldMap;
  /** Milliseconds, for cosmetic animation. */
  time: number;
}

export function hash2(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function poly(rc: RC, pts: Pt[], fill: string, stroke?: string, lineWidth = 1) {
  const { ctx } = rc;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

const P = (rc: RC, x: number, y: number, z: number) => project(rc.cam, x, y, z);

// ---------------------------------------------------------------------------
// Boxes & faces
// ---------------------------------------------------------------------------

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  z0: number;
  z1: number;
}

type Face = (u: number, v: number) => Pt;

/** Front-left face (the y = y1 wall), u along x, v up. */
export function leftFace(rc: RC, b: Box): Face {
  return (u, v) => P(rc, b.x0 + (b.x1 - b.x0) * u, b.y1, b.z0 + (b.z1 - b.z0) * v);
}

/** Front-right face (the x = x1 wall), u from front (y1) to back (y0), v up. */
export function rightFace(rc: RC, b: Box): Face {
  return (u, v) => P(rc, b.x1, b.y1 + (b.y0 - b.y1) * u, b.z0 + (b.z1 - b.z0) * v);
}

export function faceQuad(f: Face, u0: number, u1: number, v0: number, v1: number): Pt[] {
  return [f(u0, v0), f(u1, v0), f(u1, v1), f(u0, v1)];
}

export function prism(rc: RC, b: Box, wall: RGB, top: RGB, outline = true) {
  const stroke = outline && rc.cam.zoom >= 1.2 ? paint(C.black, 1, 0.25) : undefined;
  const lw = Math.max(0.5, rc.cam.zoom * 0.35);
  poly(rc, faceQuad(leftFace(rc, b), 0, 1, 0, 1), paint(wall, 0.92), stroke, lw);
  poly(rc, faceQuad(rightFace(rc, b), 0, 1, 0, 1), paint(wall, 0.7), stroke, lw);
  poly(
    rc,
    [P(rc, b.x0, b.y0, b.z1), P(rc, b.x1, b.y0, b.z1), P(rc, b.x1, b.y1, b.z1), P(rc, b.x0, b.y1, b.z1)],
    paint(top, 1.08),
    stroke,
    lw,
  );
}

/** Rows of windows on both visible faces — lit at night from a stable per-building hash. */
export function windows(rc: RC, b: Box, floors: number, seed: number, cols = 2) {
  if (rc.cam.zoom < 1.4) return;
  const night = getNight();
  const { ctx } = rc;
  const lit: Pt[][] = [];
  const dark: Pt[][] = [];
  const faces = [leftFace(rc, b), rightFace(rc, b)];
  faces.forEach((f, fi) => {
    for (let fl = 0; fl < floors; fl++) {
      for (let c = 0; c < cols; c++) {
        const q = faceQuad(f, (c + 0.28) / cols, (c + 0.72) / cols, (fl + 0.3) / floors, (fl + 0.72) / floors);
        const on = night > 0.25 && hash2(seed, fl * 7 + c, fi) < 0.55;
        (on ? lit : dark).push(q);
      }
    }
  });
  const fillAll = (quads: Pt[][], style: string) => {
    if (!quads.length) return;
    ctx.beginPath();
    quads.forEach(q => {
      ctx.moveTo(q[0][0], q[0][1]);
      for (let i = 1; i < 4; i++) ctx.lineTo(q[i][0], q[i][1]);
      ctx.closePath();
    });
    ctx.fillStyle = style;
    ctx.fill();
  };
  fillAll(dark, paint(C.window, 1));
  fillAll(lit, glow(C.windowLit, 0.95));
}

/** A gabled roof with its ridge running along x. */
export function pitchedRoof(rc: RC, b: Box, rise: number, roof: RGB) {
  const ym = (b.y0 + b.y1) / 2;
  const zr = b.z1 + rise;
  poly(rc, [P(rc, b.x0, b.y0, b.z1), P(rc, b.x1, b.y0, b.z1), P(rc, b.x1, ym, zr), P(rc, b.x0, ym, zr)], paint(roof, 0.75));
  poly(rc, [P(rc, b.x1, b.y0, b.z1), P(rc, b.x1, b.y1, b.z1), P(rc, b.x1, ym, zr)], paint(C.white, 0.72));
  poly(rc, [P(rc, b.x0, ym, zr), P(rc, b.x1, ym, zr), P(rc, b.x1, b.y1, b.z1), P(rc, b.x0, b.y1, b.z1)], paint(roof, 1));
}

export function groundQuad(rc: RC, x0: number, y0: number, x1: number, y1: number, z: number, color: string) {
  poly(rc, [P(rc, x0, y0, z), P(rc, x1, y0, z), P(rc, x1, y1, z), P(rc, x0, y1, z)], color);
}

// ---------------------------------------------------------------------------
// Ellipses (arenas, stadiums)
// ---------------------------------------------------------------------------

/** Screen ellipse for a circle of radius r (tiles) centred at a tile point. */
function isoEllipse(rc: RC, cx: number, cy: number, z: number, r: number) {
  const [sx, sy] = P(rc, cx, cy, z);
  const rx = r * TW * 0.7071 * rc.cam.zoom;
  const ry = r * TH * 0.7071 * rc.cam.zoom;
  return { sx, sy, rx, ry };
}

function fillEllipse(rc: RC, e: { sx: number; sy: number; rx: number; ry: number }, style: string | CanvasGradient) {
  rc.ctx.beginPath();
  rc.ctx.ellipse(e.sx, e.sy, e.rx, e.ry, 0, 0, Math.PI * 2);
  rc.ctx.fillStyle = style;
  rc.ctx.fill();
}

function cylinderWall(rc: RC, cx: number, cy: number, z0: number, z1: number, r: number, wall: RGB) {
  const bottom = isoEllipse(rc, cx, cy, z0, r);
  const top = isoEllipse(rc, cx, cy, z1, r);
  const grad = rc.ctx.createLinearGradient(bottom.sx - bottom.rx, 0, bottom.sx + bottom.rx, 0);
  grad.addColorStop(0, paint(wall, 1));
  grad.addColorStop(0.55, paint(wall, 0.85));
  grad.addColorStop(1, paint(wall, 0.6));
  fillEllipse(rc, bottom, grad);
  rc.ctx.fillStyle = grad;
  rc.ctx.fillRect(bottom.sx - bottom.rx, top.sy, bottom.rx * 2, bottom.sy - top.sy);
  return top;
}

// ---------------------------------------------------------------------------
// Scenery
// ---------------------------------------------------------------------------

export function tree(rc: RC, x: number, y: number, z: number, size: number, conifer: boolean) {
  const [sx, sy] = P(rc, x, y, z);
  const s = size * rc.cam.zoom;
  const { ctx } = rc;
  ctx.fillStyle = paint(C.trunk);
  ctx.fillRect(sx - s * 0.08, sy - s * 0.5, s * 0.16, s * 0.5);
  if (conifer) {
    for (let i = 0; i < 2; i++) {
      const base = sy - s * (0.35 + i * 0.45);
      const w = s * (0.55 - i * 0.12);
      ctx.beginPath();
      ctx.moveTo(sx - w, base);
      ctx.lineTo(sx + w, base);
      ctx.lineTo(sx, base - s * 0.85);
      ctx.closePath();
      ctx.fillStyle = paint(i ? C.pineLight : C.pine);
      ctx.fill();
    }
  } else {
    ctx.beginPath();
    ctx.arc(sx, sy - s * 0.85, s * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = paint(C.leaf, 0.9);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx - s * 0.15, sy - s * 0.98, s * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = paint(C.leaf, 1.15);
    ctx.fill();
  }
}

export function house(rc: RC, x: number, y: number, z: number, floors: number, color: number, seed: number) {
  const wall = BUILDING_WALLS[color % BUILDING_WALLS.length];
  const inset = floors >= 4 ? 0.1 : 0.16;
  const b: Box = { x0: x + inset, y0: y + inset, x1: x + 1 - inset, y1: y + 1 - inset, z0: z, z1: z + floors * 1.15 };
  prism(rc, b, wall, floors >= 3 ? C.concrete : wall);
  windows(rc, b, floors, seed, floors >= 4 ? 3 : 2);
  if (floors <= 2) {
    pitchedRoof(rc, b, 0.9, color % 2 ? [128, 64, 52] : [86, 88, 98]);
  } else if (floors >= 5) {
    // Rooftop plant room on towers.
    prism(rc, { x0: b.x0 + 0.25, y0: b.y0 + 0.25, x1: b.x1 - 0.3, y1: b.y1 - 0.3, z0: b.z1, z1: b.z1 + 0.6 }, C.concrete, C.concrete);
  }
}

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

export interface VenueDraw {
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  /** A show is playing right now. */
  live: boolean;
  liveColor: RGB;
  seed: number;
}

/** Returns the screen point the venue's marker should hover over. */
export function venue(rc: RC, v: VenueDraw): Pt {
  const { x, y, w, h, z } = v;
  const night = getNight();
  groundQuad(rc, x + 0.04, y + 0.04, x + w - 0.04, y + h - 0.04, z, paint(C.pavement));

  switch (v.kind) {
    case 'pub': {
      const b: Box = { x0: x + 0.18, y0: y + 0.2, x1: x + 0.82, y1: y + 0.82, z0: z, z1: z + 1.4 };
      prism(rc, b, [232, 222, 196], [232, 222, 196]);
      // Tudor beams + dark green ground floor.
      poly(rc, faceQuad(leftFace(rc, b), 0, 1, 0, 0.45), paint([40, 84, 56]));
      poly(rc, faceQuad(rightFace(rc, b), 0, 1, 0, 0.45), paint([32, 68, 46]));
      windows(rc, { ...b, z0: b.z0 + 0.6 }, 1, v.seed, 2);
      pitchedRoof(rc, b, 1, [70, 60, 56]);
      prism(rc, { x0: x + 0.62, y0: y + 0.28, x1: x + 0.74, y1: y + 0.4, z0: b.z1, z1: b.z1 + 1.3 }, [150, 80, 60], [90, 60, 50]);
      // Swinging sign.
      const [px, py] = P(rc, x + 0.92, y + 0.92, z);
      const s = rc.cam.zoom;
      rc.ctx.fillStyle = paint(C.trunk);
      rc.ctx.fillRect(px - s * 0.5, py - s * 13, s, s * 13);
      rc.ctx.fillStyle = paint([180, 40, 40]);
      rc.ctx.fillRect(px - s * 4, py - s * 13, s * 5, s * 4);
      return P(rc, x + 0.5, y + 0.5, b.z1 + 2.2);
    }
    case 'hall': {
      const b: Box = { x0: x + 0.12, y0: y + 0.14, x1: x + 0.88, y1: y + 0.86, z0: z, z1: z + 2 };
      prism(rc, b, [208, 200, 182], [208, 200, 182]);
      // Columns along the front.
      for (let i = 0; i < 4; i++) {
        poly(rc, faceQuad(leftFace(rc, b), 0.12 + i * 0.24, 0.2 + i * 0.24, 0, 0.8), paint(C.white, 1.05));
      }
      pitchedRoof(rc, b, 0.8, [120, 120, 126]);
      return P(rc, x + 0.5, y + 0.5, b.z1 + 1.8);
    }
    case 'club': {
      const b: Box = { x0: x + 0.12, y0: y + 0.12, x1: x + 0.88, y1: y + 0.88, z0: z, z1: z + 1.8 };
      prism(rc, b, [44, 40, 56], [32, 30, 40]);
      const neon = glow(v.live || night > 0.3 ? C.neonPink : [180, 60, 130], 0.95);
      rc.ctx.lineWidth = Math.max(1, rc.cam.zoom * 0.8);
      rc.ctx.strokeStyle = neon;
      const lf = leftFace(rc, b);
      const rf = rightFace(rc, b);
      rc.ctx.beginPath();
      [lf, rf].forEach(f => {
        const a = f(0, 0.86);
        const c = f(1, 0.86);
        rc.ctx.moveTo(a[0], a[1]);
        rc.ctx.lineTo(c[0], c[1]);
      });
      rc.ctx.stroke();
      poly(rc, faceQuad(lf, 0.4, 0.6, 0, 0.4), glow(C.neonCyan, night > 0.3 ? 0.9 : 0.5));
      return P(rc, x + 0.5, y + 0.5, b.z1 + 1.5);
    }
    case 'theatre': {
      const b: Box = { x0: x + 0.1, y0: y + 0.12, x1: x + w - 0.1, y1: y + h - 0.1, z0: z, z1: z + 2.4 };
      prism(rc, b, [226, 208, 170], [210, 196, 160]);
      windows(rc, { ...b, z0: b.z0 + 1.1 }, 1, v.seed, 4);
      // Marquee band — lights up for a show.
      poly(rc, faceQuad(leftFace(rc, b), 0.05, 0.95, 0.25, 0.42), v.live ? glow([255, 210, 90]) : paint(C.marquee));
      poly(rc, faceQuad(rightFace(rc, b), 0.05, 0.95, 0.25, 0.42), v.live ? glow([255, 190, 70]) : paint(C.marquee, 0.8));
      // Fly tower at the back.
      prism(rc, { x0: x + 0.6, y0: y + 0.15, x1: x + w - 0.3, y1: y + 0.6, z0: b.z1, z1: b.z1 + 1.6 }, [196, 180, 148], [170, 160, 140]);
      return P(rc, x + w / 2, y + h / 2, b.z1 + 2.6);
    }
    case 'arena': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) * 0.46;
      const top = cylinderWall(rc, cx, cy, z, z + 2.6, r, [196, 198, 206]);
      fillEllipse(rc, top, paint([150, 160, 176], 1.05));
      // Dome with a highlight and ribs.
      const dome = isoEllipse(rc, cx, cy, z + 3.4, r * 0.78);
      fillEllipse(rc, { ...dome, ry: dome.ry * 1.25 }, paint([180, 190, 204], 1.1));
      fillEllipse(rc, { sx: dome.sx - dome.rx * 0.25, sy: dome.sy - dome.ry * 0.3, rx: dome.rx * 0.35, ry: dome.ry * 0.4 }, paint([230, 236, 244], 1));
      if (v.live) {
        rc.ctx.strokeStyle = glow(v.liveColor, 0.9);
        rc.ctx.lineWidth = Math.max(1, rc.cam.zoom);
        rc.ctx.beginPath();
        rc.ctx.ellipse(top.sx, top.sy, top.rx, top.ry, 0, 0, Math.PI * 2);
        rc.ctx.stroke();
      }
      return P(rc, cx, cy, z + 6);
    }
    case 'stadium': {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const r = Math.min(w, h) * 0.47;
      const top = cylinderWall(rc, cx, cy, z, z + 2.2, r, [184, 184, 190]);
      fillEllipse(rc, top, paint([120, 30, 40]));
      fillEllipse(rc, { ...top, rx: top.rx * 0.86, ry: top.ry * 0.86 }, paint([200, 200, 205]));
      fillEllipse(rc, { ...top, rx: top.rx * 0.74, ry: top.ry * 0.74 }, paint([40, 80, 150]));
      const pitch = { ...top, sy: top.sy + top.ry * 0.12, rx: top.rx * 0.58, ry: top.ry * 0.5 };
      fillEllipse(rc, pitch, paint(C.pitch));
      // Stage at one end when live.
      if (v.live) {
        rc.ctx.fillStyle = glow(v.liveColor, 0.9);
        rc.ctx.fillRect(pitch.sx - pitch.rx * 0.3, pitch.sy - pitch.ry * 0.85, pitch.rx * 0.6, pitch.ry * 0.35);
      }
      // Floodlight towers.
      [0.25, 0.75, 1.25, 1.75].forEach(a => {
        const ang = a * Math.PI;
        const px = cx + Math.cos(ang) * r * 1.02;
        const py = cy + Math.sin(ang) * r * 1.02;
        const [bx, by] = P(rc, px, py, z);
        const [, ty] = P(rc, px, py, z + 6);
        rc.ctx.strokeStyle = paint([90, 90, 96]);
        rc.ctx.lineWidth = Math.max(1, rc.cam.zoom * 0.6);
        rc.ctx.beginPath();
        rc.ctx.moveTo(bx, by);
        rc.ctx.lineTo(bx, ty);
        rc.ctx.stroke();
        rc.ctx.fillStyle = night > 0.25 || v.live ? glow(C.flood) : paint([200, 200, 190]);
        rc.ctx.fillRect(bx - rc.cam.zoom * 2.5, ty - rc.cam.zoom * 1.5, rc.cam.zoom * 5, rc.cam.zoom * 2.5);
      });
      return P(rc, cx, cy, z + 7);
    }
    default:
      return P(rc, x + w / 2, y + h / 2, z + 2);
  }
}

// ---------------------------------------------------------------------------
// Warehouses
// ---------------------------------------------------------------------------

export function warehouse(rc: RC, x: number, y: number, z: number, brand: RGB, seed: number, isHq: boolean): Pt {
  groundQuad(rc, x + 0.04, y + 0.04, x + 1.96, y + 1.96, z, paint(C.yard));
  // Yard markings for parking bays.
  if (rc.cam.zoom >= 1.4) {
    rc.ctx.strokeStyle = paint(C.marking, 0.9, 0.7);
    rc.ctx.lineWidth = Math.max(0.5, rc.cam.zoom * 0.3);
    rc.ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const a = P(rc, x + 0.15 + i * 0.42, y + 1.45, z);
      const b = P(rc, x + 0.15 + i * 0.42, y + 1.9, z);
      rc.ctx.moveTo(a[0], a[1]);
      rc.ctx.lineTo(b[0], b[1]);
    }
    rc.ctx.stroke();
  }
  const b: Box = { x0: x + 0.12, y0: y + 0.12, x1: x + 1.88, y1: y + 1.25, z0: z, z1: z + 2.2 };
  prism(rc, b, [196, 198, 202], brand);
  // Brand stripe and loading-bay doors.
  poly(rc, faceQuad(leftFace(rc, b), 0, 1, 0.72, 0.86), paint(brand, 1));
  poly(rc, faceQuad(rightFace(rc, b), 0, 1, 0.72, 0.86), paint(brand, 0.8));
  for (let i = 0; i < 3; i++) {
    poly(rc, faceQuad(leftFace(rc, b), 0.08 + i * 0.32, 0.3 + i * 0.32, 0, 0.55), paint([70, 74, 82]));
  }
  // Corrugated roof lines.
  if (rc.cam.zoom >= 1.2) {
    rc.ctx.strokeStyle = paint(brand, 0.75);
    rc.ctx.lineWidth = Math.max(0.5, rc.cam.zoom * 0.3);
    rc.ctx.beginPath();
    for (let i = 1; i < 8; i++) {
      const u = b.x0 + ((b.x1 - b.x0) * i) / 8;
      const a = P(rc, u, b.y0, b.z1);
      const c = P(rc, u, b.y1, b.z1);
      rc.ctx.moveTo(a[0], a[1]);
      rc.ctx.lineTo(c[0], c[1]);
    }
    rc.ctx.stroke();
  }
  // Office block with lit windows.
  const office: Box = { x0: x + 1.4, y0: y + 1.3, x1: x + 1.88, y1: y + 1.86, z0: z, z1: z + 1.4 };
  prism(rc, office, [220, 222, 226], [180, 182, 186]);
  windows(rc, office, 1, seed, 2);
  // Flag.
  const [fx, fy] = P(rc, x + 0.25, y + 1.75, z);
  const s = rc.cam.zoom;
  rc.ctx.fillStyle = paint([200, 200, 200]);
  rc.ctx.fillRect(fx - s * 0.4, fy - s * 22, s * 0.8, s * 22);
  const wave = Math.sin(rc.time / 300 + seed) * s * 1.2;
  rc.ctx.beginPath();
  rc.ctx.moveTo(fx, fy - s * 22);
  rc.ctx.lineTo(fx + s * 9, fy - s * 20 + wave);
  rc.ctx.lineTo(fx, fy - s * (isHq ? 15 : 17));
  rc.ctx.closePath();
  rc.ctx.fillStyle = paint(brand, 1.1);
  rc.ctx.fill();
  return P(rc, x + 1, y + 0.7, b.z1 + 2);
}

// ---------------------------------------------------------------------------
// Vehicles
// ---------------------------------------------------------------------------

export interface VehicleDraw {
  x: number;
  y: number;
  z: number;
  dir: number;
  kind: 'van' | 'truck' | 'semi' | 'bus';
  color: RGB;
  broken: boolean;
  selected: boolean;
}

/** Draws a vehicle centred at (x, y) facing `dir`; returns its screen centre for picking. */
export function vehicle(rc: RC, v: VehicleDraw): Pt {
  const len = { van: 0.42, truck: 0.56, semi: 0.8, bus: 0.72 }[v.kind];
  const wid = v.kind === 'van' ? 0.22 : 0.26;
  const tall = { van: 1.0, truck: 1.5, semi: 1.6, bus: 1.45 }[v.kind];
  const along = v.dir === 0 || v.dir === 2;
  const sign = v.dir === 0 || v.dir === 1 ? 1 : -1;
  const hl = len / 2;
  const hw = wid / 2;
  const box = (a0: number, a1: number, h0: number, h1: number): Box =>
    along
      ? { x0: v.x + a0, x1: v.x + a1, y0: v.y - hw, y1: v.y + hw, z0: v.z + h0, z1: v.z + h1 }
      : { x0: v.x - hw, x1: v.x + hw, y0: v.y + a0, y1: v.y + a1, z0: v.z + h0, z1: v.z + h1 };
  // Front of vehicle is at +hl*sign along the travel axis.
  const cabLen = v.kind === 'van' || v.kind === 'bus' ? 0 : 0.2;
  const front = sign > 0 ? [hl - cabLen, hl] : [-hl, -hl + cabLen];
  const body = sign > 0 ? [-hl, hl - cabLen - 0.02] : [-hl + cabLen + 0.02, hl];

  // Shadow.
  const [sx, sy] = P(rc, v.x, v.y, v.z);
  rc.ctx.fillStyle = 'rgba(0,0,0,0.22)';
  rc.ctx.beginPath();
  rc.ctx.ellipse(sx, sy + rc.cam.zoom, len * TW * 0.45 * rc.cam.zoom, len * TH * 0.4 * rc.cam.zoom, 0, 0, Math.PI * 2);
  rc.ctx.fill();

  const parts: { b: Box; wall: RGB; top: RGB }[] = [];
  if (cabLen > 0) {
    parts.push({ b: box(body[0], body[1], 0.15, tall), wall: v.kind === 'semi' ? [228, 228, 232] : v.color, top: [220, 220, 224] });
    parts.push({ b: box(front[0], front[1], 0.15, tall * 0.7), wall: v.color, top: v.color });
  } else {
    parts.push({ b: box(-hl, hl, 0.15, tall), wall: v.color, top: [225, 225, 228] });
  }
  // Painter's order within the vehicle: the part further from the viewer first.
  parts.sort((a, b) => a.b.x0 + a.b.y0 - (b.b.x0 + b.b.y0));
  parts.forEach(p => prism(rc, p.b, p.wall, p.top));
  if (v.kind === 'semi') {
    const trailer = parts.find(p => p.wall[0] === 228)?.b;
    if (trailer) poly(rc, faceQuad(along ? leftFace(rc, trailer) : rightFace(rc, trailer), 0.1, 0.9, 0.35, 0.65), paint(v.color));
  }
  if (v.kind === 'bus' || v.kind === 'van') {
    const b = parts[0].b;
    poly(rc, faceQuad(along ? leftFace(rc, b) : rightFace(rc, b), 0.08, 0.92, 0.55, 0.8), paint([40, 50, 64]));
  }
  // Headlights at night.
  if (getNight() > 0.35 && !v.broken) {
    const [hx, hy] = P(rc, v.x + (along ? sign * (hl + 0.15) : 0), v.y + (along ? 0 : sign * (hl + 0.15)), v.z + 0.3);
    const g = rc.ctx.createRadialGradient(hx, hy, 0, hx, hy, 8 * rc.cam.zoom);
    g.addColorStop(0, 'rgba(255,245,200,0.55)');
    g.addColorStop(1, 'rgba(255,245,200,0)');
    rc.ctx.fillStyle = g;
    rc.ctx.fillRect(hx - 8 * rc.cam.zoom, hy - 8 * rc.cam.zoom, 16 * rc.cam.zoom, 16 * rc.cam.zoom);
  }
  const [cx, cy] = P(rc, v.x, v.y, v.z + tall);
  if (v.broken) {
    // Rising smoke puffs and a hazard blink.
    for (let i = 0; i < 3; i++) {
      const t = ((rc.time / 900 + i / 3) % 1);
      rc.ctx.fillStyle = paint(C.smoke, 1, 0.65 * (1 - t));
      rc.ctx.beginPath();
      rc.ctx.arc(cx + Math.sin(t * 6 + i) * 3 * rc.cam.zoom, cy - t * 18 * rc.cam.zoom, (2 + t * 4) * rc.cam.zoom, 0, Math.PI * 2);
      rc.ctx.fill();
    }
    if (Math.floor(rc.time / 400) % 2 === 0) {
      rc.ctx.fillStyle = glow([255, 140, 0]);
      rc.ctx.fillRect(cx - rc.cam.zoom * 1.5, cy - rc.cam.zoom * 1.5, rc.cam.zoom * 3, rc.cam.zoom * 3);
    }
  }
  if (v.selected) {
    rc.ctx.strokeStyle = glow([255, 255, 255], 0.9);
    rc.ctx.lineWidth = Math.max(1, rc.cam.zoom * 0.6);
    rc.ctx.beginPath();
    rc.ctx.ellipse(sx, sy, len * TW * 0.55 * rc.cam.zoom, len * TH * 0.55 * rc.cam.zoom, 0, 0, Math.PI * 2);
    rc.ctx.stroke();
  }
  return [cx, (cy + sy) / 2];
}

