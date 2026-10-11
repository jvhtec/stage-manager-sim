/**
 * What a night is worth under the contract. Quality sets the fee you can argue for (gate.ts), but a
 * contract also has lines in it: a client docks money for a shaky night and a lot more for a bad
 * one, charges for every hour the doors open late, and a show that falls apart costs the fee, the
 * deposit back and damages on top — the bigger the venue, the bigger the promoter's losses. Pushy
 * clients enforce every clause; easy ones let a little go. The same lines apply to rivals.
 */
import { clientTemper } from './changes';
import { difficultyOf } from './scenario';
import type { Gig, TycoonState } from './types';

export type Outcome = 'triumph' | 'solid' | 'shaky' | 'bad' | 'failed';
export const OUTCOMES: Outcome[] = ['triumph', 'solid', 'shaky', 'bad', 'failed'];
export const OUTCOME_LABELS: Record<Outcome, string> = { triumph: 'Triumph', solid: 'Solid', shaky: 'Shaky', bad: 'Bad night', failed: 'Failed' };

/** Quality lines between the bands (the failure line is per difficulty, scenario.ts). */
export const TRIUMPH_LINE = 0.85;
export const SOLID_LINE = 0.65;
export const SHAKY_LINE = 0.5;

/** Share of the fee a client docks for a shaky or a bad night (before temper and difficulty). */
export const SHAKY_DOCK = 0.08;
export const BAD_DOCK = 0.3;
/** Share of the fee charged per hour the doors open late, and the most it can come to. */
export const LATE_DOCK_PER_HOUR = 0.04;
export const MAX_LATE_DOCK = 0.25;
/** Damages for a show that fell apart, as a share of the fee, by venue tier: a dead stadium costs the promoter more than a dead pub. */
export const DAMAGES = [0, 0.3, 0.5, 0.8, 1.2];
/** How hard each kind of client enforces the contract. */
export const TEMPER_ENFORCE = { easy: 0.5, fair: 1, pushy: 1.5 };
/** Everything docked from one night can't come to more than this share of what it earned. */
export const MAX_DOCK = 0.6;

type Diff = Pick<TycoonState, 'difficulty'>;

export const failLine = (s: Diff) => difficultyOf(s).failLine;

export function outcomeOf(s: Diff, quality: number, present = true): Outcome {
  if (!present || quality < failLine(s)) return 'failed';
  if (quality < SHAKY_LINE) return 'bad';
  if (quality < SOLID_LINE) return 'shaky';
  if (quality < TRIUMPH_LINE) return 'solid';
  return 'triumph';
}

const enforce = (s: Diff, gig: Pick<Gig, 'act'>) => TEMPER_ENFORCE[clientTemper(gig.act)] * difficultyOf(s).penalties;

export interface Docked {
  /** For the quality of the night. */
  quality: number;
  /** For opening the doors late. */
  late: number;
  total: number;
}

/** What the client takes off a night that went ahead, out of what it earned. */
export function contractDock(s: Diff, gig: Pick<Gig, 'act' | 'fee'>, quality: number, lateHours: number, earned: number): Docked {
  const k = enforce(s, gig);
  const band = outcomeOf(s, quality);
  const q = band === 'bad' ? BAD_DOCK : band === 'shaky' ? SHAKY_DOCK : 0;
  const quality$ = Math.round(gig.fee * q * k);
  const late$ = lateHours > 0 ? Math.round(gig.fee * Math.min(MAX_LATE_DOCK, LATE_DOCK_PER_HOUR * Math.ceil(lateHours)) * k) : 0;
  const cap = Math.max(0, Math.round(earned * MAX_DOCK));
  const total = Math.min(cap, quality$ + late$);
  // Scale both down together if the cap bites, so the parts add up to the total.
  const f = quality$ + late$ ? total / (quality$ + late$) : 0;
  return { quality: Math.round(quality$ * f), late: total - Math.round(quality$ * f), total };
}

/** Damages for a show that fell apart (on top of losing the fee and handing back the deposit). */
export const damagesFor = (s: Diff, gig: Pick<Gig, 'act' | 'fee' | 'tier'>) => Math.round(gig.fee * DAMAGES[Math.max(0, Math.min(4, gig.tier))] * enforce(s, gig));
