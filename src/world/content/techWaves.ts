/**
 * Technology waves: a new way of doing things arrives and the old kit starts
 * to look dated on the big shows and in the second-hand market. Rumoured two
 * years ahead, it bites gradually — a unit of an obsolete kind performs a
 * little worse each year until the full penalty is reached.
 */
import type { GearKind } from './gear';

export interface TechWave {
  id: string;
  label: string;
  /** The year it arrives. */
  year: number;
  /** Years from arrival to the full effect. */
  ramp: number;
  obsolete: GearKind[];
  /** Quality lost by obsolete kit at full effect (0-1), on shows from `minTier` up. */
  penalty: number;
  minTier: number;
  /** Resale value lost at full effect (0-1), whatever the show. */
  resale: number;
  rumour: string;
  arrival: string;
}

export const TECH_WAVES: TechWave[] = [
  {
    id: 'moving-lights',
    label: 'Moving lights',
    year: 1986,
    ramp: 8,
    obsolete: ['par'],
    penalty: 0.3,
    minTier: 3,
    resale: 0.35,
    rumour: 'Rumours of automated lighting: designers want fixtures that move. Racks of PAR cans may not impress arenas for long.',
    arrival: 'Moving lights arrive in force. On the big stages, static PAR cans look dated — and their resale value is sliding.',
  },
  {
    id: 'line-arrays',
    label: 'Line arrays',
    year: 1996,
    ramp: 6,
    obsolete: ['point-source'],
    penalty: 0.28,
    minTier: 3,
    resale: 0.35,
    rumour: 'Line-array PA is the talk of the trade shows. Stacked point-source cabinets may soon be second best.',
    arrival: 'Line arrays take over the big shows. Conventional point-source PAs are losing ground and resale value.',
  },
  {
    id: 'scanners-out',
    label: 'Moving heads replace scanners',
    year: 1998,
    ramp: 4,
    obsolete: ['scanner'],
    penalty: 0.35,
    minTier: 2,
    resale: 0.5,
    rumour: 'Lighting designers are moving on from scanners to proper moving heads.',
    arrival: 'Scanners are out. Designers ask for moving spots and washes instead, and nobody wants a used scanner.',
  },
  {
    id: 'digital-desks',
    label: 'Digital consoles',
    year: 2000,
    ramp: 6,
    obsolete: ['console-analog'],
    penalty: 0.25,
    minTier: 3,
    resale: 0.4,
    rumour: 'Digital mixing desks are getting good. Big shows will want them soon.',
    arrival: 'Digital consoles are standard on the big shows. Analogue desks sound fine, but engineers are asking for recall and snapshots.',
  },
  {
    id: 'led-takeover',
    label: 'LED takes over video',
    year: 2008,
    ramp: 5,
    obsolete: ['projector', 'jumbotron'],
    penalty: 0.35,
    minTier: 3,
    resale: 0.5,
    rumour: 'LED panels are getting bright and cheap. Projection and old screens look doomed.',
    arrival: 'LED walls are the new standard. Projection kits and old video screens are fading fast.',
  },
];

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/** How far into a wave: 0 before it arrives, 1 at full effect. */
export const waveProgress = (w: TechWave, year: number) => clamp01((year - w.year) / w.ramp);

/** Multiplier on a unit's quality on a show of this tier. */
export function techQualityFactor(kind: GearKind, tier: number, year: number): number {
  let f = 1;
  for (const w of TECH_WAVES) {
    if (tier >= w.minTier && w.obsolete.includes(kind)) f *= 1 - w.penalty * waveProgress(w, year);
  }
  return f;
}

/** Multiplier on a unit's resale value. */
export function techResaleFactor(kind: GearKind, year: number): number {
  let f = 1;
  for (const w of TECH_WAVES) if (w.obsolete.includes(kind)) f *= 1 - w.resale * waveProgress(w, year);
  return f;
}
