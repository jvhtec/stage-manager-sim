/**
 * The contract behind a booking. A deposit lands when you book (cash now, before a single truck
 * moves); a cancellation clause says what the client owes if they pull the show. Easy-going clients
 * offer both; pushy ones neither. You can insist on better terms before you book — some clients
 * agree, some refuse, and some take the show elsewhere. Booked shows do get cancelled, more so by
 * pushy clients and in a downturn, and whatever you'd already spent on hires and fixes is gone.
 */
import type { Rng } from '@/lib/rng';
import { book, dayOf, formatMoney, pushNews } from './core';
import { clientTemper, memoryOf } from './changes';
import { logIncident } from './consequences';
import { marketNow } from './market';
import { rivalCancelled } from './rivalOps';
import type { Gig, GigTerms, TycoonState } from './types';

const DEFAULT: Record<ReturnType<typeof clientTemper>, GigTerms> = {
  easy: { deposit: 0.25, cancel: 0.5 },
  fair: { deposit: 0.1, cancel: 0.25 },
  pushy: { deposit: 0, cancel: 0 },
};
export const BETTER_TERMS: GigTerms = { deposit: 0.3, cancel: 0.75 };

/** Standalone shows carry terms; festivals, events and tours have their own contracts. */
export const hasTerms = (gig: Pick<Gig, 'tier' | 'festival' | 'event' | 'tourId' | 'overseas'>) => gig.tier >= 2 && !gig.festival && !gig.event && !gig.tourId && !gig.overseas;

export function defaultTerms(gig: Pick<Gig, 'act' | 'tier' | 'festival' | 'event' | 'tourId' | 'overseas'>): GigTerms | undefined {
  if (!hasTerms(gig)) return undefined;
  const t = DEFAULT[clientTemper(gig.act)];
  return t.deposit || t.cancel ? { ...t } : { deposit: 0, cancel: 0 };
}

/** Chance a client agrees to better terms. */
export function termsChance(s: Pick<TycoonState, 'artistRelations' | 'clients'>, gig: Gig): number {
  const base = { easy: 0.8, fair: 0.55, pushy: 0.25 }[clientTemper(gig.act)];
  const m = memoryOf(s, gig.act);
  return Math.max(0.05, Math.min(0.95, base + 0.04 * Math.min(5, s.artistRelations[gig.act] ?? 0) + 0.04 * m.paid - 0.05 * m.refused));
}
const WALK = { easy: 0.05, fair: 0.2, pushy: 0.4 };

export type TermsOutcome = 'agreed' | 'refused' | 'walked';

export function askForTerms(s: TycoonState, gig: Gig, rng: Rng): TermsOutcome {
  gig.termsAsked = true;
  if (rng.chance(termsChance(s, gig))) {
    const t = gig.terms ?? { deposit: 0, cancel: 0 };
    gig.terms = { deposit: Math.max(t.deposit, BETTER_TERMS.deposit), cancel: Math.max(t.cancel, BETTER_TERMS.cancel) };
    return 'agreed';
  }
  if (rng.chance(WALK[clientTemper(gig.act)])) {
    gig.status = 'expired';
    return 'walked';
  }
  return 'refused';
}

export const depositOf = (gig: Pick<Gig, 'fee' | 'terms'>) => Math.round((gig.fee * (gig.terms?.deposit ?? 0)) / 50) * 50;

/** Daily chance a client pulls a booked show, by temper. */
const CANCEL_PER_DAY = { easy: 0.0004, fair: 0.0008, pushy: 0.0018 };

/** Daily: deposits land on booked shows; now and then a client cancels. */
export function dailyTerms(s: TycoonState, rng: Rng) {
  const today = dayOf(s.hour);
  const slump = marketNow(s).demand < 0.95 ? 1.6 : 1;
  s.gigs.forEach(gig => {
    // Clients cancel on rivals too, on the same terms.
    if (gig.status === 'rival' && gig.terms && !gig.result) {
      const ahead = gig.day - today;
      const rival = s.rivals.find(r => r.id === gig.rivalId);
      if (rival && ahead >= 2 && ahead <= 45 && rng.chance(CANCEL_PER_DAY[clientTemper(gig.act)] * slump)) {
        rivalCancelled(s, rival, gig);
        gig.status = 'expired';
        gig.cancelled = true;
      }
      return;
    }
    if (gig.status !== 'booked' || !gig.terms) return;
    if (gig.terms.deposit > 0 && gig.depositPaid === undefined) {
      gig.depositPaid = depositOf(gig);
      if (gig.depositPaid) {
        book(s, 'shows', gig.depositPaid);
        pushNews(s, `${gig.act}'s ${formatMoney(s, gig.depositPaid)} deposit has landed.`, 'good', { gigId: gig.id, cityId: gig.cityId });
      }
    }
    const ahead = gig.day - today;
    if (ahead < 2 || ahead > 45) return;
    if (!rng.chance(CANCEL_PER_DAY[clientTemper(gig.act)] * slump)) return;
    cancelByClient(s, gig);
  });
}

/** The client pulls the show: you keep the deposit and are owed the cancellation fee on top. */
export function cancelByClient(s: TycoonState, gig: Gig) {
  const deposit = gig.depositPaid ?? 0;
  const owed = Math.round(gig.fee * (gig.terms?.cancel ?? 0));
  const extra = Math.max(0, owed - deposit);
  if (extra) book(s, 'shows', extra);
  gig.status = 'expired';
  gig.cancelled = true;
  const kept = deposit + extra;
  const spent = gig.crossHire || gig.fixes ? ' What was already spent on hires and fixes for it is gone.' : '';
  logIncident(s, {
    kind: 'client',
    title: `${gig.act} cancelled`,
    gigId: gig.id,
    causes: [
      { id: 'client-cancel', label: 'The client pulled the show', detail: `${gig.act} cancelled ${gig.day - dayOf(s.hour)} days out.`, weight: 0.8 },
      kept
        ? { id: 'terms', label: 'The contract paid out', detail: `The deposit and cancellation clause left you ${formatMoney(s, kept)}.`, weight: 0.3 }
        : { id: 'no-terms', label: 'No cancellation clause', detail: 'With no deposit and no clause, there was nothing to claim.', weight: 0.6 },
    ],
    outcome: kept ? `You keep ${formatMoney(s, kept)} of a ${formatMoney(s, gig.fee)} fee.` : 'Nothing to show for it.',
  });
  pushNews(
    s,
    `${gig.act} have cancelled their show. ${kept ? `The contract leaves you ${formatMoney(s, kept)}.` : 'No deposit, no cancellation clause: nothing to claim.'}${spent}`,
    kept ? 'info' : 'bad',
    { gigId: gig.id, cityId: gig.cityId },
  );
}

/** What's still to come from a show after the deposit. */
export const balanceDue = (gig: Pick<Gig, 'depositPaid'>, payout: number) => Math.max(0, payout - (gig.depositPaid ?? 0));
