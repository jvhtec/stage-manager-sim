/**
 * Rivals run the same business you do. Each firm has kit (units per department at a quality, a
 * desk with so many inputs and a console family, the PA brands it owns), crew, trucks, cash and kit
 * condition. Before a rival takes a show it checks what you'd check: is the kit, crew and a truck
 * free on those days; can it meet the technical rider (or cross-hire to); does the rig fit the room
 * (or what do the fixes cost). If the job doesn't stand up it passes — and remembers why, and
 * reinvests in what keeps costing it work. Its shows are judged on its kit, not a fixed score; it
 * books the fee and the costs, pays overheads, and its health follows its books.
 */
import type { Rng } from '@/lib/rng';
import { createRng } from '@/lib/rng';
import { getModel, tierInfo } from './catalog';
import { consoleInputs } from './content/consoles';
import { expectedQuality, productsAvailableIn } from './content/gear';
import { dateOfDay, yearOf } from './core';
import { showPayout } from './gate';
import { productionProblems, typicalKit } from './production';
import { crossHireCost, crossHireOptions } from './techRider';
import type { Gig, Rival, RivalOps, TycoonState, WorldMap } from './types';
import { DEPTS } from './types';

/** A rival won't take a show whose rider and room fixes cost more than this share of the fee. */
export const RIVAL_FIX_LIMIT = 0.2;
/** Share of the fee a show costs a rival to deliver (crew, fuel, per diems). */
export const RIVAL_SHOW_COST = 0.25;

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 41);

function pickDesk(year: number, tier: number, rng: Rng) {
  const desks = productsAvailableIn(year, 'console').filter(p => p.quality >= expectedQuality(tier, year) - 2.5);
  const pool = desks.length ? desks : productsAvailableIn(year, 'console');
  return pool.length ? rng.pick(pool.sort((a, b) => a.id.localeCompare(b.id))) : undefined;
}
function pickPa(year: number, tier: number, rng: Rng): string[] {
  const brands = [...new Set(productsAvailableIn(year, 'audio').filter(p => p.quality >= expectedQuality(tier, year) - 2).map(p => p.brand))].sort();
  if (!brands.length) return [];
  const first = rng.pick(brands);
  const rest = brands.filter(b => b !== first);
  return rest.length && rng.chance(0.4) ? [first, rng.pick(rest)] : [first];
}

/** The rival's operation, set up from its size and standing the first time it's needed. */
export function opsOf(s: TycoonState, r: Rival): RivalOps {
  if (r.ops) return r.ops;
  const year = yearOf(s, s.hour);
  const rng = createRng((s.mapSeed ^ hash(r.id)) >>> 0);
  const top = tierInfo(r.maxTier);
  const scale = 1.5 + r.reputation / 50;
  const desk = pickDesk(year, r.maxTier, rng);
  r.ops = {
    cash: 40000 * r.maxTier + r.reputation * 600,
    kit: Object.fromEntries(DEPTS.map(d => [d, Math.ceil(top.needs[d] * scale)])) as RivalOps['kit'],
    quality: Math.round((expectedQuality(r.maxTier, year) - 0.8 + rng.next()) * 10) / 10,
    desk: desk?.brand,
    inputs: desk ? consoleInputs(desk) : 24,
    pa: pickPa(year, r.maxTier, rng),
    crew: Math.ceil(top.crew * scale),
    trucks: 2 + r.maxTier,
    condition: 85,
    month: { income: 0, costs: 0 },
    record: { shows: 0, failed: 0, crossHires: 0, fixes: 0, cancelled: 0, declined: {} },
  };
  return r.ops;
}

const overlaps = (a: Pick<Gig, 'day' | 'days'>, b: Pick<Gig, 'day' | 'days'>) => a.day <= b.day + (b.days ?? 1) - 1 && b.day <= a.day + (a.days ?? 1) - 1;

/** The rival's shows still to play that overlap `gig`. */
export function rivalCommitments(s: Pick<TycoonState, 'gigs'>, rivalId: string, gig: Pick<Gig, 'id' | 'day' | 'days'>): Gig[] {
  return s.gigs.filter(g => g.rivalId === rivalId && g.status === 'rival' && !g.result && g.id !== gig.id && overlaps(g, gig));
}

export type DeclineReason = 'kit' | 'crew' | 'trucks' | 'rider' | 'room';
export interface RivalQuote {
  ok: boolean;
  reason?: DeclineReason;
  cost: number;
  crossHires: number;
  fixes: number;
}

