/**
 * Facility upgrades. A warehouse can grow into a production campus, and each
 * base can add annexes alongside:
 *
 * - **Rehearsal stage** — a room, a soundstage, a production hall or a full
 *   arena-scale hall. Rehearse a booked show (or a whole tour) before it goes
 *   out for better quality and fewer failures on the night, and let it out to
 *   bands the rest of the time for rent that covers most of its upkeep.
 * - **Workshop bench** — in-house repairs on top of the workshop policy.
 * - **Crew lounge** — techs between jobs recover faster.
 *
 * Annexes need a warehouse of at least a certain size and cost upkeep every
 * month; all of it counts as the base's own building, so a shutdown leaves
 * you paying for an empty stage.
 */
import { book, dayOf, formatMoney, newId, pushNews } from './core';
import { marketNow } from './market';
import { worldOf } from './mapgen';
import type { Depot, Gig, ModuleId, Tour, TycoonState } from './types';

export interface ModuleLevel {
  label: string;
  build: number;
  /** Monthly cost. */
  upkeep: number;
  /** Warehouse size needed. */
  minSize: number;
  blurb: string;
}

export interface ModuleInfo {
  label: string;
  icon: string;
  levels: ModuleLevel[];
}

export const MODULES: Record<ModuleId, ModuleInfo> = {
  rehearsal: {
    label: 'Rehearsal stage',
    icon: '🎸',
    levels: [
      { label: 'Rehearsal room', build: 25000, upkeep: 400, minSize: 1, blurb: 'A sprung floor and a PA: run a show through before it leaves.' },
      { label: 'Soundstage', build: 70000, upkeep: 1100, minSize: 2, blurb: 'A proper soundstage with a rig overhead and a control room.' },
      { label: 'Production hall', build: 160000, upkeep: 2500, minSize: 3, blurb: 'Room for a full tour production: staging, lighting and video together.' },
      { label: 'Arena rehearsal hall', build: 320000, upkeep: 5000, minSize: 4, blurb: 'An arena-sized hall: stadium tours rehearse here before opening night.' },
    ],
  },
  workshop: {
    label: 'Workshop bench',
    icon: '🔧',
    levels: [
      { label: 'Workshop bench', build: 18000, upkeep: 500, minSize: 1, blurb: 'Test gear, solder and swap parts in-house.' },
      { label: 'Repair shop', build: 55000, upkeep: 1300, minSize: 2, blurb: 'A full repair shop with a test bay: kit comes back like new.' },
    ],
  },
  academy: {
    label: 'Training room',
    icon: '🎓',
    levels: [
      { label: 'Training room', build: 20000, upkeep: 350, minSize: 1, blurb: 'Rigging frames and a first-aid dummy: courses cost 30% less and take 40% fewer days.' },
      { label: 'Academy', build: 60000, upkeep: 900, minSize: 2, blurb: 'A proper academy: courses halve in price, and every quarter a fresh apprentice graduates into your crew.' },
    ],
  },
  lounge: {
    label: 'Crew lounge',
    icon: '🛋️',
    levels: [
      { label: 'Crew room', build: 12000, upkeep: 300, minSize: 1, blurb: 'Showers, a kitchen and somewhere to sleep between jobs.' },
      { label: 'Crew lounge & bunks', build: 35000, upkeep: 800, minSize: 2, blurb: 'Bunks, a cook and a games room: techs are back on their feet in no time.' },
    ],
  },
};
export const MODULE_IDS = Object.keys(MODULES) as ModuleId[];

/** Quality added to a rehearsed show, by stage level (1-4). */
export const REHEARSAL_QUALITY = [0, 0.02, 0.04, 0.06, 0.08];
/** Failure-chance multiplier on a rehearsed show. */
export const REHEARSAL_FAILURE = [1, 0.94, 0.88, 0.82, 0.76];
/** Rent per month from bands when the stage is free, in a mid-demand month. */
export const STAGE_RENTAL = [0, 350, 1100, 3200, 6500];
/** Fame a busy stage earns the town each month. */
export const STAGE_FAME = 0.3;
/** A rehearsal on a tour costs this share of the sum of its shows' rehearsals. */
export const TOUR_REHEARSAL_RATE = 0.6;
/** Bonus a tour's shows get relative to a single show's. */
export const TOUR_BONUS_SHARE = 0.8;
/** Share of a show's fee a rehearsal costs. */
export const REHEARSAL_FEE_SHARE = 0.05;
export const REHEARSAL_MIN_COST = 250;
/** A show must be at least this many days away to rehearse. */
export const REHEARSAL_LEAD_DAYS = 2;

