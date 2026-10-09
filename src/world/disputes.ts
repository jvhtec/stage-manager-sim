/**
 * Disputes. Money you're owed isn't always money you get. A promoter unhappy
 * with a poor night holds some of the fee back; an insurer questions a large
 * claim. Either way you choose: take the knock, argue it, or pay lawyers and
 * gamble.
 */
import type { Rng } from '@/lib/rng';
import { createRng } from '@/lib/rng';
import { book, formatMoney, newId, pushNews } from './core';
import { venueRelation } from './promoters';
import type { Gig, TycoonState } from './types';

/** A show below this quality may leave the promoter unhappy. */
export const POOR_NIGHT = 0.62;
/** Share of the payout held back. */
export const HELD_BACK = 0.25;
/** Settling gets this share of the held amount. */
export const SETTLE_SHARE = 0.4;
export const ARGUE_WIN = 0.55;
export const LAWYER_WIN = 0.7;
/** Lawyers' fee as a share of the held amount. */
export const LAWYER_FEE = 0.16;

/** An insurer questions claims at least this big. */
export const CLAIM_DISPUTE_MIN = 1500;
export const CLAIM_DISPUTE_CHANCE = 0.22;
export const CLAIM_SETTLE_SHARE = 0.5;
export const CLAIM_FIGHT_WIN = 0.6;
export const CLAIM_LEGAL_FEE = 0.08;

export const seededRng = (s: TycoonState, key: string): Rng =>
  createRng((s.mapSeed ^ [...key].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 23) ^ s.hour) >>> 0);

/** Chance a promoter disputes a night this poor. */
export function promoterDisputeChance(s: Pick<TycoonState, 'venueRelations'>, gig: Pick<Gig, 'tier' | 'venueId'>, quality: number): number {
  if (gig.tier < 2 || quality >= POOR_NIGHT) return 0;
  return Math.max(0.05, Math.min(0.75, 0.2 + (POOR_NIGHT - quality) * 1.6 - 0.04 * venueRelation(s, gig.venueId)));
}

/**
 * After a poor night: maybe the promoter holds some of the payout back and
 * leaves you to sort it out. Returns what's held (0 if no dispute).
 */
export function maybeDisputeShow(s: TycoonState, gig: Gig, payout: number, quality: number): number {
  const chance = promoterDisputeChance(s, gig, quality);
  if (!chance || payout <= 0 || s.dilemmas.some(d => d.kind === 'dispute' && d.payload?.startsWith(`promoter|${gig.id}|`))) return 0;
  if (!seededRng(s, `p${gig.id}`).chance(chance)) return 0;
  const held = Math.round((payout * HELD_BACK) / 10) * 10;
  const lawyers = Math.round((held * LAWYER_FEE) / 10) * 10;
  s.dilemmas.push({
    id: newId(s, 'dl'),
    kind: 'dispute',
    title: `${gig.act}'s promoter withholds ${formatMoney(s, held)}`,
    text: `They weren't happy with the night (${Math.round(quality * 100)}%) and are holding back part of your fee until it's "resolved".`,
    options: [
      { id: 'settle', label: 'Take the knock', detail: `Accept ${formatMoney(s, Math.round(held * SETTLE_SHARE))} of it and move on. No fuss.` },
      { id: 'argue', label: 'Argue your case', detail: `${Math.round(ARGUE_WIN * 100)}% they pay in full; otherwise you lose it all and the relationship cools.` },
      { id: 'lawyers', label: 'Send in the lawyers', detail: `${formatMoney(s, lawyers)} up front: ${Math.round(LAWYER_WIN * 100)}% you get the lot; lose and it's gone, with a hit to your name.`, cost: lawyers },
    ],
    defaultOption: 'settle',
    gigId: gig.id,
    payload: `promoter|${gig.id}|${held}|${gig.venueId}`,
    createdHour: s.hour,
    expiresHour: s.hour + 24 * 7,
  });
  pushNews(s, `${gig.act}'s promoter is withholding ${formatMoney(s, held)} over the night.`, 'bad', { gigId: gig.id, cityId: gig.cityId });
  return held;
}

/** An insurer questioning a big claim: returns true when a dispute was opened (nothing paid yet). */
export function maybeDisputeClaim(s: TycoonState, loss: number, expected: number, weather: boolean, rng: Rng): boolean {
  if (expected < CLAIM_DISPUTE_MIN || !rng.chance(CLAIM_DISPUTE_CHANCE)) return false;
  const fee = Math.round((loss * CLAIM_LEGAL_FEE) / 10) * 10;
  s.dilemmas.push({
    id: newId(s, 'dl'),
    kind: 'dispute',
    title: `Your insurer disputes a ${formatMoney(s, expected)} claim`,
    text: `The loss adjuster says ${weather ? 'the site was never properly drained' : 'the kit wasn’t properly maintained'} and offers a reduced settlement.`,
    options: [
      { id: 'settle', label: 'Accept their offer', detail: `${formatMoney(s, Math.round(expected * CLAIM_SETTLE_SHARE))}, half of what you're due.` },
      { id: 'fight', label: 'Fight the claim', detail: `${formatMoney(s, fee)} in legal fees: ${Math.round(CLAIM_FIGHT_WIN * 100)}% you're paid in full, otherwise nothing.`, cost: fee },
    ],
    defaultOption: 'settle',
    payload: `claim|${expected}`,
    createdHour: s.hour,
    expiresHour: s.hour + 24 * 10,
  });
  return true;
}

/** Mutating: resolve a dispute decision. Returns a line. */
export function resolveDispute(s: TycoonState, dilemmaId: string, choice: string, payload: string): string {
  const [type, a, b, c] = payload.split('|'); // promoter|gigId|held|venueId, or claim|expected
  const rng = seededRng(s, dilemmaId);
  if (type === 'claim') {
    const expected = Number(a);
    if (choice === 'fight') {
      if (rng.chance(CLAIM_FIGHT_WIN)) {
        book(s, 'insurance', expected);
        return `The insurer backs down and pays ${formatMoney(s, expected)}.`;
      }
      return 'The insurer wins: nothing paid.';
    }
    const paid = Math.round(expected * CLAIM_SETTLE_SHARE);
    book(s, 'insurance', paid);
    return `Settled for ${formatMoney(s, paid)}.`;
  }
  // Promoter.
  const held = Number(b);
  const venueId = c;
  const cool = (by: number) => {
    s.venueRelations ??= {};
    s.venueRelations[venueId] = Math.max(0, (s.venueRelations[venueId] ?? 0) - by);
  };
  if (choice === 'argue' || choice === 'lawyers') {
    const win = choice === 'argue' ? ARGUE_WIN : LAWYER_WIN;
    if (rng.chance(win)) {
      book(s, 'shows', held);
      if (choice === 'argue') cool(0.5);
      return `They back down and pay the ${formatMoney(s, held)}.`;
    }
    cool(choice === 'argue' ? 1 : 2);
    if (choice === 'lawyers') s.company.reputation = Math.max(0, s.company.reputation - 1);
    return `You lose the argument — the ${formatMoney(s, held)} stays with the promoter.`;
  }
  const paid = Math.round(held * SETTLE_SHARE);
  book(s, 'shows', paid);
  return `Settled for ${formatMoney(s, paid)} of the ${formatMoney(s, held)}.`;
}

