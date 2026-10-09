/**
 * Promoter relationships. Every venue's promoter remembers how your last
 * nights went: do right by them and they call you first and pay a little
 * more; leave them with a bad night and they go cold.
 */
import type { TycoonState } from './types';

export const MAX_RELATION = 8;
/** Offer weight added per relationship point at that venue. */
const OFFER_WEIGHT = 0.25;
/** Fee uplift per point (up to FEE_CAP_POINTS). */
const FEE_PER_POINT = 0.02;
const FEE_CAP_POINTS = 5;

export const venueRelation = (s: Pick<TycoonState, 'venueRelations'>, venueId: string) => s.venueRelations?.[venueId] ?? 0;
export const relationOfferWeight = (s: Pick<TycoonState, 'venueRelations'>, venueId: string) => 1 + OFFER_WEIGHT * venueRelation(s, venueId);
export const relationFeeBonus = (s: Pick<TycoonState, 'venueRelations'>, venueId: string) => 1 + FEE_PER_POINT * Math.min(FEE_CAP_POINTS, venueRelation(s, venueId));

/** After a night: great shows build the bond, rough ones strain it, disasters wreck it. */
export function recordVenueNight(s: TycoonState, venueId: string, quality: number, failed: boolean) {
  const delta = failed ? -3 : quality >= 0.85 ? 1 : quality >= 0.7 ? 0.5 : quality < 0.5 ? -1 : 0;
  if (!delta) return;
  s.venueRelations ??= {};
  s.venueRelations[venueId] = Math.max(0, Math.min(MAX_RELATION, (s.venueRelations[venueId] ?? 0) + delta));
}

export function relationLabel(points: number): string {
  return points >= 6 ? 'Family' : points >= 3.5 ? 'Trusted' : points >= 1.5 ? 'Friendly' : points > 0 ? 'Acquainted' : 'Strangers';
}
