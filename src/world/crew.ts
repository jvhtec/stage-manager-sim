/**
 * Crews are people. Days on the road wear them out — tired crews build and
 * run shows worse — and they recover at home. Company morale follows what
 * you pay and how hard you work them: good morale lifts every show, bad
 * morale costs you shows and, eventually, people.
 */
import type { Rng } from '@/lib/rng';
import { CREW_WAGE_PER_DAY } from './catalog';
import { book, pushNews, totalCrew } from './core';
import type { CitySize, Gig, PayLevel, TrainingLevel, TycoonState, Vehicle, WorldMap } from './types';

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

/** Effective crew a vehicle brings, after fatigue and experience. */
export const effectiveCrew = (v: Vehicle) => v.crew * crewEffectiveness(v.crewFatigue ?? 0) * experienceFactor(v.crewExperience ?? STARTING_EXPERIENCE);

// ---------------------------------------------------------------------------
// Local freelancers: fill crew gaps at the venue, per show day
// ---------------------------------------------------------------------------

export const FREELANCE_DAY_RATE = 140;
/** Freelancers available locally, by town size. */
export const FREELANCE_POOL: Record<CitySize, number> = { village: 2, town: 4, city: 8, metropolis: 14 };
/** With a base in town you know who's good — and they know you. */
const LOCAL_CONTACTS = { extra: 4, discount: 0.75, effectiveness: 0.95 };
const STRANGERS_EFFECTIVENESS = 0.8;
const OVERSEAS_POOL = 8;

export interface FreelanceHire {
  count: number;
  cost: number;
  /** Each freelancer counts as this much of a crew member. */
  effectiveness: number;
  local: boolean;
}

export function freelancersFor(state: TycoonState, world: WorldMap, gig: Gig, crewOnSite: number): FreelanceHire {
  const none = { count: 0, cost: 0, effectiveness: 0, local: false };
  if (state.policies.freelance === 'off') return none;
  const short = Math.max(0, gig.crewNeeded - crewOnSite);
  if (!short) return none;
  const local = !gig.overseas && state.depots.some(d => d.cityId === gig.cityId);
  const city = world.cityById.get(gig.cityId);
  const pool = gig.overseas ? OVERSEAS_POOL : FREELANCE_POOL[city?.size ?? 'town'] + (local ? LOCAL_CONTACTS.extra : 0);
  const count = Math.min(short, pool);
  const days = gig.overseas ? gig.overseas.stops.length : (gig.days ?? 1);
  const rate = FREELANCE_DAY_RATE * (local ? LOCAL_CONTACTS.discount : 1);
  return { count, cost: Math.round(count * rate * days), effectiveness: local ? LOCAL_CONTACTS.effectiveness : STRANGERS_EFFECTIVENESS, local };
}

// ---------------------------------------------------------------------------
// Experience: crews get better with every show; new hires dilute it
// ---------------------------------------------------------------------------

export const STARTING_EXPERIENCE = 30;
export const NEW_HIRE_EXPERIENCE = 10;

/** Crew effectiveness from experience: 0.85 green, 1.15 seasoned. */
export const experienceFactor = (exp: number) => 0.85 + 0.3 * (Math.max(0, Math.min(100, exp)) / 100);

export function experienceLabel(exp: number): string {
  return exp < 25 ? 'green' : exp < 50 ? 'capable' : exp < 75 ? 'seasoned' : 'elite';
}

/** After a show: the crew who worked it learn something (big jobs teach more). */
export function gainExperience(vehicles: Vehicle[], big: boolean) {
  vehicles.forEach(v => {
    if (!v.crew) return;
    const exp = v.crewExperience ?? STARTING_EXPERIENCE;
    v.crewExperience = Math.min(100, exp + (big ? 2.5 : 1.2) * (1 - exp / 100));
  });
}

export const TRAINING: Record<TrainingLevel, { label: string; perCrewMonth: number; gain: number; blurb: string }> = {
  none: { label: 'Learn on the job', perCrewMonth: 0, gain: 0, blurb: 'Crews only get better by doing shows.' },
  courses: { label: 'Courses', perCrewMonth: 60, gain: 2, blurb: 'Rigging, safety and desk courses for the crew at base.' },
  academy: { label: 'In-house academy', perCrewMonth: 150, gain: 5, blurb: 'Your own training rig and mentors: crews grow fast.' },
};
export const TRAINING_LEVELS: TrainingLevel[] = ['none', 'courses', 'academy'];

/** Monthly: pay for training, and the crew at base improve. */
export function monthlyTraining(s: TycoonState) {
  const t = TRAINING[s.policies.training];
  if (!t.perCrewMonth) return;
  const crew = s.depots.reduce((sum, d) => sum + d.crew, 0);
  if (crew) book(s, 'training', -Math.round(crew * t.perCrewMonth));
  s.depots.forEach(d => {
    if (!d.crew) return;
    const exp = d.experience ?? STARTING_EXPERIENCE;
    d.experience = Math.min(100, exp + t.gain * (1 - exp / 100) * 1.5);
  });
}

export function averageExperience(state: TycoonState): number {
  let crew = 0;
  let sum = 0;
  state.depots.forEach(d => {
    crew += d.crew;
    sum += d.crew * (d.experience ?? STARTING_EXPERIENCE);
  });
  state.vehicles.forEach(v => {
    if (v.owner !== 'player') return;
    crew += v.crew;
    sum += v.crew * (v.crewExperience ?? STARTING_EXPERIENCE);
  });
  return crew ? sum / crew : STARTING_EXPERIENCE;
}