/** Can this rival do this show, and what does meeting the rider and the room cost? */
export function rivalQuote(s: TycoonState, world: WorldMap, r: Rival, gig: Gig): RivalQuote {
  const ops = opsOf(s, r);
  const busy = rivalCommitments(s, r.id, gig);
  for (const d of DEPTS) {
    const held = busy.reduce((n, g) => n + g.needs[d], 0);
    if (gig.needs[d] && held + gig.needs[d] > ops.kit[d]) return { ok: false, reason: 'kit', cost: 0, crossHires: 0, fixes: 0 };
  }
  if (busy.reduce((n, g) => n + g.crewNeeded, 0) + gig.crewNeeded > ops.crew) return { ok: false, reason: 'crew', cost: 0, crossHires: 0, fixes: 0 };
  if (busy.length + 1 > ops.trucks) return { ok: false, reason: 'trucks', cost: 0, crossHires: 0, fixes: 0 };
  const year = dateOfDay(s, gig.day).getUTCFullYear();
  let cost = 0;
  let crossHires = 0;
  // The rider: a desk with the inputs, the show-file family, an approved PA — or cross-hire them.
  const spec = gig.techSpec;
  if (spec) {
    const breaches: ('inputs' | 'showfile' | 'pa')[] = [];
    if (ops.inputs < spec.inputs) breaches.push('inputs');
    if (spec.consoleFamily && ops.desk !== spec.consoleFamily) breaches.push('showfile');
    if (spec.paBrands?.length && !ops.pa.some(b => spec.paBrands!.includes(b))) breaches.push('pa');
    // One desk fixes both desk problems.
    const deskFix = breaches.includes('showfile') ? 'showfile' : breaches.includes('inputs') ? 'inputs' : undefined;
    for (const b of [deskFix, breaches.includes('pa') ? 'pa' : undefined]) {
      if (!b) continue;
      const opt = crossHireOptions(spec, b as 'inputs' | 'showfile' | 'pa', year)[0];
      if (!opt) return { ok: false, reason: 'rider', cost: 0, crossHires: 0, fixes: 0 };
      cost += crossHireCost(opt.id, b === 'pa' ? Math.max(1, gig.needs.audio) : 1, gig.days ?? 1);
      crossHires += 1;
    }
  }
  if (cost > gig.fee * RIVAL_FIX_LIMIT) return { ok: false, reason: 'rider', cost, crossHires, fixes: 0 };
  // The room: the rig they'd bring, in the truck they'd send.
  const truck = gig.tier >= 4 ? 'artic-40' : gig.tier === 3 ? 'rigid-7t' : 'luton-box';
  const problems = productionProblems(world, gig, typicalKit(gig, year), [{ modelId: truck }]);
  const fixCost = problems.reduce((n, p) => n + p.fixCost, 0);
  if (cost + fixCost > gig.fee * RIVAL_FIX_LIMIT) return { ok: false, reason: 'room', cost: cost + fixCost, crossHires, fixes: problems.length };
  return { ok: true, cost: cost + fixCost, crossHires, fixes: problems.length };
}

/** Note a rival passing on a show, for the reports and its own reinvestment. */
export function recordDecline(s: TycoonState, r: Rival, reason: DeclineReason) {
  const rec = opsOf(s, r).record;
  rec.declined[reason] = (rec.declined[reason] ?? 0) + 1;
}

/** Quote and, if it stands up, commit: the rival pays its fixes and holds the date. */
export function rivalTryTake(s: TycoonState, world: WorldMap, r: Rival, gig: Gig): boolean {
  const q = rivalQuote(s, world, r, gig);
  if (!q.ok) {
    recordDecline(s, r, q.reason!);
    return false;
  }
  const ops = opsOf(s, r);
  ops.cash -= q.cost;
  ops.month.costs += q.cost;
  ops.record.crossHires += q.crossHires;
  ops.record.fixes += q.fixes;
  return true;
}

/** Which of these rivals could take the show (for tenders and festival stages). */
export const ableRivals = (s: TycoonState, world: WorldMap, rivals: Rival[], gig: Gig) => rivals.filter(r => rivalQuote(s, world, r, gig).ok);

