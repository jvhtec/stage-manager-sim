/**
 * Real geography for the miniature maps: where each country's coast runs, where its
 * cities and mountain ranges really are, projected onto the game's tile grid.
 *
 * The projection must match scripts/gen-landmask.mjs, which rasterised the coastlines.
 */
import params from './geoParams.json';
import { HOMEMASKS, LANDMASKS, SIZES } from './landmasks';

/** Grid size in tiles. */
export const sizeOfGeo = (code: string): [number, number] => SIZES[code];

interface Range {
  name: string;
  line: [number, number][];
  power: number;
  /** Half-width in km. */
  width: number;
}

export interface AbroadTown {
  name: string;
  at: [number, number];
  pop: number;
  /** ISO code of the neighbouring country. */
  country: string;
  flag: string;
  /** Real rooms by kind; the rest get plain names. */
  venues: Partial<Record<'pub' | 'hall' | 'club' | 'theatre' | 'arena', string>>;
}

export interface FixedLink {
  name: string;
  at: [number, number];
  kind: 'bridge' | 'tunnel';
  /** Before this year the crossing is a ferry. */
  opens: number;
}

export interface MotorwayDef {
  name: string;
  from: string;
  to: string;
  opens: number;
  toll: boolean;
}

/** A historic internal border (the GDR until 1990): crossing it costs time while it stands. */
export interface ZoneDef {
  name: string;
  until: number;
  poly: [number, number][];
}

export interface GeoParams {
  lat: [number, number];
  lon: [number, number];
  exclude: string[];
  cities: Record<string, [number, number]>;
  ranges: Range[];
  abroad: AbroadTown[];
  links: FixedLink[];
  motorways: MotorwayDef[];
  zones?: ZoneDef[];
  /** Narrow seas the coarse land mask closes up (Messina): carved back to water so the ferry stays. */
  straits?: { name: string; line: [number, number][] }[];
  /** Extra town-to-town roads, e.g. a ferry lane (Liverpool–Dublin). */
  lanes?: [string, string][];
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
  const [GEO_W, GEO_H] = SIZES[code];
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
export const geoAbroad = (code: string) => PARAMS[code].abroad ?? [];
export const geoLinks = (code: string) => PARAMS[code].links ?? [];
export const geoMotorways = (code: string) => PARAMS[code].motorways ?? [];
export const geoZones = (code: string) => PARAMS[code].zones ?? [];
export const geoStraits = (code: string) => PARAMS[code].straits ?? [];
export const geoLanes = (code: string) => PARAMS[code].lanes ?? [];

/** Is the tile-space point inside a lat/lon polygon (projected)? */
export function insidePoly(code: string, poly: [number, number][], x: number, y: number): boolean {
  const proj = projectionFor(code);
  const pts = poly.map(([lat, lon]) => proj.toTile(lat, lon));
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export const geoExcluded = (code: string) => PARAMS[code].exclude;

function unpack(code: string, b64: string): Uint8Array {
  const bin = atob(b64);
  const n = (SIZES[code][0] + 1) * (SIZES[code][1] + 1);
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) out[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  return out;
}

/** Land (1) / sea (0) on the (W+1)×(H+1) corner grid — neighbouring countries count as land. */
export const landMask = (code: string) => unpack(code, LANDMASKS[code]);

/** 1 where the corner lies inside the country itself. */
export const homeMask = (code: string) => unpack(code, HOMEMASKS[code]);

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
