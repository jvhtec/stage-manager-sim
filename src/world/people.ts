/**
 * Gig crew are people. Everyone has a name, a main department (sound,
 * lighting, video or staging) rated 1-5★ and maybe a second string, a trait,
 * their own fatigue, and a day rate that follows their skill.
 *
 * At a show the crew slots are split by what the show needs — a light-heavy
 * arena wants LX techs — and the best-matched people fill them. Everyone
 * levels up in the department they work, and the stars get poached when
 * morale slips.
 *
 * `Depot.crew` / `Vehicle.crew` and the fatigue/experience averages are kept
 * as cached summaries by `syncCrew`, so code that only needs headcounts keeps
 * reading them.
 */
import { createRng, type Rng } from '@/lib/rng';
import { CREW_HIRE_COST, CREW_WAGE_PER_DAY } from './catalog';
import { newId, pushNews } from './core';
import { NAMES } from './content/names';
import type { CrewDept, CrewMember, CrewTrait, Gig, RestRota, TycoonState } from './types';

export const CREW_DEPTS: CrewDept[] = ['audio', 'lighting', 'video', 'stage'];
export const CREW_DEPT_LABEL: Record<CrewDept, string> = { audio: 'Sound', lighting: 'Lighting', video: 'Video', stage: 'Staging' };
export const CREW_ROLE: Record<CrewDept, string[]> = {
  audio: ['sound tech', 'monitor engineer', 'FOH engineer', 'system tech', 'audio crew chief'],
  lighting: ['LX tech', 'dimmer tech', 'lighting programmer', 'lighting director', 'lighting crew chief'],
  video: ['video tech', 'camera op', 'LED tech', 'media server op', 'video director'],
  stage: ['stagehand', 'carpenter', 'rigger', 'head rigger', 'stage manager'],
};

export const TRAITS: Record<CrewTrait, { label: string; blurb: string }> = {
  chief: { label: 'Crew chief', blurb: 'Runs the room: the whole show goes better.' },
  roadwarrior: { label: 'Road warrior', blurb: 'Tires slowly on the road.' },
  perfectionist: { label: 'Perfectionist', blurb: 'Checks everything twice: fewer failures on the night.' },
  polyglot: { label: 'Polyglot', blurb: 'At home on the legs abroad.' },
  party: { label: 'Party animal', blurb: 'Lifts everyone’s spirits — and tires faster.' },
  mentor: { label: 'Mentor', blurb: 'Everyone on the show learns faster.' },
};
const TRAIT_IDS = Object.keys(TRAITS) as CrewTrait[];

/** Shows worked in a department to reach the next level (index = current level). */
export const LEVEL_UP_SHOWS = [0, 10, 30, 60, 110];

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

export const levelOf = (m: CrewMember) => Math.floor(m.skills[m.primary]);
export const stars = (n: number) => '★'.repeat(Math.max(0, Math.floor(n))) + '☆'.repeat(Math.max(0, 5 - Math.floor(n)));

/** Day rate: a 1★ tech earns less than the going rate, a 5★ much more. */
export const dayRate = (m: CrewMember) => CREW_WAGE_PER_DAY * (0.7 + 0.15 * Math.max(1, levelOf(m))) * (m.payBump ?? 1);
export const hireFee = (m: CrewMember) => Math.round(CREW_HIRE_COST * (0.5 + 0.5 * levelOf(m)));
export const roleOf = (m: CrewMember) => CREW_ROLE[m.primary][Math.min(4, Math.max(0, levelOf(m) - 1))];

function makeName(rng: Rng, country: TycoonState['country']): string {
  const pool = NAMES[country] ?? NAMES.GB;
  return `${rng.pick(pool.first)} ${rng.pick(pool.last)}`;
}

