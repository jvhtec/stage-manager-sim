/**
 * What you're known for. The kind of work you do shapes your name: spend your
 * time on sound shows and you become the sound house; do a bit of everything
 * and you're a generalist. Promoters pay a little more for a specialist on a
 * show that leans on their speciality — and a little less for work outside it.
 *
 * It's a moving average of the department mix of your recent shows (a share
 * of 1.0 split five ways), so it can't be gamed by doing everything.
 */
import { DEPT_LABELS } from './catalog';
import { DEPTS, type Dept, type DeptCounts, type Gig, type TycoonState } from './types';

/** Expertise points to share out across departments (each department tops out at 100). */
export const EXPERTISE_POOL = 160;
/** How fast new shows move the mix. */
const SHOW_WEIGHT = 0.04;
/** A perfectly even mix — the neutral point. */
export const EVEN_EXPERTISE = EXPERTISE_POOL / DEPTS.length / 100;
/** Fee swing at the extremes. */
export const EXPERTISE_FEE = 0.12;
/** Show it as a reputation once you're this good. */
export const KNOWN_FOR = 60;

export const evenMix = (): Record<Dept, number> => ({ audio: 0.2, console: 0.2, lighting: 0.2, video: 0.2, stage: 0.2 });

export const mixOf = (s: Pick<TycoonState, 'mix'>) => s.mix ?? evenMix();
export const expertise = (s: Pick<TycoonState, 'mix'>, d: Dept) => Math.min(100, EXPERTISE_POOL * mixOf(s)[d]);

/** A show's department shares (what it needs, as fractions). */
export function needShares(needs: DeptCounts): Record<Dept, number> {
  const total = DEPTS.reduce((sum, d) => sum + needs[d], 0) || 1;
  return Object.fromEntries(DEPTS.map(d => [d, needs[d] / total])) as Record<Dept, number>;
}

/** Fee adjustment for this show given what you're known for: roughly −4% to +8%. */
export function expertiseBonus(s: Pick<TycoonState, 'mix'>, gig: Pick<Gig, 'needs'>): number {
  const share = needShares(gig.needs);
  const fit = DEPTS.reduce((sum, d) => sum + share[d] * (expertise(s, d) / 100), 0);
  return EXPERTISE_FEE * (fit - EVEN_EXPERTISE);
}

/** Mutating: a show played moves the mix towards what it needed (bigger shows count for more). */
export function learnMix(s: TycoonState, gig: Pick<Gig, 'needs' | 'tier'>) {
  const mix = (s.mix ??= evenMix());
  const share = needShares(gig.needs);
  const w = Math.min(0.1, SHOW_WEIGHT * (1 + (gig.tier - 1) * 0.25));
  DEPTS.forEach(d => (mix[d] = mix[d] * (1 - w) + share[d] * w));
}

/** The departments you're known for, best first. */
export function knownFor(s: Pick<TycoonState, 'mix'>): Dept[] {
  return DEPTS.filter(d => expertise(s, d) >= KNOWN_FOR).sort((a, b) => expertise(s, b) - expertise(s, a));
}

export const knownForLabel = (s: Pick<TycoonState, 'mix'>) => {
  const k = knownFor(s);
  return k.length ? k.map(d => DEPT_LABELS[d]).join(' & ') : 'All-rounders';
};
