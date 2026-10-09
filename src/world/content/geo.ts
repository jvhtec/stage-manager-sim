/**
 * Real geography for the miniature maps: where each country's coast runs, where its
 * cities and mountain ranges really are, projected onto the game's tile grid.
 *
 * The projection must match scripts/gen-landmask.mjs, which rasterised the coastlines.
 */
import params from './geoParams.json';
import { HOMEMASKS, LANDMASKS } from './landmasks';

export const GEO_W = 72;
export const GEO_H = 56;

interface Range {
  name: string;
  line: [number, number][];
  power: number;
  /** Half-width in km. */
  width: number;
}

export interface GeoParams {
  lat: [number, number];
  lon: [number, number];
  exclude: string[];
  cities: Record<string, [number, number]>;
  ranges: Range[];
}

const PARAMS = params as unknown as Record<string, GeoParams>;

export const hasGeo = (code: string) => code in PARAMS && code in LANDMASKS;

export interface Projection {
  /** Latitude/longitude → fractional tile-corner coordinates. */
  toTile: (lat: number, lon: number) => { x: number; y: number };
  /** Ground distance of one tile. */
  kmPerTile: number;
}

export function projectionFor(code: string): Projection {
  const p = PARAMS[code];
  const [latMin, latMax] = p.lat;
  const [lonMin, lonMax] = p.lon;
  const latC = (latMin + latMax) / 2;
  const lonC = (lonMin + lonMax) / 2;
  const k = Math.cos((latC * Math.PI) / 180);
  const scale = Math.min(GEO_W / ((lonMax - lonMin) * k), GEO_H / (latMax - latMin));
  return {
    toTile: (lat, lon) => ({ x: GEO_W / 2 + (lon - lonC) * scale * k, y: GEO_H / 2 - (lat - latC) * scale }),
    kmPerTile: 111 / scale,
  };
}

export const geoCities = (code: string) => PARAMS[code].cities;
export const geoExcluded = (code: string) => PARAMS[code].exclude;

function unpack(b64: string): Uint8Array {
  const bin = atob(b64);
  const n = (GEO_W + 1) * (GEO_H + 1);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return out;
}

/** Land (1) / sea (0) on the (W+1)×(H+1) corner grid — neighbouring countries count as land. */
export const landMask = (code: string) => unpack(LANDMASKS[code]);

/** 1 where the corner lies inside the country itself. */
export const homeMask = (code: string) => unpack(HOMEMASKS[code]);

/** How strongly the country's mountain ranges lift the ground at a corner, 0 to ~1. */
export function rangeLift(code: string): (x: number, y: number) => number {
  const proj = projectionFor(code);
  const segs = PARAMS[code].ranges.map(r => {
    const pts = r.line.map(([lat, lon]) => proj.toTile(lat, lon));
    return { pts, power: r.power, reach: (r.width * 1.3) / proj.kmPerTile };
  });
  return (x, y) => {
    let best = 0;
    for (const s of segs) {
      let d = Infinity;
      for (let i = 0; i < s.pts.length - 1; i++) {
        const a = s.pts[i];
        const b = s.pts[i + 1];
        const vx = b.x - a.x;
        const vy = b.y - a.y;
        const len2 = vx * vx + vy * vy || 1;
        const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (y - a.y) * vy) / len2));
        d = Math.min(d, Math.hypot(x - (a.x + vx * t), y - (a.y + vy * t)));
      }
      if (s.pts.length === 1) d = Math.hypot(x - s.pts[0].x, y - s.pts[0].y);
      const lift = s.power * Math.max(0, 1 - d / Math.max(5, s.reach));
      best = Math.max(best, lift);
    }
    return best;
  };
}