/** A new person: their main department at `level`, maybe a weaker second string and a trait. */
export function makePerson(s: TycoonState, rng: Rng, level: number, primary?: CrewDept): CrewMember {
  const main = primary ?? rng.pick(CREW_DEPTS);
  const skills: Record<CrewDept, number> = { audio: 0, lighting: 0, video: 0, stage: 0 };
  skills[main] = Math.max(1, Math.min(5, level));
  if (rng.chance(0.55)) {
    const second = rng.pick(CREW_DEPTS.filter(d => d !== main));
    skills[second] = Math.max(1, Math.min(skills[main] - 1, 1 + rng.nextInt(2)));
  }
  return {
    id: newId(s, 'crew'),
    name: makeName(rng, s.country),
    primary: main,
    skills,
    xp: { audio: 0, lighting: 0, video: 0, stage: 0 },
    trait: rng.chance(0.35) ? rng.pick(TRAIT_IDS) : undefined,
    fatigue: 0,
    hiredHour: s.hour,
  };
}

/** Level for a candidate in the hiring market: mostly 1-2★, stars are rare (more so for a big name). */
export function candidateLevel(rng: Rng, reputation: number): number {
  const r = rng.next() - reputation / 400;
  return r < 0.02 ? 5 : r < 0.07 ? 4 : r < 0.22 ? 3 : r < 0.55 ? 2 : 1;
}

// ---------------------------------------------------------------------------
// Where people are
// ---------------------------------------------------------------------------

export const atDepot = (s: TycoonState, depotId: string) => s.people.filter(p => p.depotId === depotId);
export const aboard = (s: TycoonState, vehicleId: string) => s.people.filter(p => p.vehicleId === vehicleId);

export function moveToDepot(m: CrewMember, depotId: string) {
  m.depotId = depotId;
  m.vehicleId = undefined;
}

export function moveToVehicle(m: CrewMember, vehicleId: string) {
  m.vehicleId = vehicleId;
  m.depotId = undefined;
}

/** Refreshes the cached headcounts and averages on bases and trucks. */
export function syncCrew(s: TycoonState) {
  const byDepot = new Map<string, CrewMember[]>();
  const byVehicle = new Map<string, CrewMember[]>();
  s.people.forEach(p => {
    if (p.vehicleId) (byVehicle.get(p.vehicleId) ?? byVehicle.set(p.vehicleId, []).get(p.vehicleId)!).push(p);
    else if (p.depotId) (byDepot.get(p.depotId) ?? byDepot.set(p.depotId, []).get(p.depotId)!).push(p);
  });
  const avg = (list: CrewMember[], f: (m: CrewMember) => number) => (list.length ? list.reduce((a, m) => a + f(m), 0) / list.length : 0);
  s.depots.forEach(d => {
    const list = byDepot.get(d.id) ?? [];
    d.crew = list.length;
    d.fatigue = avg(list, m => m.fatigue);
    d.experience = avg(list, m => levelOf(m) * 20);
  });
  s.vehicles.forEach(v => {
    if (v.owner !== 'player') return;
    const list = byVehicle.get(v.id) ?? [];
    v.crew = list.length;
    v.crewFatigue = avg(list, m => m.fatigue);
    v.crewExperience = avg(list, m => levelOf(m) * 20);
  });
}

// ---------------------------------------------------------------------------
// Matching people to a show
// ---------------------------------------------------------------------------

/** Crew slots per department, in proportion to what the show needs (consoles count as sound). */
export function crewSlots(gig: Gig): Record<CrewDept, number> {
  const weight: Record<CrewDept, number> = {
    audio: gig.needs.audio + gig.needs.console,
    lighting: gig.needs.lighting,
    video: gig.needs.video,
    stage: gig.needs.stage,
  };
  const total = CREW_DEPTS.reduce((a, d) => a + weight[d], 0) || 1;
  const slots: Record<CrewDept, number> = { audio: 0, lighting: 0, video: 0, stage: 0 };
  let given = 0;
  CREW_DEPTS.forEach(d => {
    slots[d] = Math.floor((gig.crewNeeded * weight[d]) / total);
    given += slots[d];
  });
  // Hand out the remainder to the departments with the most work.
  const order = [...CREW_DEPTS].sort((a, b) => weight[b] - weight[a]);
  for (let i = 0; given < gig.crewNeeded; i++, given++) slots[order[i % order.length]] += 1;
  return slots;
}