/** Workshop bench: extra repairs per day and the condition they reach. */
export const BENCH_REPAIR = [0, 0.08, 0.18];
export const BENCH_CAP = [0, 85, 95];
/** Each extra bench adds this share of its repair rate. */
export const BENCH_STACK = 0.3;

/** Fatigue a resting tech sheds per day on top of the normal 10. */
export const LOUNGE_REST = [0, 3, 6];
export const LOUNGE_MORALE = [0, 0, 0.3];

export const modLevel = (d: Pick<Depot, 'modules'>, id: ModuleId) => d.modules?.[id] ?? 0;
export const moduleLevel = (id: ModuleId, level: number): ModuleLevel | undefined => MODULES[id].levels[level - 1];

export function moduleBlocker(s: TycoonState, d: Depot, id: ModuleId): string | null {
  if (d.kind !== 'warehouse') return 'Annexes need a warehouse — upgrade this delegation first.';
  const next = moduleLevel(id, modLevel(d, id) + 1);
  if (!next) return 'Fully built.';
  if (d.size < next.minSize) return `${next.label} needs a ${next.minSize >= 4 ? 'production campus' : ['', 'small', 'medium', 'large'][next.minSize] + ' warehouse'}.`;
  if (s.company.cash < next.build) return `Needs ${formatMoney(s, next.build)}.`;
  return null;
}

export function buildModule(s: TycoonState, d: Depot, id: ModuleId) {
  const level = modLevel(d, id) + 1;
  const spec = moduleLevel(id, level)!;
  book(s, 'facilities', -spec.build);
  (d.modules ??= {})[id] = level;
  const city = worldOf(s).cityById.get(d.cityId)?.name;
  pushNews(s, `${s.company.name} adds a ${spec.label.toLowerCase()} at its ${city} base.`, 'good', { cityId: d.cityId });
}

/** Total monthly upkeep of a base's annexes. */
export function annexUpkeep(d: Depot): number {
  return MODULE_IDS.reduce((sum, id) => sum + (moduleLevel(id, modLevel(d, id))?.upkeep ?? 0), 0);
}

/** What the stage should earn in a month from bands (mid-demand, mid-rated town). */
export function stageRental(s: TycoonState, d: Depot): number {
  const level = modLevel(d, 'rehearsal');
  if (!level) return 0;
  const demand = marketNow(s).shutdown ? 0 : marketNow(s).demand;
  const town = 0.7 + ((s.cityRatings[d.cityId] ?? 50) / 100) * 0.6;
  return Math.round((STAGE_RENTAL[level] * demand * town) / 10) * 10;
}

/** Monthly: upkeep out, rentals in, the town hears about the stage. */
export function monthlyAnnexes(s: TycoonState) {
  s.depots.forEach(d => {
    const upkeep = annexUpkeep(d);
    if (!upkeep) return;
    const rental = stageRental(s, d);
    book(s, 'facilities', rental - upkeep);
    if (modLevel(d, 'rehearsal')) s.cityRatings[d.cityId] = Math.min(100, (s.cityRatings[d.cityId] ?? 50) + STAGE_FAME * (modLevel(d, 'rehearsal') / 2));
    const lounge = modLevel(d, 'lounge');
    if (LOUNGE_MORALE[lounge]) s.crewMorale = Math.min(100, s.crewMorale + LOUNGE_MORALE[lounge]);
  });
}

/** Daily: extra repairs from benches. Returns [repairPerDay, cap]. */
export function benchRepair(s: Pick<TycoonState, 'depots'>): [number, number] {
  const levels = s.depots.map(d => modLevel(d, 'workshop')).filter(l => l > 0).sort((a, b) => b - a);
  if (!levels.length) return [0, 0];
  const repair = BENCH_REPAIR[levels[0]] + levels.slice(1).reduce((sum, l) => sum + BENCH_REPAIR[l] * BENCH_STACK, 0);
  return [repair, BENCH_CAP[levels[0]]];
}

/** Fatigue recovered per day by a tech resting at this depot, beyond the usual. */
export const loungeRest = (d: Pick<Depot, 'modules'>) => LOUNGE_REST[modLevel(d, 'lounge')] ?? 0;

// ---------------------------------------------------------------------------
// Rehearsals
// ---------------------------------------------------------------------------

