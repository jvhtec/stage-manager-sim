/**
 * Who supplies what. A rival owns only the departments its business lines run (a staging firm has
 * no PA; a sound house in 1990 may own no lighting). It can still take a show as prime contractor
 * if it owns the show's main department: the rest it subcontracts — first to a partner firm it
 * trusts, then on the open hire market — as Fluge did with outside lighting firms in 1990 before it
 * brought lighting in-house.
 *
 * Partners are paid when the job is taken and their kit is held for the dates; repeated work
 * builds trust, which makes the next job smoother. Departments a firm keeps subcontracting are
 * what it considers bringing in-house when it reinvests (rivalOps.ts).
 */
import { getProduct } from './content/gear';
import { actorById, deptsOfLines, eraIn } from './content/actors';
import { rentalProduct, SUBHIRE_DAY_RATE } from './hire';
import { roadDistance } from './pathfinding';
import { HISTORY } from './historyFlags';
import { pickWeighted } from './strategies';
import { createRng } from '@/lib/rng';

const hash = (str: string) => [...str].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 59);
/** The same show always draws the same partner (quotes are asked more than once). */
const showRng = (key: string) => createRng(hash(key));
import { DEPTS, type Dept, type Gig, type Rival, type RivalOps, type TycoonState, type WorldMap } from './types';

/** Most of a show's fee a prime contractor will hand to other firms for departments it lacks. */
export const SUBCONTRACT_LIMIT = 0.35;
/**
 * Firms hire to each other at trade rates, below what a one-off sub-hire costs you (hire.ts
 * SUBHIRE_DAY_RATE): a partner it works with regularly at half, the open trade market at three-quarters.
 */
export const PARTNER_RATE = 0.5;
export const MARKET_RATE = 0.75;
/** How far a partner will deliver (game distance units). */
export const PARTNER_REACH = 40;
export const TRUST_MAX = 10;

/** The departments a firm runs: its kit if it has an operation yet, else its business lines. */
export function deptsOf(r: Pick<Rival, 'id' | 'specialty' | 'ops'>, year: number): Dept[] {
  if (!HISTORY.specialization) return DEPTS;
  if (r.ops) return DEPTS.filter(d => r.ops!.kit[d] > 0);
  const a = actorById(r.id);
  if (a) return deptsOfLines(eraIn(a, year).lines);
  return r.specialty === 'audio' || r.specialty === 'console' ? ['audio', 'console'] : [r.specialty];
}

/** The department that defines the show — the one with the most kit (desks count as sound). */
export function mainDept(gig: Pick<Gig, 'needs'>): Dept {
  return DEPTS.filter(d => d !== 'console').reduce((a, b) => (gig.needs[b] > gig.needs[a] ? b : a));
}

/** Can it take this show as prime contractor? It must run the main department itself. */
export const canPrime = (r: Pick<Rival, 'id' | 'specialty' | 'ops'>, gig: Pick<Gig, 'needs'>, year: number) =>
  deptsOf(r, year).includes(mainDept(gig));

const overlaps = (a: Pick<Gig, 'day' | 'days'>, b: Pick<Gig, 'day' | 'days'>) => a.day <= b.day + (b.days ?? 1) - 1 && b.day <= a.day + (a.days ?? 1) - 1;

/** Units of a department a firm has out on other shows over these dates — as prime or as partner. */
export function heldUnits(s: Pick<TycoonState, 'gigs'>, rivalId: string, d: Dept, gig: Pick<Gig, 'id' | 'day' | 'days'>): number {
  let n = 0;
  for (const g of s.gigs) {
    if (g.status !== 'rival' || g.result || g.id === gig.id || !overlaps(g, gig)) continue;
    if (g.rivalId === rivalId) n += g.needs[d] - (g.supply ?? []).filter(x => x.dept === d).reduce((m, x) => m + x.units, 0);
    (g.supply ?? []).forEach(x => x.from === rivalId && x.dept === d && (n += x.units));
  }
  return Math.max(0, n);
}

