/**
 * Isometric projection, Transport Tycoon style: 2:1 diamond tiles, integer
 * height levels on tile corners, painter's-algorithm drawing by diagonal.
 *
 * "Base" pixels are at zoom 1 (a 32×16 tile); the camera scales them.
 */
import { heightAt } from '@/world/mapgen';
import { Terrain, type WorldMap } from '@/world/types';

export const TW = 32;
export const TH = 16;
/** Base pixels per height level. */
export const HZ = 6;

export interface Camera {
  /** World base-pixel coordinate shown at the centre of the screen. */
  x: number;
  y: number;
  zoom: number;
  /** Viewport size in CSS pixels. */
  w: number;
  h: number;
}

export type Pt = [number, number];

export function toBase(tx: number, ty: number, tz: number): Pt {
  return [((tx - ty) * TW) / 2, ((tx + ty) * TH) / 2 - tz * HZ];
}

export function project(cam: Camera, tx: number, ty: number, tz: number): Pt {
  const bx = ((tx - ty) * TW) / 2;
  const by = ((tx + ty) * TH) / 2 - tz * HZ;
  return [(bx - cam.x) * cam.zoom + cam.w / 2, (by - cam.y) * cam.zoom + cam.h / 2];
}

/** Ground height at a tile-space point, with bridges riding one level above the water. */
export function groundZ(map: WorldMap, fx: number, fy: number): number {
  const tx = Math.floor(fx);
  const ty = Math.floor(fy);
  if (tx >= 0 && ty >= 0 && tx < map.width && ty < map.height) {
    const i = ty * map.width + tx;
    if (map.road[i] && map.terrain[i] === Terrain.Water) return 1;
  }
  return heightAt(map, fx, fy);
}

/** Centre the camera on a tile-space point. */
export function centreOn(cam: Camera, map: WorldMap, tx: number, ty: number): Camera {
  const [bx, by] = toBase(tx, ty, groundZ(map, tx, ty));
  return { ...cam, x: bx, y: by };
}

function pointInQuad(px: number, py: number, q: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = q.length - 1; i < q.length; j = i++) {
    const [xi, yi] = q[i];
    const [xj, yj] = q[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The tile under a screen point, accounting for terrain height. */
export function pickTile(cam: Camera, map: WorldMap, sx: number, sy: number): { x: number; y: number } | null {
  const bx = (sx - cam.w / 2) / cam.zoom + cam.x;
  const by = (sy - cam.h / 2) / cam.zoom + cam.y;
  const cw = map.width + 1;
  let best: { x: number; y: number } | null = null;
  // Higher ground shows up further up the screen, so test a column of candidates.
  for (let z = 0; z <= 6; z++) {
    const a = (2 * bx) / TW; // x - y
    const b = (2 * (by + z * HZ)) / TH; // x + y
    const cx = Math.floor((a + b) / 2);
    const cy = Math.floor((b - a) / 2);
    for (let oy = -1; oy <= 1; oy++) {
      for (let ox = -1; ox <= 1; ox++) {
        const x = cx + ox;
        const y = cy + oy;
        if (x < 0 || y < 0 || x >= map.width || y >= map.height) continue;
        const h = map.heights;
        const q: Pt[] = [
          project(cam, x, y, h[y * cw + x]),
          project(cam, x + 1, y, h[y * cw + x + 1]),
          project(cam, x + 1, y + 1, h[(y + 1) * cw + x + 1]),
          project(cam, x, y + 1, h[(y + 1) * cw + x]),
        ];
        if (pointInQuad(sx, sy, q) && (!best || x + y > best.x + best.y)) best = { x, y };
      }
    }
  }
  return best;
}
