/**
 * The industry moves around you. Each month: a maker may recall a truck model (likelier the more of
 * that model is on the road — a big single-model fleet is a big target); a big client may put its
 * work out to tender and take it elsewhere (only accounts large enough to be reviewed, likelier the
 * more of your work they are); a regional promoter may go under, taking its unpaid invoices and its
 * booked arena dates with it (it can happen anywhere; what it costs you depends on how much of your
 * work is in that area and whether your invoices are insured); and now and then the whole business
 * starts paying late. Rivals live through the same recalls and collapses. risk.ts measures the
 * exposure and holds the tools.
 */
import type { Rng } from '@/lib/rng';
import { getModel } from './catalog';
import { book, dayOf, formatMoney, pushNews } from './core';
import { logIncident } from './consequences';
import { worldOf } from './mapgen';
import { roadDistance } from './pathfinding';
import { difficultyOf } from './scenario';
import { FRAMEWORK_HOLD, AREA_RADIUS, fleetExposure, topClient, underFramework } from './risk';
import { RECALL_DAYS, loseClient, recallFleet, startShock } from './shocks';
import { clientFees } from './reputation';
import type { TycoonState } from './types';

/** Monthly chance of a recall, per truck of the model on the road (only fleets of three or more of a model are worth a maker's notice). */
export const RECALL_PER_TRUCK = 0.0012;
export const RECALL_MIN_TRUCKS = 3;
/** Monthly chance a big account walks, per point of share above the floor; and the account size that gets reviewed at all. */
export const CLIENT_WALK = 0.012;
export const CLIENT_WALK_FLOOR = 0.15;
export const TENDER_THRESHOLD = 100_000;
/** Monthly chance a regional promoter somewhere goes under. */
export const PROMOTER_COLLAPSE = 0.006;
/** Only promoters of the bigger rooms (arena and up) have dates worth cancelling. */
export const COLLAPSE_MIN_TIER = 3;
export const COLLAPSE_AHEAD_DAYS = 60;
/** Monthly chance of an industry-wide late-payment wave. */
export const LATE_WAVE_CHANCE = 0.003;
/** A rival's recall grounds this share of its trucks for the same time. */
export const RIVAL_RECALL_SHARE = 0.4;

export interface IndustryTally {
  recalls: number;
  trucksRecalled: number;
  clientWalks: number;
  collapses: number;
  /** Invoices lost to collapses, uninsured. */
  lostInvoices: number;
  /** Booked fees lost to collapses. */
  lostBookings: number;
  waves: number;
}

const tally = (s: TycoonState): IndustryTally => (s.stats.industry ??= { recalls: 0, trucksRecalled: 0, clientWalks: 0, collapses: 0, lostInvoices: 0, lostBookings: 0, waves: 0 });

/** Monthly: roll the industry's events. */
export function monthlyIndustry(s: TycoonState, rng: Rng) {
  const crises = difficultyOf(s).crises;
  recalls(s, rng, crises);
  clientReview(s, rng, crises);
  if (rng.chance(PROMOTER_COLLAPSE * crises)) promoterCollapse(s, rng);
  if (rng.chance(LATE_WAVE_CHANCE * crises) && !(s.shocks ?? []).some(x => x.kind === 'late-payers' && x.toDay > dayOf(s.hour))) {
    startShock(s, 'late-payers');
    tally(s).waves++;
  }
}

function recalls(s: TycoonState, rng: Rng, crises: number) {
  const counts: Record<string, number> = {};
  s.vehicles.forEach(v => {
    if (v.owner === 'player' && getModel(v.modelId).kind !== 'bus') counts[v.modelId] = (counts[v.modelId] ?? 0) + 1;
  });
  Object.entries(counts).forEach(([modelId, n]) => {
    if (n < RECALL_MIN_TRUCKS || !rng.chance(RECALL_PER_TRUCK * n * crises)) return;
    const r = recallFleet(s, RECALL_DAYS, modelId);
    if (!r) return;
    tally(s).recalls++;
    tally(s).trucksRecalled += r.vehicles;
  });
  // Rivals' fleets are recalled too: a bigger fleet, a bigger target.
  const today = dayOf(s.hour);
  s.rivals.forEach(r => {
    const ops = r.ops;
    if (!ops || ops.trucks < RECALL_MIN_TRUCKS || (ops.down?.until ?? -1) > today) return;
    if (!rng.chance(RECALL_PER_TRUCK * ops.trucks * 0.5 * crises)) return;
    ops.down = { until: today + RECALL_DAYS, trucks: Math.max(1, Math.round(ops.trucks * RIVAL_RECALL_SHARE)) };
  });
}

