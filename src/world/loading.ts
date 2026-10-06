/**
 * Gear loading and show evaluation, shared by the sim (what actually
 * happens) and the UI projection (what will happen if nothing changes) so
 * the two can never disagree.
 */
import { expectedQuality, getProduct } from './content/gear';
import { DEPTS, type DeptCounts, type Gig, type GearStock, type Rider } from './types';

export function stockSize(stock: GearStock): number {
  let n = 0;
  for (const id in stock) n += stock[id];
  return n;
}

export function deptTotals(stock: GearStock): DeptCounts {
  const out: DeptCounts = { audio: 0, console: 0, lighting: 0, video: 0, stage: 0 };
  for (const id in stock) if (stock[id] > 0) out[getProduct(id).dept] += stock[id];
  return out;
}

export function addStock(into: GearStock, from: GearStock) {
  for (const id in from) {
    if (!from[id]) continue;
    into[id] = (into[id] ?? 0) + from[id];
  }
}

/**
 * Takes up to `space` units out of `stock` towards `remaining` (per
 * department, mutated), always topping up the department that's furthest
 * short. Within a department it takes the rider's brand first, then the
 * best kit available. Mutates `stock`; returns what was picked.
 */
export function pickGear(stock: GearStock, remaining: DeptCounts, space: number, rider?: Rider): GearStock {
  const picked: GearStock = {};
  while (space > 0) {
    const options = DEPTS.filter(d => remaining[d] > 0 && Object.keys(stock).some(id => stock[id] > 0 && getProduct(id).dept === d));
    if (!options.length) break;
    const dept = options.sort((a, b) => remaining[b] - remaining[a])[0];
    const candidates = Object.keys(stock)
      .filter(id => stock[id] > 0 && getProduct(id).dept === dept)
      .sort((a, b) => {
        const pa = getProduct(a);
        const pb = getProduct(b);
        const ra = rider?.dept === dept && pa.brand === rider.brand ? 1 : 0;
        const rb = rider?.dept === dept && pb.brand === rider.brand ? 1 : 0;
        return rb - ra || pb.quality - pa.quality || a.localeCompare(b);
      });
    const id = candidates[0];
    stock[id] -= 1;
    if (!stock[id]) delete stock[id];
    picked[id] = (picked[id] ?? 0) + 1;
    remaining[dept] -= 1;
    space -= 1;
  }
  return picked;
}

export interface GearEvaluation {
  delivered: DeptCounts;
  /** Share of the rider's gear units that turned up (0-1). */
  coverage: number;
  /** Delivered kit vs this show's expectations, 0.6 (dated) to 1.08 (cutting edge). */
  quality: number;
  /** Average quality per department actually delivered. */
  avgQuality: DeptCounts;
  riderMet?: boolean;
}

export function evaluateGear(delivered: GearStock, gig: Gig, year: number): GearEvaluation {
  const totals = deptTotals(delivered);
  const qualitySum: DeptCounts = { audio: 0, console: 0, lighting: 0, video: 0, stage: 0 };
  for (const id in delivered) {
    const p = getProduct(id);
    qualitySum[p.dept] += p.quality * delivered[id];
  }
  const avgQuality: DeptCounts = { audio: 0, console: 0, lighting: 0, video: 0, stage: 0 };
  const need = DEPTS.reduce((s, d) => s + gig.needs[d], 0) || 1;
  const coverage = DEPTS.reduce((s, d) => s + Math.min(totals[d], gig.needs[d]), 0) / need;
  const expected = expectedQuality(gig.tier, year);
  let weighted = 0;
  let weight = 0;
  DEPTS.forEach(d => {
    if (!totals[d]) return;
    avgQuality[d] = qualitySum[d] / totals[d];
    if (!gig.needs[d]) return;
    const factor = Math.max(0.6, Math.min(1.08, avgQuality[d] / expected));
    weighted += factor * gig.needs[d];
    weight += gig.needs[d];
  });

  let riderMet: boolean | undefined;
  if (gig.rider) {
    const inDept = totals[gig.rider.dept];
    let branded = 0;
    for (const id in delivered) {
      const p = getProduct(id);
      if (p.dept === gig.rider.dept && p.brand === gig.rider.brand) branded += delivered[id];
    }
    riderMet = inDept > 0 && branded * 2 >= inDept;
  }
  return { delivered: totals, coverage, quality: weight ? weighted / weight : 1, avgQuality, riderMet };
}

export const RIDER_BONUS = 0.05;
export const RIDER_PENALTY = 0.07;

/** Show quality (0-1) before the small random swing on the night. */
export function baseShowQuality(opts: {
  gearCoverage: number;
  crewCoverage: number;
  lateHours: number;
  gearQuality: number;
  riderMet?: boolean;
}): number {
  const punctuality = opts.lateHours <= 0 ? 1 : Math.max(0.35, 1 - opts.lateHours / 12);
  const rider = opts.riderMet === undefined ? 0 : opts.riderMet ? RIDER_BONUS : -RIDER_PENALTY;
  const q = (opts.gearCoverage * 0.65 + opts.crewCoverage * 0.35) * punctuality * Math.min(1.04, opts.gearQuality) + rider;
  return Math.max(0, Math.min(1, q));
}