/** What one person is worth in a department: 0.55 out of their depth, 1.2 at 5★. */
export const skillFactor = (skill: number) => 0.55 + 0.13 * Math.max(0, Math.min(5, skill));
/** Fresh 1.0, exhausted 0.65. */
export const fatigueFactor = (fatigue: number) => 1 - (Math.max(0, fatigue - 30) / 70) * 0.35;

export interface CrewEvaluation {
  /** Crew-equivalents delivered (compare with crewNeeded). */
  effective: number;
  /** How well skills matched the slots, 0-1. */
  match: number;
  assigned: Map<string, CrewDept>;
  bonus: number;
  /** Multiplier on the chance of kit failing on the night. */
  failureFactor: number;
}

/** Fill the show's department slots with the best-matched people; the rest lend a hand. */
export function evaluateCrew(people: CrewMember[], gig: Gig): CrewEvaluation {
  const slots = crewSlots(gig);
  const assigned = new Map<string, CrewDept>();
  const pairs: { m: CrewMember; d: CrewDept; skill: number }[] = [];
  people.forEach(m => CREW_DEPTS.forEach(d => pairs.push({ m, d, skill: m.skills[d] })));
  pairs.sort((a, b) => b.skill - a.skill || a.m.id.localeCompare(b.m.id));
  pairs.forEach(({ m, d }) => {
    if (assigned.has(m.id) || slots[d] <= 0) return;
    assigned.set(m.id, d);
    slots[d] -= 1;
  });
  let effective = 0;
  let matchSum = 0;
  people.forEach(m => {
    const d = assigned.get(m.id) ?? m.primary;
    const skill = assigned.has(m.id) ? m.skills[d] : 0;
    const abroad = gig.overseas && m.trait === 'polyglot' ? 0.1 : 0;
    effective += (skillFactor(skill) + abroad) * fatigueFactor(m.fatigue);
    matchSum += skillFactor(skill) / skillFactor(5);
  });
  const chief = people.some(m => m.trait === 'chief');
  const perfectionist = people.some(m => m.trait === 'perfectionist');
  return {
    effective,
    match: people.length ? matchSum / people.length : 0,
    assigned,
    bonus: chief ? 0.03 : 0,
    failureFactor: perfectionist ? 0.85 : 1,
  };
}

/** Rest rota: fatigue at which people stay at base instead of going out. */
export const REST_AT: Record<RestRota, number> = { off: Infinity, tired: 70, strict: 50 };

export interface PickOptions {
  /** The truck being loaded: people pinned to it board first, people pinned elsewhere don't. */
  vehicleId?: string;
  /** Fatigue at which people sit the job out (pinned people still go). */
  restAt?: number;
}

/** Whether `m` may board the truck being loaded. */
export function mayBoard(m: CrewMember, opts: PickOptions = {}): boolean {
  if (m.pinnedVehicleId && m.pinnedVehicleId !== opts.vehicleId) return false;
  if (m.pinnedVehicleId === opts.vehicleId && opts.vehicleId) return true;
  return m.fatigue < (opts.restAt ?? Infinity);
}

/**
 * Who boards a truck: anyone pinned to it, then the fresh, well-matched
 * people for the job ahead. Picks up to `seats` from `pool` (mutating it)
 * and returns them.
 */
export function pickCrew(pool: CrewMember[], gig: Gig, seats: number, alreadyAboard: CrewMember[] = [], opts: PickOptions = {}): CrewMember[] {
  const slots = crewSlots(gig);
  alreadyAboard.forEach(m => {
    if (slots[m.primary] > 0) slots[m.primary] -= 1;
  });
  const picked: CrewMember[] = [];
  while (picked.length < seats) {
    let best = -1;
    let bestScore = -Infinity;
    pool.forEach((m, i) => {
      if (!mayBoard(m, opts)) return;
      const fit = Math.max(...CREW_DEPTS.map(d => (slots[d] > 0 ? m.skills[d] + 1 : m.skills[d] * 0.3)));
      const pinned = opts.vehicleId && m.pinnedVehicleId === opts.vehicleId ? 100 : 0;
      const score = pinned + fit - m.fatigue / 40;
      if (score > bestScore || (score === bestScore && best >= 0 && m.id < pool[best].id)) {
        best = i;
        bestScore = score;
      }
    });
    if (best < 0) break;
    const [m] = pool.splice(best, 1);
    const dept = CREW_DEPTS.filter(d => slots[d] > 0).sort((a, b) => m.skills[b] - m.skills[a])[0];
    if (dept) slots[dept] -= 1;
    picked.push(m);
  }
  return picked;
}