/** The best stage you have that's free. */
export function bestStage(s: TycoonState): { depot: Depot; level: number } | null {
  const today = dayOf(s.hour);
  let best: { depot: Depot; level: number } | null = null;
  s.depots.forEach(d => {
    const level = modLevel(d, 'rehearsal');
    if (level && (d.stageBusyUntil ?? -1) <= today && (!best || level > best.level)) best = { depot: d, level };
  });
  return best;
}

export const bestStageLevel = (s: TycoonState) => s.depots.reduce((m, d) => Math.max(m, modLevel(d, 'rehearsal')), 0);

export const gigRehearsalCost = (g: Pick<Gig, 'fee'>) => Math.max(REHEARSAL_MIN_COST, Math.round((g.fee * REHEARSAL_FEE_SHARE) / 10) * 10);

export const rehearsable = (s: TycoonState, g: Gig) => g.status === 'booked' && !g.rehearsed && g.day - dayOf(s.hour) >= REHEARSAL_LEAD_DAYS;

export function tourLegs(s: TycoonState, t: Tour): Gig[] {
  return t.gigIds.map(id => s.gigs.find(g => g.id === id)).filter((g): g is Gig => !!g && rehearsable(s, g));
}

export const tourRehearsalCost = (s: TycoonState, t: Tour) => Math.round((tourLegs(s, t).reduce((sum, g) => sum + gigRehearsalCost(g), 0) * TOUR_REHEARSAL_RATE) / 10) * 10;

/** Days the stage is taken for. */
export const rehearsalDays = (legs: number) => 1 + Math.min(4, Math.ceil(legs / 3));

export type RehearseTarget = { kind: 'gig'; gig: Gig } | { kind: 'tour'; tour: Tour; legs: Gig[] };

export function rehearsalTarget(s: TycoonState, id: string): RehearseTarget | null {
  const gig = s.gigs.find(g => g.id === id);
  if (gig && !gig.tourId) return { kind: 'gig', gig };
  const tour = s.tours.find(t => t.id === id) ?? (gig?.tourId ? s.tours.find(t => t.id === gig.tourId) : undefined);
  if (tour) return { kind: 'tour', tour, legs: tourLegs(s, tour) };
  return null;
}

export function rehearsalBlocker(s: TycoonState, id: string): string | null {
  const target = rehearsalTarget(s, id);
  if (!target) return 'Nothing to rehearse.';
  if (!bestStageLevel(s)) return 'You need a rehearsal stage at one of your warehouses.';
  const stage = bestStage(s);
  if (!stage) return 'Your stage is booked up with another rehearsal.';
  const need = target.kind === 'gig' ? requiredStageLevel(s, target.gig) : target.legs.length ? requiredStageLevel(s, target.legs[0]) : 0;
  if (stage.level < need) return `The free stage is too small — this needs a ${stageName(need)}.`;
  if (target.kind === 'gig') {
    if (!rehearsable(s, target.gig)) return target.gig.rehearsed ? 'Already rehearsed.' : `Needs a booked show at least ${REHEARSAL_LEAD_DAYS} days away.`;
    const cost = gigRehearsalCost(target.gig);
    if (s.company.cash < cost) return `Rehearsal costs ${formatMoney(s, cost)}.`;
    return null;
  }
  if (!target.legs.length) return 'No dates left to rehearse (or all done).';
  const cost = tourRehearsalCost(s, target.tour);
  if (s.company.cash < cost) return `Rehearsal costs ${formatMoney(s, cost)}.`;
  return null;
}

/** Mutating: rehearse a show or a whole tour. Returns a line. */
export function rehearse(s: TycoonState, id: string): string {
  const target = rehearsalTarget(s, id)!;
  const stage = bestStage(s)!;
  const level = stage.level;
  const apply = (g: Gig, share: number) => {
    const m = (g.mods ??= {});
    m.quality = (m.quality ?? 0) + REHEARSAL_QUALITY[level] * share;
    m.failureFactor = (m.failureFactor ?? 1) * (1 - (1 - REHEARSAL_FAILURE[level]) * share);
    g.rehearsed = level;
  };
  const today = dayOf(s.hour);
  if (target.kind === 'gig') {
    const cost = gigRehearsalCost(target.gig);
    book(s, 'facilities', -cost);
    apply(target.gig, 1);
    stage.depot.stageBusyUntil = today + rehearsalDays(1);
    return `${target.gig.act} rehearse in your ${moduleLevel('rehearsal', level)!.label.toLowerCase()} (${formatMoney(s, cost)}).`;
  }
  const cost = tourRehearsalCost(s, target.tour);
  book(s, 'facilities', -cost);
  target.legs.forEach(g => apply(g, TOUR_BONUS_SHARE));
  stage.depot.stageBusyUntil = today + rehearsalDays(target.legs.length);
  return `${target.tour.name} rehearses for ${rehearsalDays(target.legs.length)} days in your ${moduleLevel('rehearsal', level)!.label.toLowerCase()} (${formatMoney(s, cost)}).`;
}

