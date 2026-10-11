/**
 * Who runs the rivals. The real houses had real people at the top, and the way
 * they ran things shows in how the firm plays: the engineer-founder who builds
 * his own boxes and won't cut a corner on a rider, the dealmaker who buys up
 * the competition, the careful owner who keeps three months' cash in the bank.
 *
 * A style is a set of small nudges on the rival's existing decisions — how hard
 * it chases offers, how much it'll spend to meet a rider, when it reinvests,
 * whether it starts price wars or buys struggling firms. No style is better;
 * each wins and loses in its own way.
 */
import { RIVAL_COMPANIES, type Leader, type LeaderStyle, type RivalTemplate } from './content/companies';
import type { Rng } from '@/lib/rng';
import type { Rival } from './types';

export interface StyleTraits {
  label: string;
  /** One line for the League window. */
  blurb: string;
  /** Chance of going for an offer (×). */
  take: number;
  /** Cash cushion, in months of overhead, before it reinvests (3 = the default). */
  reinvest: number;
  /** Kit currency it aims for, relative to the era's norm for its tier. */
  quality: number;
  /** How far it'll stretch (× RIVAL_FIX_LIMIT) to meet a rider or a room. */
  fix: number;
  /** Weight as the instigator of a price war. */
  war: number;
  /** Weight as a buyer when a struggling firm is up for grabs. */
  buyer: number;
  /** Added to its grudge (rivalry aggression, 0.2-0.9). */
  grudge: number;
  /** Chance of stepping up a tier when its name allows (×). */
  growth: number;
}

const NEUTRAL: StyleTraits = { label: 'Steady', blurb: 'Runs the business like most do.', take: 1, reinvest: 3, quality: 0, fix: 1, war: 1, buyer: 1, grudge: 0, growth: 1 };

export const STYLES: Record<LeaderStyle, StyleTraits> = {
  pioneer: {
    label: 'Pioneer',
    blurb: 'Builds the kit, first with the new technology, reinvests early.',
    take: 1, reinvest: 2.5, quality: 0.5, fix: 1.25, war: 0.6, buyer: 0.8, grudge: 0, growth: 1.2,
  },
  perfectionist: {
    label: 'Perfectionist',
    blurb: 'Picky about work, never short on a rider, rarely fights on price.',
    take: 0.85, reinvest: 2.5, quality: 0.7, fix: 1.5, war: 0.4, buyer: 0.7, grudge: -0.1, growth: 0.9,
  },
  expansionist: {
    label: 'Expansionist',
    blurb: 'Chases every job and every new town; quick to undercut.',
    take: 1.2, reinvest: 2, quality: 0, fix: 1, war: 1.4, buyer: 1.6, grudge: 0.1, growth: 1.5,
  },
  dealmaker: {
    label: 'Dealmaker',
    blurb: 'Grows by buying other firms rather than by fighting them.',
    take: 1.05, reinvest: 3, quality: 0, fix: 1, war: 0.8, buyer: 2.2, grudge: 0, growth: 1.1,
  },
  prudent: {
    label: 'Prudent',
    blurb: 'Keeps cash in the bank and takes only what it can do well.',
    take: 0.95, reinvest: 4.5, quality: -0.2, fix: 0.8, war: 0.5, buyer: 0.8, grudge: -0.15, growth: 0.8,
  },
  hustler: {
    label: 'Hustler',
    blurb: 'Cheap, fast and everywhere; cuts corners and holds grudges.',
    take: 1.25, reinvest: 3, quality: -0.3, fix: 0.7, war: 1.8, buyer: 1, grudge: 0.2, growth: 1.1,
  },
};

const STARTUP_STYLES: LeaderStyle[] = ['hustler', 'expansionist', 'prudent', 'pioneer'];
const hash = (str: string) => [...str].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

const templateOf = (id: string): RivalTemplate | undefined => RIVAL_COMPANIES.find(t => t.id === id);

/** Who's in charge of a historic firm this year (undefined between leaders or if we don't know). */
export function leaderIn(t: Pick<RivalTemplate, 'leaders'>, year: number): Leader | undefined {
  const current = (t.leaders ?? []).filter(l => l.from <= year).pop();
  return current && (current.to === undefined || current.to >= year) ? current : undefined;
}

export interface RivalBoss {
  /** A named person for the historic firms; startups are just "the owners". */
  name?: string;
  style?: LeaderStyle;
  note?: string;
}

export function bossOf(r: Pick<Rival, 'id'>, year: number): RivalBoss {
  const t = templateOf(r.id);
  if (t) {
    const l = leaderIn(t, year);
    return l ? { name: l.name, style: l.style, note: l.note } : {};
  }
  // A startup: no history to draw on, but its owners still have a way of doing things.
  return { style: STARTUP_STYLES[hash(r.id) % STARTUP_STYLES.length] };
}

export const styleOf = (r: Pick<Rival, 'id'>, year: number): StyleTraits => {
  const style = bossOf(r, year).style;
  return style ? STYLES[style] : NEUTRAL;
};

/** Pick one item with chance proportional to its weight. */
export function pickWeighted<T>(rng: Rng, items: readonly T[], weight: (t: T) => number): T | undefined {
  const total = items.reduce((n, t) => n + Math.max(0, weight(t)), 0);
  if (!(total > 0)) return undefined;
  let roll = rng.next() * total;
  for (const t of items) {
    roll -= Math.max(0, weight(t));
    if (roll < 0) return t;
  }
  return items[items.length - 1];
}
