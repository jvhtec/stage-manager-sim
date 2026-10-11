/**
 * Shocks: the bad years a production company has to live through. The biggest client walks to a
 * rival; the maker recalls the model most of the fleet is built on; the economy turns and work
 * and fees dry up; promoters start sitting on invoices. History (content/economy.ts) brings the
 * real downturns on schedule — these are the ones a scenario or a stress test throws at you
 * (__bench__/adverse.bench.ts), and they run through the same systems as everything else: the
 * market, the invoice book, the fleet and the client list.
 */
import { getModel } from './catalog';
import { book, dayOf, formatDay, formatMoney, pushNews } from './core';
import { logIncident } from './consequences';
import { ACT_BAN_DAYS } from './blacklist';
import { cancelByClient } from './terms';
import { COVERED_RECALL_DAYS, grounded, topClient } from './risk';

export { topClient };
import type { Shock, TycoonState } from './types';
import { shockFactors } from './market';

export { shockFactors };
export type { Shock };

export type ShockKind = Shock['kind'];

export const DOWNTURN = { months: 18, demand: 0.7, fees: 0.85 };
export const LATE_WAVE = { months: 12, late: 3 };
export const RECALL_DAYS = 12;

/** The biggest client takes its work to a rival: everything booked is cancelled (on its contract terms) and it won't call for two years. */
export function loseClient(s: TycoonState, act: string): number {
  const today = dayOf(s.hour);
  const until = today + ACT_BAN_DAYS;
  s.blacklist = { ...(s.blacklist ?? {}), [`act:${act}`]: until };
  const booked = s.gigs.filter(g => g.status === 'booked' && g.act === act && g.day > today && !g.result);
  const fees = booked.reduce((n, g) => n + g.fee, 0);
  booked.forEach(g => cancelByClient(s, g));
  logIncident(s, {
    kind: 'client',
    title: `${act} moved to a rival`,
    causes: [{ id: 'lost-client', label: 'Your biggest client walked', detail: `${act} signed with someone else, taking ${booked.length} booked show${booked.length === 1 ? '' : 's'} with them.`, weight: 1 }],
    outcome: `No work from them until ${formatDay(s, until)}.`,
  });
  pushNews(s, `${act} — your biggest client — have signed with a rival. ${booked.length} booked show${booked.length === 1 ? '' : 's'} worth ${formatMoney(s, fees)} go with them.`, 'bad');
  return booked.length;
}

/**
 * The maker recalls a model: every truck of the type most of your fleet runs on finishes the trip
 * it's on and then sits at the dealer until the fix is done. Shows booked onto them need another
 * truck. The parts are free; the downtime and a courtesy-vehicle charge are yours.
 */
export function recallFleet(s: TycoonState, days = RECALL_DAYS, only?: string): { modelId: string; vehicles: number } | undefined {
  const mine = s.vehicles.filter(v => v.owner === 'player' && getModel(v.modelId).kind !== 'bus');
  const counts: Record<string, number> = {};
  mine.forEach(v => (counts[v.modelId] = (counts[v.modelId] ?? 0) + 1));
  const modelId = only ?? Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (!modelId || !counts[modelId]) return undefined;
  // A fleet service contract turns a recall round in days (risk.ts).
  if (s.policies.fleetCover === 'priority') days = Math.min(days, COVERED_RECALL_DAYS);
  const hit = mine.filter(v => v.modelId === modelId);
  const until = s.hour + days * 24;
  hit.forEach(v => (v.recalledUntil = until));
  const model = getModel(modelId);
  book(s, 'servicing', -Math.round(hit.length * model.price * 0.01));
  logIncident(s, {
    kind: 'breakdown',
    title: `${model.name} recall`,
    causes: [{ id: 'recall', label: 'Manufacturer recall', detail: `${hit.length} of your ${model.name}s are off the road for ${days} days.`, weight: 1 }],
    outcome: `Back on ${formatDay(s, dayOf(until))}.`,
  });
  const standby = s.policies.standby === 'on';
  pushNews(s, `${model.name} recall: ${hit.length} of your trucks must go back to the dealer after their current trip, for ${days} days. ${standby ? 'Your standby hire covers them with stand-in trucks.' : 'Re-plan the shows booked on them.'}`, 'bad');
  return { modelId, vehicles: hit.length };
}

/** A truck the maker has called in can't set off on a new job — unless standby hire sends a stand-in (risk.ts). */
export const recalled = (s: Pick<TycoonState, 'hour' | 'policies'>, v: { recalledUntil?: number }) => grounded(s, v);

export function startShock(s: TycoonState, kind: 'downturn' | 'late-payers'): Shock {
  const today = dayOf(s.hour);
  const shock: Shock =
    kind === 'downturn'
      ? { kind, fromDay: today, toDay: today + DOWNTURN.months * 30, demand: DOWNTURN.demand, fees: DOWNTURN.fees }
      : { kind, fromDay: today, toDay: today + LATE_WAVE.months * 30, late: LATE_WAVE.late };
  s.shocks = [...(s.shocks ?? []), shock];
  pushNews(
    s,
    kind === 'downturn'
      ? `The economy has turned: promoters are cutting back. Expect about ${Math.round((1 - DOWNTURN.demand) * 100)}% less work, at fees ${Math.round((1 - DOWNTURN.fees) * 100)}% lower, for the next year and a half.`
      : `Promoters are sitting on their invoices: late payment is three times as common, and late means later, for the next year.`,
    'big',
  );
  return shock;
}

/** Throws a shock at the company now. Returns what happened, for logs and reports. */
export function applyShock(s: TycoonState, kind: ShockKind): string {
  if (kind === 'lose-client') {
    const top = topClient(s);
    if (!top) return 'no client to lose';
    const n = loseClient(s, top.act);
    return `lost ${top.act} (${Math.round(top.share * 100)}% of the year's work, ${n} booked shows)`;
  }
  if (kind === 'recall') {
    const r = recallFleet(s);
    return r ? `recalled ${r.vehicles} × ${getModel(r.modelId).name}` : 'no fleet to recall';
  }
  startShock(s, kind);
  return kind;
}