export interface SupplyPlan {
  lines: { dept: Dept; units: number; from?: string }[];
  /** What the prime pays out in total. */
  cost: number;
  /** What each partner receives. */
  paid: Record<string, number>;
}

const unitCost = (d: Dept, gig: Gig, year: number) => {
  const id = rentalProduct(d, gig.tier, year);
  return id ? getProduct(id).price * SUBHIRE_DAY_RATE * (gig.days ?? 1) : 0;
};

/** How the prime would cover the departments (or the units) it can't supply itself. */
export function planSupply(s: TycoonState, world: WorldMap, r: Rival, ops: RivalOps, gig: Gig, year: number): SupplyPlan {
  const plan: SupplyPlan = { lines: [], cost: 0, paid: {} };
  DEPTS.forEach(d => {
    const need = gig.needs[d];
    if (!need) return;
    const own = Math.max(0, ops.kit[d] - heldUnits(s, r.id, d, gig));
    const short = need - Math.min(need, own);
    if (short <= 0) return;
    const rate = unitCost(d, gig, year);
    // Partners that can spare the kit: the ones it trusts and the nearest are likelier, but work is
    // spread — firms don't hand every job to one supplier. (Deterministic per show.)
    const candidates = !HISTORY.partners ? [] : s.rivals
      .filter(p => p.id !== r.id && p.ops && p.ops.kit[d] - heldUnits(s, p.id, d, gig) >= short)
      .map(p => ({ p, dist: roadDistance(world, p.hqCityId, gig.cityId), trust: ops.partners?.[p.id] ?? 0 }))
      .filter(x => Number.isFinite(x.dist) && x.dist <= PARTNER_REACH)
      .sort((a, b) => a.p.id.localeCompare(b.p.id));
    const partner = pickWeighted(showRng(gig.id + d), candidates, x => (1 + x.trust / 2) / (1 + x.dist / 10));
    if (partner) {
      const pay = Math.round(short * rate * PARTNER_RATE);
      plan.lines.push({ dept: d, units: short, from: partner.p.id });
      plan.paid[partner.p.id] = (plan.paid[partner.p.id] ?? 0) + pay;
      plan.cost += pay;
    } else {
      plan.lines.push({ dept: d, units: short });
      plan.cost += Math.round(short * rate * MARKET_RATE);
    }
  });
  return plan;
}

/** Commit the plan: partners are paid and their kit is held; trust grows with each job together. */
export function commitSupply(s: TycoonState, r: Rival, ops: RivalOps, gig: Gig, plan: SupplyPlan) {
  if (!plan.lines.length) return;
  gig.supply = plan.lines;
  ops.record.subcontracted = (ops.record.subcontracted ?? 0) + 1;
  plan.lines.forEach(x => (ops.short ??= {})[x.dept] = (ops.short?.[x.dept] ?? 0) + x.units);
  Object.entries(plan.paid).forEach(([id, pay]) => {
    const p = s.rivals.find(x => x.id === id)?.ops;
    if (!p) return;
    p.cash += pay;
    p.month.income += pay;
    p.record.partnered = (p.record.partnered ?? 0) + 1;
    (ops.partners ??= {})[id] = Math.min(TRUST_MAX, (ops.partners[id] ?? 0) + 1);
  });
}

/**
 * What subcontracting does on the night: other firms' kit and crews need coordinating — less so
 * with a partner it knows well — and hire-market kit is a notch below what was asked for.
 */
export function supplyPenalty(gig: Gig, ops: RivalOps): number {
  if (!gig.supply?.length) return 0;
  const total = DEPTS.reduce((n, d) => n + gig.needs[d], 0) || 1;
  let pen = 0;
  gig.supply.forEach(x => {
    const share = x.units / total;
    const trust = x.from ? ops.partners?.[x.from] ?? 0 : 0;
    pen += share * (x.from ? 0.05 * (1 - trust / (TRUST_MAX + 2)) : 0.08);
  });
  return pen;
}
