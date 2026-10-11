/**
 * Concentration risk. A small company's eggs are in few baskets by necessity and it barely
 * notices; a big one has built its business on them. Run twenty trucks of one model and a recall
 * grounds the company; earn a third of your money from one act and their next supplier review is
 * your problem; work one region and its promoter going bust takes your invoices with it. This
 * measures the exposure; industry.ts rolls the events against it; the tools to manage it are a mixed
 * fleet, a fleet service contract and standby hire, framework agreements with big clients, credit
 * insurance on invoices, and bases in more than one region.
 */
import { getModel } from './catalog';
import { book, dayOf, formatMoney, pushNews } from './core';
import { roadDistance } from './pathfinding';
import { clientFees } from './reputation';
import type { TycoonState, Vehicle, WorldMap } from './types';

/** Towns within this many tiles of each other count as one area (one regional promoter's patch). */
export const AREA_RADIUS = 15;

/** When each exposure starts to count as concentrated. */
export const CONCENTRATED = { fleetShare: 0.5, fleetCount: 6, clientShare: 0.25, areaShare: 0.5, debtorShare: 0.3 };

export interface Exposure {
  /** The most common truck model: how many, and what share of the fleet. */
  fleet: { modelId?: string; count: number; share: number; size: number };
  /** The biggest client's share of this year's and last year's fees (and what's booked). */
  client: { act?: string; share: number };
  /** The busiest area's share of your recent shows, and the town at its middle. */
  area: { cityId?: string; share: number };
  /** The biggest debtor's share of what you're owed, and how much of what you're owed is uninsured. */
  debtor: { act?: string; amount: number; share: number; owed: number; uninsured: number };
}

const trucks = (s: Pick<TycoonState, 'vehicles'>) => s.vehicles.filter(v => v.owner === 'player' && getModel(v.modelId).kind !== 'bus');

export function fleetExposure(s: Pick<TycoonState, 'vehicles'>): Exposure['fleet'] {
  const mine = trucks(s);
  const counts: Record<string, number> = {};
  mine.forEach(v => (counts[v.modelId] = (counts[v.modelId] ?? 0) + 1));
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return { modelId: top?.[0], count: top?.[1] ?? 0, share: mine.length ? (top?.[1] ?? 0) / mine.length : 0, size: mine.length };
}

/** The client that brought in the most money this year and last, counting what's booked ahead. */
export function topClient(s: TycoonState): { act: string; share: number } | undefined {
  const today = dayOf(s.hour);
  const by = clientFees(s);
  s.gigs.forEach(g => {
    if (g.status === 'booked' && g.day >= today) by[g.act] = (by[g.act] ?? 0) + g.fee;
  });
  const total = Object.values(by).reduce((a, b) => a + b, 0);
  const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
  return top ? { act: top[0], share: total ? top[1] / total : 0 } : undefined;
}

/** Your recent shows within reach of a town. */
export function areaShows(s: Pick<TycoonState, 'townShows'>, world: WorldMap, cityId: string): number {
  let n = 0;
  Object.entries(s.townShows ?? {}).forEach(([c, t]) => {
    if (!t.player) return;
    if (c === cityId || roadDistance(world, cityId, c) <= AREA_RADIUS) n += t.player;
  });
  return n;
}

export function areaExposure(s: Pick<TycoonState, 'townShows'>, world: WorldMap): Exposure['area'] {
  const mine = Object.entries(s.townShows ?? {}).filter(([, t]) => (t.player ?? 0) > 0);
  const total = mine.reduce((a, [, t]) => a + (t.player ?? 0), 0);
  if (!total) return { share: 0 };
  let best: Exposure['area'] = { share: 0 };
  mine.forEach(([c]) => {
    const share = areaShows(s, world, c) / total;
    if (share > best.share) best = { cityId: c, share };
  });
  return best;
}

export function debtorExposure(s: Pick<TycoonState, 'receivables'>): Exposure['debtor'] {
  const by: Record<string, number> = {};
  let owed = 0;
  let uninsured = 0;
  (s.receivables ?? []).forEach(i => {
    by[i.act] = (by[i.act] ?? 0) + i.amount;
    owed += i.amount;
    if (!i.insured) uninsured += i.amount;
  });
  const top = Object.entries(by).sort((a, b) => b[1] - a[1])[0];
  return { act: top?.[0], amount: top?.[1] ?? 0, share: owed ? (top?.[1] ?? 0) / owed : 0, owed, uninsured };
}

