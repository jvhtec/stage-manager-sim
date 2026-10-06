/**
 * Pixel-art gear sprites, drawn procedurally on a 20×20 grid and scaled up
 * with nearest-neighbour filtering. One drawing per gear *kind*, tinted with
 * the brand's accent colour. Cached as data URLs.
 */
import type { GearKind } from '@/world/content/gear';

const SIZE = 20;
type Px = (x: number, y: number, w: number, h: number, c: string) => void;

const K = {
  black: '#14161b',
  body: '#2a2e37',
  mid: '#3e4451',
  light: '#6b7280',
  hi: '#a3aab8',
  white: '#e8ecf3',
  amber: '#fbbf24',
  warm: '#fde68a',
  cyan: '#22d3ee',
  green: '#4ade80',
  red: '#f87171',
  steel: '#9ca3af',
  wood: '#8b5a2b',
};

const DRAW: Record<GearKind, (r: Px, accent: string) => void> = {
  'point-source': (r, a) => {
    r(4, 1, 12, 18, K.black);
    r(5, 2, 10, 16, K.body);
    // Horn: a flared mouth.
    r(6, 3, 8, 4, K.mid);
    r(7, 4, 6, 2, K.black);
    r(9, 4, 2, 2, K.light);
    // Woofer: cone, surround and dust cap.
    for (let y = 8; y <= 16; y++) {
      for (let x = 6; x <= 14; x++) {
        const d = Math.hypot(x - 10, y - 12);
        if (d <= 4.2) r(x, y, 1, 1, d > 3.3 ? K.light : d > 1.4 ? K.black : K.hi);
      }
    }
    r(5, 17, 10, 1, a);
  },
  'line-array': (r, a) => {
    r(5, 1, 10, 1, K.steel); // bumper
    r(9, 0, 2, 1, K.steel);
    for (let i = 0; i < 5; i++) {
      const x = 4 + Math.floor(i / 2);
      const y = 2 + i * 3;
      r(x, y, 12, 3, K.black);
      r(x + 1, y, 10, 2, K.body);
      r(x + 2, y + 1, 8, 1, K.mid);
      r(x + 10, y, 1, 2, a);
    }
  },
  'console-analog': (r, a) => {
    r(1, 4, 18, 3, K.mid); // meter bridge
    for (let x = 2; x < 18; x += 2) r(x, 5, 1, 1, x % 4 ? K.green : K.amber);
    r(1, 7, 18, 10, K.body);
    for (let x = 2; x < 18; x += 2) {
      r(x, 8, 1, 1, K.hi); // knobs
      r(x, 10, 1, 1, x % 6 ? K.light : K.red);
      r(x, 12, 1, 4, K.black); // fader slots
      r(x, 13 + (x % 3), 1, 1, K.white); // caps
    }
    r(1, 17, 18, 1, a);
  },
  'console-digital': (r, a) => {
    r(1, 3, 18, 6, K.black);
    r(2, 4, 7, 4, K.cyan); // screens
    r(11, 4, 7, 4, '#38bdf8');
    r(3, 5, 4, 1, K.white);
    r(12, 6, 4, 1, K.white);
    r(1, 9, 18, 8, K.body);
    for (let x = 2; x < 18; x += 2) {
      r(x, 10, 1, 1, x % 4 ? a : K.green);
      r(x, 12, 1, 4, K.black);
      r(x, 12 + (x % 4), 1, 1, K.white);
    }
    r(1, 17, 18, 1, a);
  },
  par: (r, a) => {
    r(3, 6, 2, 8, K.steel); // yoke
    r(15, 6, 2, 8, K.steel);
    r(5, 4, 10, 12, K.black);
    r(6, 5, 8, 10, K.body);
    r(7, 6, 6, 8, K.amber); // lens
    r(8, 7, 3, 3, K.warm);
    r(9, 16, 2, 2, K.steel);
    r(5, 15, 10, 1, a);
  },
  'moving-spot': (r, a) => {
    r(4, 16, 12, 3, K.body); // base
    r(5, 17, 2, 1, a);
    r(5, 6, 2, 10, K.mid); // yoke arms
    r(13, 6, 2, 10, K.mid);
    r(6, 3, 8, 9, K.black); // head
    r(7, 4, 6, 7, K.body);
    r(8, 5, 4, 4, K.white); // lens
    r(9, 6, 2, 2, '#ffffff');
    r(7, 10, 6, 1, a);
  },
  'moving-wash': (r, a) => {
    r(4, 16, 12, 3, K.body);
    r(5, 17, 2, 1, a);
    r(4, 7, 2, 9, K.mid);
    r(14, 7, 2, 9, K.mid);
    r(5, 2, 10, 10, K.black);
    for (let y = 3; y < 11; y += 2) for (let x = 6; x < 14; x += 2) r(x, y, 1, 1, (x + y) % 4 ? '#f472b6' : '#60a5fa');
  },
  beam: (r, a) => {
    r(9, 0, 2, 7, '#ffffff'); // the beam
    r(10, 0, 1, 7, K.warm);
    r(5, 16, 10, 3, K.body);
    r(6, 9, 2, 7, K.mid);
    r(12, 9, 2, 7, K.mid);
    r(7, 7, 6, 6, K.black);
    r(8, 7, 4, 2, '#ffffff');
    r(7, 12, 6, 1, a);
  },
  scanner: (r, a) => {
    r(2, 8, 13, 6, K.black);
    r(3, 9, 11, 4, K.body);
    r(14, 7, 4, 4, K.hi); // mirror
    r(15, 8, 2, 2, K.white);
    r(17, 4, 3, 2, K.warm);
    r(3, 13, 11, 1, a);
    r(7, 14, 2, 4, K.steel);
  },
  desk: (r, a) => {
    r(1, 3, 18, 6, K.black);
    r(2, 4, 10, 4, '#1e3a8a'); // screen
    r(3, 5, 6, 1, K.cyan);
    r(3, 6, 4, 1, K.green);
    r(13, 4, 5, 4, K.mid);
    for (let x = 14; x < 18; x += 2) r(x, 5, 1, 1, K.amber);
    r(1, 9, 18, 8, K.body);
    for (let x = 2; x < 18; x += 2) {
      r(x, 10, 1, 1, K.hi);
      r(x, 12, 1, 4, K.black);
      r(x, 14, 1, 1, a);
    }
  },
  jumbotron: (r, a) => {
    r(1, 2, 18, 13, K.black);
    r(2, 3, 16, 11, '#1f2937');
    for (let y = 3; y < 14; y += 2) r(2, y, 16, 1, '#334155');
    r(5, 6, 10, 5, '#475569');
    r(7, 7, 6, 3, K.hi);
    r(8, 15, 4, 3, K.steel);
    r(1, 14, 18, 1, a);
  },
  projector: (r, a) => {
    r(2, 9, 12, 8, K.black);
    r(3, 10, 10, 6, K.body);
    r(13, 11, 3, 4, K.mid);
    r(16, 11, 1, 4, K.white); // lens
    r(17, 9, 3, 8, 'rgba(255,255,255,0.35)');
    r(4, 11, 4, 1, K.green);
    r(3, 15, 10, 1, a);
  },
  'led-wall': (r, a) => {
    r(1, 2, 18, 14, K.black);
    const colors = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#a855f7', '#ec4899'];
    for (let y = 3; y < 15; y++) for (let x = 2; x < 18; x++) r(x, y, 1, 1, colors[(x * 3 + y * 5) % colors.length]);
    for (let x = 1; x < 19; x += 6) r(x, 2, 1, 14, K.black);
    for (let y = 2; y < 16; y += 6) r(1, y, 18, 1, K.black);
    r(1, 16, 18, 1, a);
    r(4, 17, 2, 2, K.steel);
    r(14, 17, 2, 2, K.steel);
  },
  'media-server': (r, a) => {
    for (let i = 0; i < 3; i++) {
      const y = 4 + i * 4;
      r(2, y, 16, 3, K.black);
      r(3, y + 1, 14, 1, K.body);
      r(4, y + 1, 1, 1, i === 1 ? K.amber : K.green);
      r(14, y + 1, 2, 1, a);
    }
    r(5, 2, 10, 1, K.cyan);
  },
  deck: (r, a) => {
    r(1, 7, 18, 3, K.wood);
    r(1, 6, 18, 1, '#a16207');
    r(1, 10, 18, 1, a);
    r(2, 11, 2, 7, K.steel);
    r(16, 11, 2, 7, K.steel);
    r(9, 11, 2, 7, K.steel);
  },
  truss: (r, a) => {
    r(0, 6, 20, 1, K.steel);
    r(0, 13, 20, 1, K.steel);
    for (let x = 0; x < 20; x += 4) {
      for (let i = 0; i < 7; i++) r(x + Math.floor(i / 2), 6 + i, 1, 1, K.hi);
    }
    r(0, 14, 20, 1, a);
  },
  motor: (r, a) => {
    r(9, 0, 2, 4, K.steel); // hook / chain
    r(6, 4, 8, 7, K.black);
    r(7, 5, 6, 5, a);
    r(8, 6, 4, 1, K.white);
    for (let y = 11; y < 18; y += 2) r(9, y, 2, 1, K.steel);
    r(8, 18, 4, 2, K.mid);
  },
  automation: (r, a) => {
    r(2, 6, 9, 9, K.black);
    r(3, 7, 7, 7, K.mid); // drum
    for (let y = 8; y < 13; y += 2) r(3, y, 7, 1, K.steel);
    r(11, 8, 6, 5, K.body); // motor
    r(12, 9, 4, 1, a);
    r(1, 15, 17, 2, K.steel);
    r(6, 3, 1, 3, K.hi);
  },
  set: (r, a) => {
    r(2, 3, 16, 2, a); // arch
    r(2, 5, 2, 10, a);
    r(16, 5, 2, 10, a);
    r(4, 5, 12, 10, '#1e1b4b');
    r(7, 7, 6, 4, '#f472b6');
    r(1, 15, 18, 3, K.wood);
    r(1, 18, 18, 1, K.black);
  },
};

const cache = new Map<string, string>();

export function gearSpriteUrl(kind: GearKind, accent: string): string {
  const key = `${kind}:${accent}`;
  const hit = cache.get(key);
  if (hit) return hit;
  if (typeof document === 'undefined') return '';
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';
  const r: Px = (x, y, w, h, c) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  DRAW[kind](r, accent);
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}
