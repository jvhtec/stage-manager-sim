/**
 * Scope creep. On the day, the client asks for more: an extra hour, extra kit, an earlier
 * load-in. You can do it for nothing, quote for it, or say no — and what the client does next
 * depends on who they are (some pay without a murmur, some never will) and on what you've
 * taught them before. Giving away extras buys goodwill now and makes them ask again; charging
 * for them risks a row; refusing costs the relationship. Crew overtime and morale ride along.
 */
import type { Rng } from '@/lib/rng';
import { book, formatMoney, pushNews } from './core';
import { FREELANCE_DAY_RATE } from './crew';
import { aboard } from './people';
import type { Dilemma, Gig, TycoonState } from './types';

export type ClientTemper = 'easy' | 'fair' | 'pushy';
export type ChangeKind = 'hour' | 'kit' | 'early';

export interface ClientMemory {
  paid: number;
  absorbed: number;
  refused: number;
  declined: number;
}

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 17);

/** Who the client really is — hidden from you until you've worked with them. */
export function clientTemper(act: string): ClientTemper {
  const n = hash(act) % 20;
  return n < 7 ? 'easy' : n < 15 ? 'fair' : 'pushy';
}

export const TEMPER_LABEL: Record<ClientTemper, string> = { easy: 'easy-going', fair: 'reasonable', pushy: 'always pushing for more' };

export const memoryOf = (s: Pick<TycoonState, 'clients'>, act: string): ClientMemory => s.clients?.[act] ?? { paid: 0, absorbed: 0, refused: 0, declined: 0 };
const remember = (s: TycoonState, act: string, k: keyof ClientMemory) => {
  const m = { ...memoryOf(s, act) };
  m[k] += 1;
  s.clients = { ...(s.clients ?? {}), [act]: m };
};

/** What you can tell about a client from the history you have with them. */
export function clientNote(s: Pick<TycoonState, 'clients'>, act: string): string {
  const m = memoryOf(s, act);
  const n = m.paid + m.absorbed + m.refused + m.declined;
  if (!n) return 'No history with them yet.';
  const bits: string[] = [];
  if (m.absorbed) bits.push(`${m.absorbed} extra${m.absorbed > 1 ? 's' : ''} done for free`);
  if (m.paid) bits.push(`${m.paid} paid for`);
  if (m.refused) bits.push(`${m.refused} time${m.refused > 1 ? 's' : ''} refused to pay`);
  if (m.declined) bits.push(`${m.declined} turned down`);
  return `${bits.join(', ')}: they look ${TEMPER_LABEL[clientTemper(act)]}.`;
}

/** Chance a booked show gets a change request at load-in. */
export function changeChance(s: TycoonState, gig: Gig): number {
  const temper = { easy: 0.5, fair: 1, pushy: 2 }[clientTemper(gig.act)];
  const m = memoryOf(s, gig.act);
  return Math.min(0.5, (0.04 + 0.02 * gig.tier) * temper * (1 + 0.3 * m.absorbed));
}

/** Chance the client agrees to pay for an extra. */
export function payChance(s: TycoonState, gig: Gig): number {
  const m = memoryOf(s, gig.act);
  const base = { easy: 0.9, fair: 0.65, pushy: 0.3 }[clientTemper(gig.act)];
  return Math.max(0.1, Math.min(0.95, base - 0.1 * m.refused + 0.05 * m.paid + 0.03 * Math.min(5, s.artistRelations[gig.act] ?? 0)));
}

const EXTRA_SHARE: Record<ChangeKind, number> = { hour: 0.1, kit: 0.08, early: 0.06 };

const overtimeCost = (gig: Gig) => Math.round(gig.crewNeeded * FREELANCE_DAY_RATE * 0.35);
const kitCost = (gig: Gig) => Math.round(gig.fee * 0.06);