// ---------------------------------------------------------------------------
// Required rehearsals
// ---------------------------------------------------------------------------

/** Quality and failure penalty for a show that needed a rehearsal and didn't get one. */
export const UNREHEARSED_QUALITY = 0.1;
export const UNREHEARSED_FAILURE = 1.3;

/** Stage level (1-4) a tour needs: world tours want a production hall, big national tours a soundstage. */
export function tourStageLevel(kind: 'national' | 'world', maxTier: number): number {
  if (kind === 'world') return 3;
  return maxTier >= 4 ? 3 : maxTier === 3 ? 2 : maxTier === 2 ? 1 : 0;
}

/** Stage level a single show needs (0 = none). Festival stages bring their own rig. */
export function requiredStageLevel(s: TycoonState, g: Gig): number {
  if (g.festival) return 0;
  if (g.tourId) {
    const tour = s.tours.find(t => t.id === g.tourId);
    if (!tour) return 0;
    const tiers = tour.gigIds.map(id => s.gigs.find(x => x.id === id)?.tier ?? 0);
    return tourStageLevel(tour.kind, Math.max(0, ...tiers));
  }
  if (g.overseas) return 3;
  if (g.event) return 2;
  return g.tier >= 4 ? 2 : g.tier === 3 ? 1 : 0;
}

export const stageName = (level: number) => MODULES.rehearsal.levels[Math.max(1, Math.min(4, level)) - 1].label.toLowerCase();

/** Has this show missed a rehearsal it needed? (Only meaningful on or after the day.) */
export const unrehearsed = (s: TycoonState, g: Gig) => {
  const need = requiredStageLevel(s, g);
  return need > 0 && (g.rehearsed ?? 0) < need;
};

/** Why you can't take on a show or tour that needs a rehearsal, or null. `firstDay` is its first date. */
export function stageBlocker(s: TycoonState, level: number, firstDay: number): string | null {
  if (level <= 0) return null;
  if (bestStageLevel(s) < level) return `Rehearsal required: you need a ${stageName(level)} (or better) — build one at a warehouse (Base → Annexes).`;
  if (firstDay - dayOf(s.hour) < REHEARSAL_LEAD_DAYS + 1) return 'Too late to rehearse before it opens.';
  return null;
}

/** Daily: auto-rehearse if the policy says so, otherwise nag as the dates close in. */
export function dailyRehearsals(s: TycoonState) {
  const today = dayOf(s.hour);
  const auto = s.policies.rehearsal === 'auto';
  const ids: { id: string; first: number; label: string }[] = [];
  s.gigs.forEach(g => {
    if (g.tourId || g.status !== 'booked' || !requiredStageLevel(s, g) || g.rehearsed) return;
    ids.push({ id: g.id, first: g.day, label: g.act });
  });
  s.tours.forEach(t => {
    if (t.status !== 'booked') return;
    const legs = t.gigIds.map(id => s.gigs.find(g => g.id === id)).filter((g): g is Gig => !!g && g.status === 'booked' && !g.rehearsed);
    if (!legs.length || !requiredStageLevel(s, legs[0])) return;
    ids.push({ id: t.id, first: Math.min(...legs.map(g => g.day)), label: t.name });
  });
  ids.sort((a, b) => a.first - b.first).forEach(({ id, first, label }) => {
    const away = first - today;
    if (auto && away <= 14 && away >= REHEARSAL_LEAD_DAYS && !rehearsalBlocker(s, id)) {
      pushNews(s, rehearse(s, id), 'good');
      return;
    }
    if ((away === 7 || away === REHEARSAL_LEAD_DAYS + 1) && !s.news.some(n => n.hour === s.hour && n.text.includes(label))) {
      pushNews(s, `${label} still hasn't rehearsed — ${away === 7 ? 'a week' : `${away} days`} to go. Unrehearsed shows suffer.`, 'bad');
    }
  });
}