/** People pinned to a truck. */
export const pinnedTo = (s: TycoonState, vehicleId: string) => s.people.filter(m => m.pinnedVehicleId === vehicleId);
/** A truck is gone: its regulars go back into the pool. */
export function unpinFrom(s: TycoonState, vehicleId: string) {
  s.people.forEach(m => {
    if (m.pinnedVehicleId === vehicleId) m.pinnedVehicleId = undefined;
  });
}

// ---------------------------------------------------------------------------
// Growth, fatigue and leaving
// ---------------------------------------------------------------------------

/** After a show: everyone learns in the department they worked; mentors speed it up. */
export function learnFromShow(s: TycoonState, people: CrewMember[], assigned: Map<string, CrewDept>, big: boolean) {
  const mentor = people.some(m => m.trait === 'mentor');
  people.forEach(m => {
    const d = assigned.get(m.id) ?? m.primary;
    m.xp[d] += (big ? 1.5 : 1) * (mentor ? 1.5 : 1);
    const level = Math.floor(m.skills[d]);
    if (level >= 5) return;
    const need = LEVEL_UP_SHOWS[Math.max(1, level)] ?? 110;
    if (m.xp[d] < need) return;
    m.xp[d] = 0;
    m.skills[d] = level + 1;
    if (m.skills[d] > m.skills[m.primary]) m.primary = d;
    if (m.skills[d] >= 3)
      pushNews(s, `${m.name} is now a ${m.skills[d]}★ ${CREW_DEPT_LABEL[d].toLowerCase()} tech (${roleOf(m)}) — and paid like one.`, 'good');
  });
}

export function dailyPeopleFatigue(s: TycoonState) {
  const status = new Map(s.vehicles.map(v => [v.id, v.status]));
  s.people.forEach(m => {
    if (m.vehicleId) {
      const base = status.get(m.vehicleId) === 'on-site' ? 4 : 3;
      const mult = m.trait === 'roadwarrior' ? 0.6 : m.trait === 'party' ? 1.2 : 1;
      m.fatigue = Math.min(100, m.fatigue + base * mult);
    } else {
      m.fatigue = Math.max(0, m.fatigue - 10);
    }
  });
}

/** Training: people at base improve in their main department. */
export function trainPeople(s: TycoonState, showsWorth: number) {
  if (!showsWorth) return;
  s.people.forEach(m => {
    if (!m.depotId) return;
    m.xp[m.primary] += showsWorth;
    const level = Math.floor(m.skills[m.primary]);
    if (level < 5 && m.xp[m.primary] >= (LEVEL_UP_SHOWS[Math.max(1, level)] ?? 110)) {
      m.xp[m.primary] = 0;
      m.skills[m.primary] = level + 1;
    }
  });
}

/** Days you have to answer a rival's offer to one of your people. */
export const POACH_ANSWER_DAYS = 14;
/** Matching an offer keeps them loyal this long. */
export const LOYALTY_DAYS = 365;

/**
 * Leaving: below 40 morale people quit; below 50 rivals make offers to your
 * stars (3★ and up), which you can match. Only people at base leave.
 */
