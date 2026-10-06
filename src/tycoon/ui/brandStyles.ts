/** Wordmark colours per brand (see brands.tsx). */
export interface BrandStyle {
  bg: string;
  fg: string;
  text?: string;
  weight?: number;
  italic?: boolean;
  spacing?: number;
  serif?: boolean;
  lower?: boolean;
}

export const STYLES: Record<string, BrandStyle> = {
  // Audio
  'L-Acoustics': { bg: '#111', fg: '#fff', text: 'L-ACOUSTICS', weight: 800, spacing: 0.5 },
  'd&b audiotechnik': { bg: '#fff', fg: '#111', text: 'd&b', weight: 900, lower: true },
  'Meyer Sound': { bg: '#111', fg: '#fff', text: 'MEYER SOUND', weight: 700, spacing: 1 },
  'Martin Audio': { bg: '#1b1b1b', fg: '#e5e5e5', text: 'MARTIN AUDIO', weight: 800 },
  EAW: { bg: '#0b3a6e', fg: '#fff', text: 'EAW', weight: 900, italic: true },
  // Consoles
  DiGiCo: { bg: '#0b5cad', fg: '#fff', text: 'DiGiCo', weight: 800 },
  Midas: { bg: '#121212', fg: '#e3342f', text: 'MIDAS', weight: 900, spacing: 2 },
  Yamaha: { bg: '#3b1e6d', fg: '#fff', text: 'YAMAHA', weight: 800, spacing: 1 },
  Avid: { bg: '#111', fg: '#fff', text: 'AVID', weight: 900, spacing: 1 },
  SSL: { bg: '#0d0d0d', fg: '#fff', text: 'SSL', weight: 900, serif: true },
  'Allen & Heath': { bg: '#c8102e', fg: '#fff', text: 'ALLEN&HEATH', weight: 800 },
  Soundcraft: { bg: '#d6001c', fg: '#fff', text: 'Soundcraft', weight: 700, italic: true },
  // Lighting
  Thomas: { bg: '#333', fg: '#fff', text: 'THOMAS', weight: 800 },
  'Vari-Lite': { bg: '#000', fg: '#fff', text: 'VARI*LITE', weight: 800, spacing: 1 },
  Avolites: { bg: '#d6001c', fg: '#fff', text: 'AVOLITES', weight: 800 },
  'High End Systems': { bg: '#0d0d0d', fg: '#7dd3fc', text: 'HIGH END', weight: 800 },
  Martin: { bg: '#e2001a', fg: '#fff', text: 'MARTIN', weight: 900 },
  'MA Lighting': { bg: '#0d0d0d', fg: '#f7a600', text: 'MA', weight: 900, spacing: 1 },
  'Clay Paky': { bg: '#f39200', fg: '#fff', text: 'CLAY PAKY', weight: 800 },
  Robe: { bg: '#e30613', fg: '#fff', text: 'ROBE', weight: 900, spacing: 2 },
  // Video
  Sony: { bg: '#000', fg: '#fff', text: 'SONY', weight: 900, serif: true, spacing: 1 },
  Barco: { bg: '#fff', fg: '#111', text: 'BARCO', weight: 900 },
  Lighthouse: { bg: '#003e7e', fg: '#fff', text: 'LIGHTHOUSE', weight: 700 },
  'ROE Visual': { bg: '#111', fg: '#ef4444', text: 'ROE', weight: 900, spacing: 2 },
  disguise: { bg: '#111', fg: '#fff', text: 'disguise', weight: 700, lower: true },
  // Staging
  Steeldeck: { bg: '#3f3f46', fg: '#fff', text: 'STEELDECK', weight: 800 },
  Prolyte: { bg: '#0f172a', fg: '#fbbf24', text: 'PROLYTE', weight: 800 },
  CM: { bg: '#1e3a8a', fg: '#fff', text: 'CM', weight: 900 },
  Tomcat: { bg: '#111', fg: '#f59e0b', text: 'TOMCAT', weight: 900 },
  Kinesys: { bg: '#0b3a6e', fg: '#fff', text: 'KINESYS', weight: 800 },
  TAIT: { bg: '#111', fg: '#fff', text: 'TAIT', weight: 900, spacing: 2 },
};

export function brandAccent(brand: string): string {
  const s = STYLES[brand];
  if (!s) return '#94a3b8';
  // Use whichever of the pair is more colourful as the sprite accent.
  const sat = (hex: string) => {
    const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return Math.max(r, g, b) - Math.min(r, g, b);
  };
  return sat(s.fg) > sat(s.bg) ? s.fg : sat(s.bg) > 30 ? s.bg : '#94a3b8';
}

export const slug = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