export function exposureOf(s: TycoonState, world: WorldMap): Exposure {
  const top = topClient(s);
  return { fleet: fleetExposure(s), client: { act: top?.act, share: top?.share ?? 0 }, area: areaExposure(s, world), debtor: debtorExposure(s) };
}

// ---------------------------------------------------------------------------
// The tools
// ---------------------------------------------------------------------------

/** Fleet service contract: a monthly fee per truck (share of its price); recalls are turned round in days, not weeks. */
export const FLEET_COVER_RATE = 0.002;
export const COVERED_RECALL_DAYS = 3;
export const fleetCoverMonthly = (s: Pick<TycoonState, 'vehicles'>) => Math.round(trucks(s).reduce((n, v) => n + getModel(v.modelId).price * FLEET_COVER_RATE, 0));

/** Standby hire: a retainer per truck with a hire company, and a day rate for each stand-in truck when one of yours is grounded. */
export const STANDBY_RETAINER = 90;
export const STANDBY_DAY_RATE = 260;
export const standbyMonthly = (s: Pick<TycoonState, 'vehicles'>) => trucks(s).length * STANDBY_RETAINER;

/** Grounded by a recall, with nothing standing in. */
export const grounded = (s: Pick<TycoonState, 'hour' | 'policies'>, v: Pick<Vehicle, 'recalledUntil'>) => (v.recalledUntil ?? 0) > s.hour && s.policies.standby !== 'on';

/** Monthly: what the fleet cover and the standby retainer cost. */
export function monthlyRiskCover(s: TycoonState) {
  if (s.policies.fleetCover === 'priority') book(s, 'servicing', -fleetCoverMonthly(s));
  if (s.policies.standby === 'on') book(s, 'leasing', -standbyMonthly(s));
}

/** Daily: stand-in trucks for any of yours that are recalled. */
export function dailyStandby(s: TycoonState) {
  if (s.policies.standby !== 'on') return;
  const out = s.vehicles.filter(v => v.owner === 'player' && (v.recalledUntil ?? 0) > s.hour).length;
  if (out) book(s, 'leasing', -out * STANDBY_DAY_RATE);
}

/** Framework agreements: a client commits its work to you for two years at a small discount, and won't walk mid-term. */
export const FRAMEWORK_DAYS = 730;
export const FRAMEWORK_DISCOUNT = 0.05;
/** How much less likely a client under a framework is to take its work elsewhere. */
export const FRAMEWORK_HOLD = 0.2;
/** A client has to be worth this share of your work to bother with a framework. */
export const FRAMEWORK_MIN_SHARE = 0.1;

export const underFramework = (s: Pick<TycoonState, 'frameworks' | 'hour'>, act: string) => (s.frameworks?.[act] ?? -1) > dayOf(s.hour);

export function frameworkBlocker(s: TycoonState, act: string): string | null {
  if (underFramework(s, act)) return `${act} is already under a framework agreement.`;
  const fees = clientFees(s);
  const total = Object.values(fees).reduce((a, b) => a + b, 0);
  if (!total || (fees[act] ?? 0) / total < FRAMEWORK_MIN_SHARE) return `${act} isn't a big enough client yet for a framework agreement.`;
  return null;
}

export function signFramework(s: TycoonState, act: string): boolean {
  if (frameworkBlocker(s, act)) return false;
  s.frameworks = { ...(s.frameworks ?? {}), [act]: dayOf(s.hour) + FRAMEWORK_DAYS };
  pushNews(s, `Framework agreement with ${act}: their work is yours for two years, at ${Math.round(FRAMEWORK_DISCOUNT * 100)}% off the fees.`, 'good');
  return true;
}

/** The fee discount a framework client gets. */
export const frameworkFeeFactor = (s: Pick<TycoonState, 'frameworks' | 'hour'>, act: string) => (underFramework(s, act) ? 1 - FRAMEWORK_DISCOUNT : 1);

export const describeExposure = (s: TycoonState, e: Exposure) => ({
  fleet: e.fleet.modelId ? `${e.fleet.count} of ${e.fleet.size} trucks are ${getModel(e.fleet.modelId).name}s` : 'no trucks',
  client: e.client.act ? `${e.client.act}: ${Math.round(e.client.share * 100)}% of your work` : 'no clients yet',
  debtor: e.debtor.owed ? `${formatMoney(s, e.debtor.owed)} owed, ${formatMoney(s, e.debtor.uninsured)} uninsured` : 'nothing owed',
});