export function peopleLeave(s: TycoonState, rng: Rng, morale: number) {
  const gone: string[] = [];
  s.people.forEach(m => {
    if (!m.depotId) return;
    const level = levelOf(m);
    if (morale < 50 && level >= 3 && s.rivals.length && rng.chance(((50 - morale) / 150) * (level - 2) / 2)) {
      if ((m.loyalUntil ?? 0) > s.hour || s.poachBids.some(b => b.personId === m.id)) return;
      const rival = rng.pick(s.rivals);
      const raise = Math.round((0.15 + rng.next() * 0.25 + (level - 3) * 0.05) * 20) / 20;
      s.poachBids.push({ id: newId(s, 'poach'), personId: m.id, rivalName: rival.name, raise, expiresDay: Math.floor(s.hour / 24) + POACH_ANSWER_DAYS });
      pushNews(s, `${rival.name} offer ${m.name}, your ${level}★ ${roleOf(m)}, +${Math.round(raise * 100)}% to join them. Match it in the crew window or lose them.`, 'bad');
      return;
    }
    if (morale < 40 && rng.chance((40 - morale) / 100)) gone.push(m.id);
  });
  const quit = gone.length;
  if (!quit) return 0;
  s.people = s.people.filter(m => !gone.includes(m.id));
  s.poachBids = s.poachBids.filter(b => !gone.includes(b.personId));
  return quit;
}

/** Daily: unanswered offers are taken (once the person is back at base — nobody walks off mid-tour). */
export function dailyPoachBids(s: TycoonState) {
  const today = Math.floor(s.hour / 24);
  s.poachBids = s.poachBids.filter(b => {
    const m = s.people.find(p => p.id === b.personId);
    if (!m) return false;
    if (today < b.expiresDay || !m.depotId) return true;
    s.people = s.people.filter(p => p.id !== m.id);
    pushNews(s, `${m.name} has joined ${b.rivalName}.`, 'bad');
    return false;
  });
}

/** Mutating helper: keep them on the rival's money, or let them go. */
export function settlePoachBid(s: TycoonState, bidId: string, keep: boolean): string | null {
  const bid = s.poachBids.find(b => b.id === bidId);
  if (!bid) return null;
  const m = s.people.find(p => p.id === bid.personId);
  s.poachBids = s.poachBids.filter(b => b.id !== bidId);
  if (!m) return null;
  if (keep) {
    m.payBump = Math.round((m.payBump ?? 1) * (1 + bid.raise) * 100) / 100;
    m.loyalUntil = s.hour + LOYALTY_DAYS * 24;
    return `${m.name} stays — on ${Math.round(bid.raise * 100)}% more.`;
  }
  if (!m.depotId) {
    bid.expiresDay = 0;
    s.poachBids.push(bid);
    return `${m.name} will leave for ${bid.rivalName} once they’re back at base.`;
  }
  s.people = s.people.filter(p => p.id !== m.id);
  return `${m.name} has joined ${bid.rivalName}. Good luck to them.`;
}

/** Party animals lift the mood (a little). */
export const partyBonus = (s: TycoonState) => Math.min(6, s.people.filter(m => m.trait === 'party').length * 2);

// ---------------------------------------------------------------------------
// Hiring market
// ---------------------------------------------------------------------------

/** Monthly: each base gets a fresh handful of candidates. */
export function refreshCandidates(s: TycoonState, rng: Rng) {
  s.candidates = [];
  s.depots.forEach(d => {
    const n = d.kind === 'delegation' ? 2 : 2 + d.size;
    for (let i = 0; i < n; i++) {
      const c = makePerson(s, rng, candidateLevel(rng, s.company.reputation));
      c.depotId = d.id;
      s.candidates.push(c);
    }
  });
}

/** A stable rng for one-off generation that mustn't disturb the sim's sequence. */
export const sideRng = (s: TycoonState, salt: number) => createRng((s.mapSeed ^ (salt * 2654435761)) >>> 0);

/** Starter crew for a new company, or crew converted from an old save's headcount. */
export function seedPeople(s: TycoonState, rng: Rng, depotId: string, count: number, level: number, depts?: CrewDept[]) {
  for (let i = 0; i < count; i++) {
    const m = makePerson(s, rng, Math.max(1, Math.min(5, level + (rng.chance(0.3) ? 1 : 0))), depts?.[i % depts.length]);
    m.depotId = depotId;
    s.people.push(m);
  }
}
