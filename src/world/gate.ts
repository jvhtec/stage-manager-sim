/**
 * Fee or gate. On bigger single shows the promoter will offer a share of the
 * door instead of a flat fee: if the act sells out and your show is great it
 * pays handsomely; if tickets are slow or the night goes wrong, you eat it.
 *
 * Flat fee:  fee × (0.35 + 0.65 × quality)
 * Gate deal: fee × (0.12 + 1.3 × quality² × hype)
 *
 * `hype` is how well tickets sell — the economy and season, the town's
 * opinion of you, whether it's a real act — plus luck. When you book you get
 * a forecast (the truth plus a bit of noise); the real number is revealed on
 * the night.
 */
import type { Rng } from '@/lib/rng';
import { findArtist } from './content/artists';
import { marketNow } from './market';
import type { Gig, TycoonState } from './types';

export const GATE_BASE = 0.12;
export const GATE_QUALITY = 1.3;
/** Gate deals start at this venue tier. */
export const GATE_MIN_TIER = 2;
const HYPE_MIN = 0.5;
const HYPE_MAX = 1.6;

export function gateBlocker(gig: Gig): string | null {
  if (gig.status !== 'offer') return 'That offer is no longer open.';
  if (gig.tourId || gig.festival || gig.event || gig.overseas) return 'Only single shows can be done on a share of the gate.';
  if (gig.tier < GATE_MIN_TIER) return `Promoters only split the gate on shows of tier ${GATE_MIN_TIER}+.`;
  return null;
}

export const flatPayout = (fee: number, quality: number) => fee * (0.35 + 0.65 * quality);
export const gatePayout = (fee: number, quality: number, hype: number) => fee * (GATE_BASE + GATE_QUALITY * quality * quality * hype);

/** What a show pays, flat or on the gate. */
export function showPayout(gig: Pick<Gig, 'fee' | 'gate'>, quality: number): number {
  return Math.round(gig.gate ? gatePayout(gig.fee, quality, gig.gate.hype) : flatPayout(gig.fee, quality));
}

/** The expected hype before the dice: the economy, season, local standing, a real act. */
export function baseHype(state: TycoonState, gig: Gig): number {
  const demand = marketNow(state).demand;
  const town = ((state.cityRatings[gig.cityId] ?? 50) - 50) / 250;
  const real = findArtist(gig.act) ? 0.08 : 0;
  return Math.max(HYPE_MIN, Math.min(HYPE_MAX, 1 + (demand - 1) * 0.8 + town + real));
}

/** Roll the true hype and the forecast you're shown. */
export function rollGate(state: TycoonState, gig: Gig, rng: Rng): { hype: number; forecast: number } {
  const noise = (rng.next() + rng.next() - 1) * 0.44; // roughly ±0.44, tighter in the middle
  const hype = Math.max(HYPE_MIN, Math.min(HYPE_MAX, baseHype(state, gig) + noise));
  const forecast = Math.max(HYPE_MIN, Math.min(HYPE_MAX, hype + (rng.next() - 0.5) * 0.3));
  return { hype, forecast };
}

export function hypeLabel(h: number): string {
  return h >= 1.3 ? 'a sell-out' : h >= 1.1 ? 'selling well' : h >= 0.9 ? 'steady' : h >= 0.7 ? 'slow' : 'struggling';
}

/** Expected payout at a quality, using what you know: the forecast on a gate deal, nothing special on a flat one. */
export function expectedPayout(gig: Pick<Gig, 'fee' | 'gate'>, quality: number): number {
  return Math.round(gig.gate ? gatePayout(gig.fee, quality, gig.gate.forecast) : flatPayout(gig.fee, quality));
}
