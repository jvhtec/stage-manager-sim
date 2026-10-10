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

/** Which way shadows fall (tiles per tile of height) — the sun is behind and to the left. */
const SHADOW_DX = 0.62;
const SHADOW_DY = 0.18;
/** Shadows never reach further than this many tile diagonals (the renderer draws objects that far behind the ground). */
export const SHADOW_LAG = 2;
/** Tallest height a shadow is cast for, so it stays within SHADOW_LAG diagonals. */
const SHADOW_MAX_H = SHADOW_LAG / (SHADOW_DX + SHADOW_DY);

/**
 * A soft ground shadow for a box-shaped footprint of the given height: the footprint swept along the
 * sun's direction, filled once (so overlaps don't double up). Fades with the daylight.
 */
export function boxShadow(rc: RC, x0: number, y0: number, x1: number, y1: number, z: number, height: number) {
  if (rc.cam.zoom < 0.7) return;
  const strength = 0.17 * (1 - getNight() * 0.9);
  if (strength < 0.02) return;
  const { ctx } = rc;
  const h = Math.min(height, SHADOW_MAX_H);
  const ox = SHADOW_DX * h;
  const oy = SHADOW_DY * h;
  // The footprint and the same footprint slid along the shadow: the hull of the eight corners is the shadow.
  const pts: Pt[] = [];
  for (const [dx, dy] of [[0, 0], [ox, oy]]) {
    pts.push(P(rc, x0 + dx, y0 + dy, z), P(rc, x1 + dx, y0 + dy, z), P(rc, x1 + dx, y1 + dy, z), P(rc, x0 + dx, y1 + dy, z));
  }
  const hull = convexHull(pts);
  ctx.beginPath();
  hull.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
  ctx.closePath();
  ctx.fillStyle = `rgba(14,20,34,${strength})`;
  ctx.fill();
}

/** Andrew's monotone chain. */
function convexHull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const pt of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], pt) <= 0) lower.pop();
    lower.push(pt);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const pt = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], pt) <= 0) upper.pop();
    upper.push(pt);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/** A round blob shadow (trees, poles), stretched along the sun's direction. */