export function makeChange(s: TycoonState, gig: Gig, rng: Rng): Omit<Dilemma, 'id' | 'gigId' | 'createdHour' | 'expiresHour'> {
  const kind = rng.pick<ChangeKind>(['hour', 'kit', 'early']);
  const extra = Math.round(gig.fee * EXTRA_SHARE[kind]);
  const note = clientNote(s, gig.act);
  const cost = kind === 'hour' ? overtimeCost(gig) : kind === 'kit' ? kitCost(gig) : 0;
  const text = {
    hour: `${gig.act} want to add an hour to the set. The crew will be on overtime.`,
    kit: `${gig.act}'s manager wants another set of side-fills and a second follow-spot added to the rig.`,
    early: `${gig.act} want to soundcheck three hours earlier than agreed, so the load-in has to be rushed.`,
  }[kind];
  return {
    kind: 'change',
    title: 'The client wants a change',
    text: `${text} ${note}`,
    options: [
      { id: 'absorb', label: 'Do it for nothing', detail: `${cost ? `Costs you ${formatMoney(s, cost)}. ` : ''}They’ll be pleased — and they’ll remember it was free.`, cost: cost || undefined },
      { id: 'charge', label: `Quote ${formatMoney(s, extra)} for it`, detail: 'They may pay. They may not like being asked.' },
      { id: 'decline', label: 'Stick to the contract', detail: 'Nothing changes — but you’ve said no.' },
    ],
    defaultOption: 'decline',
    payload: kind,
  };
}

/** Apply the answer. Returns a sentence for the toast. */
export function resolveChange(s: TycoonState, gig: Gig | undefined, kind: ChangeKind, option: string, rng: Rng): string {
  if (!gig) return '';
  const extra = Math.round(gig.fee * EXTRA_SHARE[kind]);
  const mods = (gig.mods ??= {});
  const crewOnShow = s.vehicles.filter(v => v.owner === 'player' && v.orders[0] === gig.id).flatMap(v => aboard(s, v.id));
  const tire = (n: number) => crewOnShow.forEach(m => (m.fatigue = Math.min(100, m.fatigue + n)));
  const doIt = (unpaid: boolean) => {
    if (kind === 'hour') {
      tire(8);
      s.crewMorale = Math.max(0, s.crewMorale - (unpaid ? 2 : 0.5));
    } else if (kind === 'kit') {
      mods.quality = (mods.quality ?? 0) + 0.03;
    } else {
      mods.failureFactor = (mods.failureFactor ?? 1) * 1.25;
      mods.quality = (mods.quality ?? 0) - 0.01;
    }
    if (unpaid) gig.trouble = [...(gig.trouble ?? []), { id: `change-${kind}`, label: kind === 'hour' ? 'Unpaid extra hour' : kind === 'kit' ? 'Unpaid extra kit' : 'Rushed load-in', detail: kind === 'hour' ? 'The crew worked an extra hour for nothing.' : kind === 'kit' ? 'Extra kit was found at your cost.' : 'The load-in was squeezed to fit the early soundcheck.', weight: kind === 'early' ? 0.3 : 0.15 }];
  };
  if (option === 'decline') {
    remember(s, gig.act, 'declined');
    s.artistRelations[gig.act] = Math.max(0, (s.artistRelations[gig.act] ?? 0) - 1);
    return `You held to the contract; ${gig.act}'s people were not thrilled.`;
  }
  if (option === 'absorb') {
    remember(s, gig.act, 'absorbed');
    s.artistRelations[gig.act] = (s.artistRelations[gig.act] ?? 0) + 0.5;
    doIt(true);
    return `The extra was done for free. ${gig.act} will expect it next time.`;
  }
  // Quote for it.
  if (rng.chance(payChance(s, gig))) {
    remember(s, gig.act, 'paid');
    gig.fee += extra;
    // You still pay the overtime or the extra kit — the client pays you for it.
    const cost = kind === 'hour' ? overtimeCost(gig) : kind === 'kit' ? kitCost(gig) : 0;
    if (cost) book(s, 'onsite', -cost);
    doIt(false);
    pushNews(s, `${gig.act} agreed to pay ${formatMoney(s, extra)} for the change.`, 'good', { gigId: gig.id, cityId: gig.cityId });
    return `${gig.act} agreed to pay ${formatMoney(s, extra)} extra.`;
  }
  remember(s, gig.act, 'refused');
  s.artistRelations[gig.act] = Math.max(0, (s.artistRelations[gig.act] ?? 0) - 1);
  s.crewMorale = Math.max(0, s.crewMorale - 1);
  // They won't pay, and expect it anyway.
  const cost = kind === 'hour' ? overtimeCost(gig) : kind === 'kit' ? kitCost(gig) : 0;
  if (cost) book(s, 'onsite', -cost);
  doIt(true);
  return `${gig.act} refused to pay and expect it anyway${cost ? ` — it cost you ${formatMoney(s, cost)}` : ''}.`;
}