/** The night, for a rival: judged on its kit and its condition. Returns the quality. */
export function playRivalShow(s: TycoonState, r: Rival, gig: Gig, rng: Rng): number {
  const ops = opsOf(s, r);
  const year = dateOfDay(s, gig.day).getUTCFullYear();
  const kit = Math.min(1.05, ops.quality / expectedQuality(gig.tier, year));
  const q = Math.max(0, Math.min(1, 0.25 + 0.55 * kit + (ops.condition - 70) / 300 + (rng.next() - 0.5) * 0.16));
  const failed = q < 0.3;
  const payout = failed ? -Math.round(gig.fee * 0.3) : showPayout(gig, q);
  const cost = Math.round(gig.fee * RIVAL_SHOW_COST);
  ops.cash += payout - cost;
  ops.month.income += Math.max(0, payout);
  ops.month.costs += cost + Math.max(0, -payout);
  ops.condition = Math.max(20, ops.condition - 0.6 * (gig.days ?? 1));
  ops.record.shows += 1;
  if (failed) ops.record.failed += 1;
  const tw = [0, 1, 1.5, 2.5, 4][gig.tier] ?? 1;
  r.reputation = Math.max(5, Math.min(100, r.reputation + (failed ? -2 * tw : q >= 0.7 ? 0.3 * tw : q >= 0.5 ? 0.1 * tw : -0.5 * tw)));
  gig.result = { quality: q, payout, lateHours: 0, gearCoverage: 1, crewCoverage: 1 };
  return q;
}

/** A client pulled a rival's show: the same contract terms apply. */
export function rivalCancelled(s: TycoonState, r: Rival, gig: Gig) {
  const ops = opsOf(s, r);
  const kept = Math.round(gig.fee * Math.max(gig.terms?.deposit ?? 0, gig.terms?.cancel ?? 0));
  ops.cash += kept;
  ops.month.income += kept;
  ops.record.cancelled += 1;
}

/** Monthly: a retainer for the crew (most are freelance, paid per show), the trucks and kit upkeep. */
export const rivalOverhead = (ops: RivalOps) => ops.crew * 350 + ops.trucks * 600 + DEPTS.reduce((n, d) => n + ops.kit[d], 0) * 15;

/**
 * Monthly: overheads, the workshop, and reinvesting in whatever keeps costing them work. Returns
 * the month's profit as a share of overheads, which feeds the firm's health.
 */
export function monthlyRivalOps(s: TycoonState, r: Rival, rng: Rng): number {
  const ops = opsOf(s, r);
  const year = yearOf(s, s.hour);
  const overhead = rivalOverhead(ops);
  ops.cash -= overhead;
  ops.month.costs += overhead;
  if (ops.cash > 0) ops.condition = Math.min(100, ops.condition + 6);
  const profit = ops.month.income - ops.month.costs;
  ops.month = { income: 0, costs: 0 };
  // Reinvest when there's a cushion: in what turned work away most, else in keeping the kit current.
  if (ops.cash > overhead * 3) {
    const reasons = Object.entries(ops.record.declined).sort((a, b) => b[1] - a[1]);
    const top = reasons[0]?.[0] as DeclineReason | undefined;
    const target = expectedQuality(r.maxTier, year);
    let spend = 0;
    if (ops.quality < target - 1) {
      spend = DEPTS.reduce((n, d) => n + ops.kit[d], 0) * 900;
      ops.quality = Math.round((target - 0.3 + rng.next() * 0.6) * 10) / 10;
    } else if (top === 'rider') {
      const desk = pickDesk(year, r.maxTier, rng);
      const best = productsAvailableIn(year, 'console').filter(p => p.brand === desk?.brand).sort((a, b) => consoleInputs(b) - consoleInputs(a))[0];
      if (best) {
        ops.desk = best.brand;
        ops.inputs = Math.max(ops.inputs, consoleInputs(best));
        spend = best.price * 2;
      }
      ops.pa = [...new Set([...ops.pa, ...pickPa(year, r.maxTier, rng)])].slice(-3);
    } else if (top === 'kit') {
      DEPTS.forEach(d => (ops.kit[d] += Math.ceil(tierInfo(r.maxTier).needs[d] * 0.3)));
      spend = 25000 * r.maxTier;
    } else if (top === 'crew') {
      ops.crew += 3;
      spend = 3000;
    } else if (top === 'trucks') {
      ops.trucks += 1;
      spend = getModel(r.maxTier >= 3 ? 'artic-40' : 'rigid-7t').price;
    }
    if (spend && spend < ops.cash) {
      ops.cash -= spend;
      if (top) ops.record.declined[top] = Math.floor((ops.record.declined[top] ?? 0) / 2);
    }
  }
  return overhead ? profit / overhead : 0;
}
