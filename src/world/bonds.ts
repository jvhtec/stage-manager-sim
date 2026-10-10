/**
 * Crews are people. Every pair has a chemistry you can't see until they've worked together; each
 * show they share builds rapport (a good night) or wears it down (a bad one, or a pair who simply
 * rub each other up the wrong way, worse when they're both exhausted). A trusted team delivers more
 * and drops less; a feud costs the show and the crew's mood, and past a point the two refuse to
 * share a truck — you can still force it by naming them both, and pay for it. Long stretches of
 * exhaustion leave lasting burnout, and burnt-out people leave.
 */
import { pushNews } from './core';
import type { CrewMember, TycoonState } from './types';

export const TRUSTED = 40;
export const FEUD = -40;
/** Past this they won't share a truck unless you name them both. */
export const REFUSE = -60;

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
};

export const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Natural chemistry between two people, −1 (oil and water) to 1 (finish each other's sentences). */
export const chemistry = (a: string, b: string) => hash(pairKey(a, b)) * 2 - 1;

export const rapport = (s: Pick<TycoonState, 'bonds'>, a: string, b: string) => s.bonds?.[pairKey(a, b)] ?? 0;

export function relationOf(value: number): 'trusted' | 'feud' | 'refuse' | undefined {
  if (value >= TRUSTED) return 'trusted';
  if (value <= REFUSE) return 'refuse';
  if (value <= FEUD) return 'feud';
  return undefined;
}

/** Pairs in a crew, with their relation. */
export function crewPairs(s: Pick<TycoonState, 'bonds'>, people: Pick<CrewMember, 'id' | 'name'>[]) {
  const out: { a: Pick<CrewMember, 'id' | 'name'>; b: Pick<CrewMember, 'id' | 'name'>; value: number; rel: ReturnType<typeof relationOf> }[] = [];
  for (let i = 0; i < people.length; i++)
    for (let j = i + 1; j < people.length; j++) {
      const value = rapport(s, people[i].id, people[j].id);
      out.push({ a: people[i], b: people[j], value, rel: relationOf(value) });
    }
  return out;
}

/** What the relationships in a crew do on the night. */
export function teamEffect(s: Pick<TycoonState, 'bonds'>, people: Pick<CrewMember, 'id' | 'name'>[]) {
  const pairs = crewPairs(s, people);
  const trusted = pairs.filter(p => p.rel === 'trusted').length;
  const feuds = pairs.filter(p => p.rel === 'feud' || p.rel === 'refuse');
  return {
    /** Extra crew-equivalents from people who know each other's moves. */
    effective: Math.min(0.15, trusted * 0.05) * people.length,
    failureFactor: Math.max(0.85, 1 - trusted * 0.05),
    quality: -Math.min(0.08, feuds.length * 0.03),
    trusted,
    feuds,
  };
}

/** Would `m` refuse to board with anyone already aboard? */
export const refusesWith = (s: Pick<TycoonState, 'bonds'>, m: Pick<CrewMember, 'id'>, aboard: Pick<CrewMember, 'id'>[], limit = REFUSE) => aboard.some(o => o.id !== m.id && rapport(s, m.id, o.id) <= limit);

/** After a show, rapport moves for everyone who worked it together. */
export function bondAfterShow(s: TycoonState, people: CrewMember[], quality: number) {
  if (people.length < 2) return;
  const bonds = { ...(s.bonds ?? {}) };
  const night = quality >= 0.75 ? 2 : quality < 0.5 ? -2 : 0.5;
  for (let i = 0; i < people.length; i++)
    for (let j = i + 1; j < people.length; j++) {
      const a = people[i];
      const b = people[j];
      const key = pairKey(a.id, b.id);
      const before = bonds[key] ?? 0;
      const chem = chemistry(a.id, b.id);
      const tired = a.fatigue > 60 && b.fatigue > 60 ? 1.5 : 1;
      // Good chemistry builds on itself; bad chemistry grates, more so when they're shattered.
      const drift = chem > 0.4 ? 2.5 * chem : chem < -0.5 ? 4 * chem * tired : chem;
      const after = Math.max(-100, Math.min(100, before + night + drift));
      bonds[key] = Math.round(after * 10) / 10;
      const was = relationOf(before);
      const now = relationOf(after);
      if (now === was) continue;
      if (now === 'trusted') pushNews(s, `${a.name} and ${b.name} have become a trusted team — crew them together.`, 'good');
      else if (now === 'feud') pushNews(s, `${a.name} and ${b.name} are at each other's throats. Keep them on different trucks.`, 'bad');
      else if (now === 'refuse') pushNews(s, `${a.name} won't work with ${b.name} any more. They'll only share a truck if you name them both.`, 'bad');
    }
  s.bonds = bonds;
}

// ---------------------------------------------------------------------------
// Burnout
// ---------------------------------------------------------------------------

/** Above this fatigue, a day on the road adds lasting burnout. */
export const BURNOUT_FATIGUE = 70;
export const BURNOUT_QUIT = 70;

export function dailyBurnout(m: CrewMember, rate = 1) {
  if (m.vehicleId && m.fatigue >= BURNOUT_FATIGUE) m.burnout = Math.min(100, (m.burnout ?? 0) + 1.5 * rate);
  else if (m.depotId && m.fatigue < 30) m.burnout = Math.max(0, (m.burnout ?? 0) - 0.4);
}

/** Burnt-out people work below their level. */
export const burnoutFactor = (m: Pick<CrewMember, 'burnout'>) => 1 - Math.max(0, (m.burnout ?? 0) - 40) / 60 * 0.2;

/** Years with you make people harder to poach. */
export const loyaltyFactor = (m: Pick<CrewMember, 'hiredHour'>, hour: number) => 1 / (1 + Math.max(0, (hour - m.hiredHour) / (24 * 365)) * 0.25);
