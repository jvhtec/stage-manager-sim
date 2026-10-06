/**
 * Colours for the map. Every world colour goes through `paint()` so the
 * day/night cycle can darken and blue-shift the whole scene at once, while
 * emissive things (lit windows, neon, floodlights) use `glow()` and stay bright.
 */
export type RGB = readonly [number, number, number];

let night = 0;

/** 0 = noon, 1 = deepest night. Set once per frame by the renderer. */
export function setNight(value: number) {
  night = value;
}

export function getNight() {
  return night;
}

export function paint(c: RGB, light = 1, alpha = 1): string {
  const f = light * (1 - night * 0.62);
  const r = Math.min(255, c[0] * f * (1 - night * 0.2));
  const g = Math.min(255, c[1] * f * (1 - night * 0.1));
  const b = Math.min(255, c[2] * f + night * 28);
  return alpha >= 1 ? `rgb(${r | 0},${g | 0},${b | 0})` : `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;
}

export function glow(c: RGB, alpha = 1): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${alpha})`;
}

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const C = {
  sea: [38, 86, 150] as RGB,
  water: [52, 108, 176] as RGB,
  waterGlint: [150, 200, 240] as RGB,
  grass: [104, 158, 72] as RGB,
  grassDark: [88, 140, 62] as RGB,
  forestFloor: [74, 124, 58] as RGB,
  rough: [134, 124, 100] as RGB,
  rock: [110, 104, 96] as RGB,
  sand: [218, 200, 142] as RGB,
  road: [96, 96, 104] as RGB,
  roadEdge: [72, 72, 80] as RGB,
  marking: [232, 230, 205] as RGB,
  pavement: [168, 166, 158] as RGB,
  bridge: [126, 96, 66] as RGB,
  bridgeRail: [80, 60, 44] as RGB,
  pine: [44, 104, 56] as RGB,
  pineLight: [64, 132, 70] as RGB,
  leaf: [72, 136, 60] as RGB,
  trunk: [96, 66, 40] as RGB,
  concrete: [176, 176, 170] as RGB,
  yard: [150, 150, 146] as RGB,
  window: [60, 74, 96] as RGB,
  windowLit: [255, 214, 120] as RGB,
  neonPink: [255, 64, 170] as RGB,
  neonCyan: [64, 230, 255] as RGB,
  marquee: [200, 40, 50] as RGB,
  pitch: [70, 150, 70] as RGB,
  flood: [255, 248, 210] as RGB,
  white: [240, 240, 236] as RGB,
  black: [24, 24, 28] as RGB,
  tyre: [30, 30, 34] as RGB,
  smoke: [150, 150, 150] as RGB,
};

export const BUILDING_WALLS: RGB[] = [
  [178, 92, 70], // brick
  [214, 200, 168], // cream
  [158, 158, 162], // concrete
  [128, 146, 172], // blue-grey
  [196, 166, 116], // sandstone
  [104, 126, 150], // glass tower
];

export const BUILDING_ROOFS: RGB[] = [
  [128, 64, 52],
  [96, 96, 104],
  [70, 80, 92],
];