export function blobShadow(rc: RC, x: number, y: number, z: number, radius: number, height: number) {
  if (rc.cam.zoom < 0.7) return;
  const strength = 0.2 * (1 - getNight() * 0.9);
  if (strength < 0.03) return;
  const { ctx } = rc;
  const sh = Math.min(height, SHADOW_MAX_H);
  const [sx, sy] = P(rc, x + SHADOW_DX * sh * 0.5, y + SHADOW_DY * sh * 0.5, z);
  const rx = radius * TW * 0.5 * rc.cam.zoom * (1 + height * 0.25);
  const ry = radius * TH * 0.5 * rc.cam.zoom;
  ctx.fillStyle = `rgba(14,20,34,${strength})`;
  ctx.beginPath();
  ctx.ellipse(sx, sy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
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
  const tint = 0.9 + hash2(Math.round(x * 13), Math.round(y * 13), 77) * 0.22;
  blobShadow(rc, x, y, z, conifer ? 0.5 : 0.55, conifer ? 1.6 : 1.2);
  ctx.fillStyle = paint(C.trunk);
  ctx.fillRect(sx - s * 0.08, sy - s * 0.5, s * 0.16, s * 0.5);
  if (conifer) {
    // Three tiers, each with a lit left half and a shaded right half.
    for (let i = 0; i < 3; i++) {
      const base = sy - s * (0.3 + i * 0.36);
      const w = s * (0.58 - i * 0.14);
      const tip = base - s * 0.7;
      const shade = C.pine;
      ctx.beginPath();
      ctx.moveTo(sx - w, base);
      ctx.lineTo(sx, tip);
      ctx.lineTo(sx, base);
      ctx.closePath();
      ctx.fillStyle = paint(i % 2 ? C.pineLight : shade, tint * 1.12);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(sx + w, base);
      ctx.lineTo(sx, tip);
      ctx.lineTo(sx, base);
      ctx.closePath();
      ctx.fillStyle = paint(i % 2 ? C.pineLight : shade, tint * 0.8);
      ctx.fill();
    }
  } else {
    // A rounded crown: dark body, a lit cap and a highlight.
    ctx.beginPath();
    ctx.arc(sx, sy - s * 0.85, s * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = paint(C.leaf, 0.8 * tint);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx - s * 0.08, sy - s * 0.92, s * 0.42, 0, Math.PI * 2);
    ctx.fillStyle = paint(C.leaf, 1.0 * tint);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(sx - s * 0.18, sy - s * 1.02, s * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = paint(C.leaf, 1.25 * tint);
    ctx.fill();
  }
}

export function house(rc: RC, x: number, y: number, z: number, floors: number, color: number, seed: number) {
  const wall = BUILDING_WALLS[color % BUILDING_WALLS.length];
  const inset = floors >= 4 ? 0.1 : 0.16;
  const b: Box = { x0: x + inset, y0: y + inset, x1: x + 1 - inset, y1: y + 1 - inset, z0: z, z1: z + floors * 1.15 };
  boxShadow(rc, b.x0, b.y0, b.x1, b.y1, z, floors * 1.15 + (floors <= 2 ? 0.9 : 0));
  prism(rc, b, wall, floors >= 3 ? C.concrete : wall);
  // Darker footing where the wall meets the ground.
  if (rc.cam.zoom >= 1.1) {
    poly(rc, faceQuad(leftFace(rc, b), 0, 1, 0, 0.08), paint(C.black, 1, 0.16));
    poly(rc, faceQuad(rightFace(rc, b), 0, 1, 0, 0.08), paint(C.black, 1, 0.2));
  }
  windows(rc, b, floors, seed, floors >= 4 ? 3 : 2);
  // A front door on low houses.
  if (floors <= 2 && rc.cam.zoom >= 1.4) {
    poly(rc, faceQuad(leftFace(rc, b), 0.42, 0.58, 0, 0.5), paint([88, 58, 44]));
  }
  if (floors <= 2) {
    const roof: RGB = color % 2 ? [128, 64, 52] : [86, 88, 98];
    pitchedRoof(rc, b, 0.9, roof);
    // Ridge highlight and a chimney on some.
    if (rc.cam.zoom >= 1.1) {
      const ym = (b.y0 + b.y1) / 2;
      const r0 = P(rc, b.x0, ym, b.z1 + 0.9);
      const r1 = P(rc, b.x1, ym, b.z1 + 0.9);
      rc.ctx.strokeStyle = paint(C.white, 1, 0.5);
      rc.ctx.lineWidth = Math.max(0.6, rc.cam.zoom * 0.5);
      rc.ctx.beginPath();
      rc.ctx.moveTo(r0[0], r0[1]);
      rc.ctx.lineTo(r1[0], r1[1]);
      rc.ctx.stroke();
    }
    if (hash2(seed, 3, 9) < 0.45) {
      const cx = b.x0 + (b.x1 - b.x0) * 0.72;
      const cy = (b.y0 + b.y1) / 2 - 0.05;
      prism(rc, { x0: cx, y0: cy, x1: cx + 0.1, y1: cy + 0.1, z0: b.z1 + 0.5, z1: b.z1 + 1.25 }, [142, 92, 78], [96, 62, 52], false);
    }
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
  const tallness: Record<string, number> = { pub: 2.4, hall: 2.8, club: 1.9, theatre: 3, arena: 3.2, stadium: 3.4, airport: 1.6 };
  boxShadow(rc, x + 0.1, y + 0.1, x + w - 0.1, y + h - 0.1, z, tallness[v.kind] ?? 2.5);

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
    case 'airport': {
      // Runway along x with centreline dashes and threshold bars.
      groundQuad(rc, x + 0.02, y + 0.12, x + w - 0.02, y + 0.88, z + 0.01, paint([70, 72, 78]));
      if (rc.cam.zoom >= 0.9) {
        rc.ctx.strokeStyle = paint(C.white, 1, 0.9);
        rc.ctx.lineWidth = Math.max(0.6, rc.cam.zoom * 0.5);
        rc.ctx.setLineDash([rc.cam.zoom * 4, rc.cam.zoom * 3]);
        rc.ctx.beginPath();
        const a = P(rc, x + 0.2, y + 0.5, z + 0.02);
        const b = P(rc, x + w - 0.2, y + 0.5, z + 0.02);
        rc.ctx.moveTo(a[0], a[1]);
        rc.ctx.lineTo(b[0], b[1]);
        rc.ctx.stroke();
        rc.ctx.setLineDash([]);
      }
      // Terminal, control tower, and a jet on the apron.
      const terminal: Box = { x0: x + 0.15, y0: y + 1.12, x1: x + 1.7, y1: y + 1.88, z0: z, z1: z + 1.5 };
      prism(rc, terminal, [200, 214, 228], [170, 180, 194]);
      windows(rc, terminal, 1, v.seed, 5);
      prism(rc, { x0: x + 2.35, y0: y + 1.35, x1: x + 2.6, y1: y + 1.6, z0: z, z1: z + 4.2 }, [214, 214, 210], [190, 190, 186]);
      prism(rc, { x0: x + 2.25, y0: y + 1.25, x1: x + 2.7, y1: y + 1.7, z0: z + 4.2, z1: z + 4.9 }, [80, 110, 140], [200, 200, 196]);
      plane(rc, x + 2.0, y + 1.45, z, 0.6);
      if (v.live) {
        // A freighter taking off every few seconds while a rig is abroad.
        const t = (rc.time / 5000 + v.seed * 0.1) % 1;
        const px = x + 0.3 + t * (w + 1.5);
        const pz = z + Math.max(0, t - 0.45) * 22;
        plane(rc, px, y + 0.5, pz, 0.8);
      }
      return P(rc, x + w / 2, y + h / 2, z + 5.5);
    }
    default:
      return P(rc, x + w / 2, y + h / 2, z + 2);
  }
}

/** A jet pointing along +x. */
function plane(rc: RC, x: number, y: number, z: number, size: number) {
  const L = 0.9 * size;
  const W = 0.13 * size;
  // Wings first (they sit behind the fuselage from this view).
  poly(
    rc,
    [P(rc, x - 0.05 * size, y - 0.55 * size, z + 0.35 * size), P(rc, x + 0.12 * size, y - 0.05 * size, z + 0.35 * size), P(rc, x + 0.12 * size, y + 0.05 * size, z + 0.35 * size), P(rc, x - 0.05 * size, y + 0.55 * size, z + 0.35 * size), P(rc, x - 0.2 * size, y, z + 0.35 * size)],
    paint([210, 214, 222]),
  );
  prism(rc, { x0: x - L / 2, y0: y - W / 2, x1: x + L / 2, y1: y + W / 2, z0: z + 0.2 * size, z1: z + 0.5 * size }, [236, 238, 242], [246, 247, 250]);
  // Tail fin.
  poly(rc, [P(rc, x - L / 2, y, z + 0.5 * size), P(rc, x - L / 2 + 0.18 * size, y, z + 0.5 * size), P(rc, x - L / 2, y, z + 0.95 * size)], paint([200, 40, 60]));
}

// ---------------------------------------------------------------------------
// Warehouses
// ---------------------------------------------------------------------------

/** A branch office: a two-storey glass-fronted block with a sign and a lock-up. */
export function delegation(rc: RC, x: number, y: number, z: number, brand: RGB, seed: number): Pt {
  groundQuad(rc, x + 0.04, y + 0.04, x + 1.96, y + 1.96, z, paint(C.pavement));
  boxShadow(rc, x + 0.15, y + 0.15, x + 1.85, y + 1.35, z, 2.4);
  // Lock-up garage at the back.
  const lockup: Box = { x0: x + 0.15, y0: y + 0.15, x1: x + 0.95, y1: y + 0.85, z0: z, z1: z + 1.1 };
  prism(rc, lockup, [176, 178, 182], [150, 152, 156]);
  poly(rc, faceQuad(rightFace(rc, lockup), 0.15, 0.85, 0, 0.75), paint([96, 100, 108]));
  const office: Box = { x0: x + 0.95, y0: y + 0.25, x1: x + 1.85, y1: y + 1.35, z0: z, z1: z + 2.4 };
  prism(rc, office, [214, 218, 224], [170, 174, 180]);
  // Glass curtain wall on both faces.
  poly(rc, faceQuad(leftFace(rc, office), 0.06, 0.94, 0.08, 0.8), paint([86, 120, 150], 1));
  poly(rc, faceQuad(rightFace(rc, office), 0.06, 0.94, 0.08, 0.8), paint([70, 100, 128], 1));
  windows(rc, office, 2, seed, 3);
  // Brand fascia.
  poly(rc, faceQuad(leftFace(rc, office), 0, 1, 0.84, 0.98), paint(brand, 1.05));
  poly(rc, faceQuad(rightFace(rc, office), 0, 1, 0.84, 0.98), paint(brand, 0.85));
  return P(rc, x + 1.4, y + 0.8, office.z1 + 1.5);
}

export function warehouse(rc: RC, x: number, y: number, z: number, brand: RGB, seed: number, isHq: boolean, size = 1): Pt {
  groundQuad(rc, x + 0.04, y + 0.04, x + 1.96, y + 1.96, z, paint(C.yard));
  boxShadow(rc, x + 0.12, y + 0.12, x + 1.88, y + 1.3 + (size - 1) * 0.08, z, 2.2 + (size - 1) * 0.7);
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
  const b: Box = { x0: x + 0.12, y0: y + 0.12, x1: x + 1.88, y1: y + 1.25 + (size - 1) * 0.08, z0: z, z1: z + 2.2 + (size - 1) * 0.7 };
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
  // Wheels on the visible long side, and a darker skirt along the bottom.
  if (rc.cam.zoom >= 0.9) {
    parts.forEach((p, idx) => {
      const face = along ? leftFace(rc, p.b) : rightFace(rc, p.b);
      poly(rc, faceQuad(face, 0, 1, 0, 0.14), paint(C.black, 1, 0.45));
      const isCab = cabLen > 0 && p.wall === v.color && idx !== -1 && p.b === parts.find(q => q.top === v.color)?.b;
      const spots = isCab ? [0.5] : cabLen > 0 || v.kind === 'semi' ? [0.18, 0.82] : [0.2, 0.8];
      spots.forEach(u => {
        poly(rc, faceQuad(face, u - 0.09, u + 0.09, 0, 0.3), paint(C.tyre));
        poly(rc, faceQuad(face, u - 0.035, u + 0.035, 0.07, 0.2), paint([150, 152, 158]));
      });
    });
  }
  if (v.kind === 'semi') {
    const trailer = parts.find(p => p.wall[0] === 228)?.b;
    if (trailer) poly(rc, faceQuad(along ? leftFace(rc, trailer) : rightFace(rc, trailer), 0.1, 0.9, 0.35, 0.65), paint(v.color));
  }
  if (v.kind === 'bus' || v.kind === 'van') {
    const b = parts[0].b;
    poly(rc, faceQuad(along ? leftFace(rc, b) : rightFace(rc, b), 0.08, 0.92, 0.55, 0.8), paint([40, 50, 64]));
  } else if (cabLen > 0) {
    // Cab windows on the long side and the windscreen.
    const cab = parts.find(p => p.top === v.color)?.b;
    if (cab) {
      poly(rc, faceQuad(along ? leftFace(rc, cab) : rightFace(rc, cab), 0.12, 0.88, 0.5, 0.86), paint([40, 54, 70]));
      poly(rc, faceQuad(along ? rightFace(rc, cab) : leftFace(rc, cab), 0.1, 0.9, 0.5, 0.86), paint([34, 46, 62]));
    }
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


/** A roll-on roll-off ferry: dark hull, white superstructure, a funnel; `along` = 0 sails +x, 1 sails +y. */
export function ferry(rc: RC, x: number, y: number, along: 0 | 1) {
  const L = 0.42;
  const W = 0.16;
  const [hx, hy] = along === 0 ? [L, W] : [W, L];
  blobShadow(rc, x, y, 0, 0.3, 0.2);
  prism(rc, { x0: x - hx, y0: y - hy, x1: x + hx, y1: y + hy, z0: 0, z1: 0.18 }, [38, 52, 84], [70, 84, 110]);
  const [sx, sy] = along === 0 ? [hx * 0.6, hy * 0.75] : [hx * 0.75, hy * 0.6];
  prism(rc, { x0: x - sx, y0: y - sy, x1: x + sx, y1: y + sy, z0: 0.18, z1: 0.36 }, [236, 238, 242], [250, 250, 252]);
  const fx = along === 0 ? x + hx * 0.25 : x;
  const fy = along === 0 ? y : y + hy * 0.25;
  prism(rc, { x0: fx - 0.04, y0: fy - 0.04, x1: fx + 0.04, y1: fy + 0.04, z0: 0.36, z1: 0.5 }, [200, 40, 40], [220, 60, 60], false);
}
