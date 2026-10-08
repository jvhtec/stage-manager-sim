/**
 * Crews are people. Days on the road wear them out — tired crews build and
 * run shows worse — and they recover at home. Company morale follows what
 * you pay and how hard you work them: good morale lifts every show, bad
 * morale costs you shows and, eventually, people.
 */
import type { Rng } from '@/lib/rng';
import { CREW_WAGE_PER_DAY } from './catalog';
import { pushNews, totalCrew } from './core';
import type { PayLevel, TycoonState, Vehicle } from './types';

export interface PayInfo {
  label: string;
  wage: number;
  /** Morale this pay level settles towards (before fatigue). */
  morale: number;
  blurb: string;
}

export const PAY: Record<PayLevel, PayInfo> = {
  low: { label: 'Below the going rate', wage: 0.8, morale: 42, blurb: 'Saves money; crews grumble, and the good ones leave.' },
  standard: { label: 'Going rate', wage: 1, morale: 65, blurb: 'Fair pay for fair work.' },
  high: { label: 'Top of the market', wage: 1.25, morale: 85, blurb: 'Crews will go the extra mile — and stay.' },
};
export const PAY_LEVELS: PayLevel[] = ['low', 'standard', 'high'];

/** Fatigue per day: building and running a show, or just being on the road. */
const FATIGUE_ON_SITE = 4;
const FATIGUE_TRAVEL = 3;
const RECOVERY_AT_HOME = 10;
/** Below this, crews work at full effectiveness. */
const FATIGUE_GRACE = 30;
const QUIT_BELOW = 40;

export const crewWage = (state: TycoonState) => CREW_WAGE_PER_DAY * PAY[state.policies.pay].wage;

/** How much a crew member is worth at a given fatigue: 100% fresh, 65% exhausted. */
export const crewEffectiveness = (fatigue: number) => 1 - (Math.max(0, fatigue - FATIGUE_GRACE) / (100 - FATIGUE_GRACE)) * 0.35;

/** Show-quality nudge from morale: about ±0.06. */
export const moraleBonus = (morale: number) => (morale - 60) / 400;

/** Moves `n` crew with fatigue `f` into a pool, keeping the pool's average. */
export function mixFatigue(poolCrew: number, poolFatigue: number, n: number, f: number): number {
  return poolCrew + n > 0 ? (poolCrew * poolFatigue + n * f) / (poolCrew + n) : 0;
}

export function dailyCrew(s: TycoonState) {
  s.vehicles.forEach(v => {
    if (v.owner !== 'player' || !v.crew) return;
    const add = v.status === 'on-site' ? FATIGUE_ON_SITE : FATIGUE_TRAVEL;
    v.crewFatigue = Math.min(100, (v.crewFatigue ?? 0) + add);
  });
  s.depots.forEach(d => {
    d.fatigue = Math.max(0, (d.fatigue ?? 0) - RECOVERY_AT_HOME);
  });
}

export function averageFatigue(state: TycoonState): number {
  let crew = 0;
  let sum = 0;
  state.depots.forEach(d => {
    crew += d.crew;
    sum += d.crew * (d.fatigue ?? 0);
  });
  state.vehicles.forEach(v => {
    if (v.owner !== 'player') return;
    crew += v.crew;
    sum += v.crew * (v.crewFatigue ?? 0);
  });
  return crew ? sum / crew : 0;
}

export const moraleTarget = (state: TycoonState) => Math.max(0, Math.min(100, PAY[state.policies.pay].morale - averageFatigue(state) * 0.35));

/** Monthly: morale drifts towards what you pay (less how tired everyone is); unhappy crews quit. */
export function monthlyCrew(s: TycoonState, rng: Rng) {
  s.crewMorale += (moraleTarget(s) - s.crewMorale) * 0.5;
  if (s.crewMorale >= QUIT_BELOW || !totalCrew(s)) return;
  let quit = 0;
  s.depots.forEach(d => {
    const leaving = Math.min(d.crew, Math.floor((d.crew * (QUIT_BELOW - s.crewMorale)) / 100 + rng.next()));
    d.crew -= leaving;
    quit += leaving;
  });
  if (quit) pushNews(s, `${quit} crew quit — morale is at ${Math.round(s.crewMorale)}. Pay more or give them time off.`, 'bad');
}

/** Effective crew a vehicle brings, after fatigue. */
export const effectiveCrew = (v: Vehicle) => v.crew * crewEffectiveness(v.crewFatigue ?? 0);