/** A big account goes out to tender — and goes elsewhere. */
function clientReview(s: TycoonState, rng: Rng, crises: number) {
  const top = topClient(s);
  if (!top) return;
  if ((clientFees(s)[top.act] ?? 0) < TENDER_THRESHOLD) return;
  const over = Math.max(0, top.share - CLIENT_WALK_FLOOR) / CLIENT_WALK_FLOOR;
  if (!over) return;
  const hold = underFramework(s, top.act) ? FRAMEWORK_HOLD : 1;
  if (!rng.chance(CLIENT_WALK * over * hold * crises)) return;
  loseClient(s, top.act);
  tally(s).clientWalks++;
}

/** A regional promoter goes under: unpaid invoices in its patch are lost (unless insured), and its arena dates are off. */
export function promoterCollapse(s: TycoonState, rng: Rng, at?: string): { cityId: string; lostInvoices: number; lostBookings: number } | undefined {
  const world = worldOf(s);
  // Where: weighted by how much work the whole market does there.
  const towns = Object.entries(s.townShows ?? {}).map(([c, t]) => ({ c, w: Object.values(t).reduce((a, b) => a + b, 0) })).filter(x => x.w > 0);
  let cityId = at;
  if (!cityId) {
    const total = towns.reduce((a, x) => a + x.w, 0);
    if (!total) return undefined;
    let roll = rng.next() * total;
    cityId = towns.find(x => (roll -= x.w) <= 0)?.c ?? towns[towns.length - 1].c;
  }
  const inArea = (c?: string) => !!c && (c === cityId || roadDistance(world, cityId!, c) <= AREA_RADIUS);
  const today = dayOf(s.hour);
  // Your invoices there.
  let lostInvoices = 0;
  let covered = 0;
  s.receivables = s.receivables.filter(inv => {
    if (!inArea(inv.cityId)) return true;
    if (inv.insured) {
      covered += inv.amount;
      book(s, 'shows', inv.amount);
    } else lostInvoices += inv.amount;
    return false;
  });
  // Your booked dates in the bigger rooms there.
  let lostBookings = 0;
  s.gigs.forEach(g => {
    if (g.status !== 'booked' || g.result || g.tier < COLLAPSE_MIN_TIER || !inArea(g.cityId) || g.day <= today || g.day > today + COLLAPSE_AHEAD_DAYS) return;
    lostBookings += g.fee;
    g.status = 'expired';
    g.cancelled = true;
  });
  // Rivals lose the same.
  s.gigs.forEach(g => {
    if (g.status === 'rival' && !g.result && g.tier >= COLLAPSE_MIN_TIER && inArea(g.cityId) && g.day > today && g.day <= today + COLLAPSE_AHEAD_DAYS) {
      g.status = 'expired';
      g.cancelled = true;
    }
  });
  s.rivals.forEach(r => {
    if (r.ops?.owed) r.ops.owed = r.ops.owed.filter(o => !inArea(o.cityId));
  });
  const name = world.cityById.get(cityId)?.name ?? 'the region';
  const t = tally(s);
  t.collapses++;
  t.lostInvoices += lostInvoices;
  t.lostBookings += lostBookings;
  if (lostInvoices || lostBookings || covered) {
    logIncident(s, {
      kind: 'client',
      title: `A promoter around ${name} went under`,
      causes: [
        { id: 'promoter-collapse', label: 'Regional promoter collapsed', detail: `Its unpaid invoices and its arena dates around ${name} went with it.`, weight: 1 },
        ...(lostInvoices ? [{ id: 'uninsured', label: 'Invoices not insured', detail: `${formatMoney(s, lostInvoices)} owed to you there was not covered.`, weight: 0.6 }] : []),
      ],
      outcome: `Lost ${formatMoney(s, lostInvoices)} in invoices and ${formatMoney(s, lostBookings)} in booked dates${covered ? `; credit insurance paid ${formatMoney(s, covered)}` : ''}.`,
    });
  }
  pushNews(
    s,
    `A big promoter around ${name} has gone into administration.${lostInvoices || lostBookings ? ` You lose ${formatMoney(s, lostInvoices)} in unpaid invoices and ${formatMoney(s, lostBookings)} of booked dates.` : ' You had nothing riding on them.'}${covered ? ` Credit insurance covers ${formatMoney(s, covered)}.` : ''}`,
    lostInvoices || lostBookings ? 'bad' : 'info',
    { cityId },
  );
  return { cityId, lostInvoices, lostBookings };
}

/** Trucks a rival has on the road today (a recall takes some off). */
export const rivalTrucksToday = (s: Pick<TycoonState, 'hour'>, ops: { trucks: number; down?: { until: number; trucks: number } }) =>
  (ops.down?.until ?? -1) > dayOf(s.hour) ? Math.max(0, ops.trucks - ops.down!.trucks) : ops.trucks;

export const describeRecallOdds = (n: number, crises = 1) => (n < RECALL_MIN_TRUCKS ? 0 : 1 - (1 - RECALL_PER_TRUCK * n * crises) ** 12);
export { fleetExposure };
