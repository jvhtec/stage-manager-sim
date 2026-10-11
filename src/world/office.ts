/**
 * Span of control. Someone has to send every truck its call times, every crew its rota, every
 * promoter their advance and every invoice its reminder. The founder can run a handful of trucks
 * from a kitchen table; past that it takes office staff and department heads. Grow the fleet and
 * the crew faster than the office and things start falling through the cracks: call times go out
 * wrong and trucks arrive late, and cases get left on the warehouse floor. Expansion that outruns
 * the office is how a good company starts having bad nights.
 */
import type { TycoonState } from './types';

/** What the founder can coordinate alone, in trucks-and-crews. */
export const OWNER_SPAN = 4;
/** What each office member adds. */
export const OFFICE_SPAN = 2.5;
/** What each department head adds. */
export const MANAGER_SPAN = { production: 6, crew: 3, finance: 2 };
/** Crew per unit of load (a truck is one). */
export const CREW_PER_LOAD = 4;
/** Each base beyond the first adds this much coordination. */
export const EXTRA_BASE_LOAD = 2;

type S = Pick<TycoonState, 'vehicles' | 'people' | 'depots' | 'managers'>;

export const officeLoad = (s: S) =>
  s.vehicles.filter(v => v.owner === 'player').length + s.people.length / CREW_PER_LOAD + Math.max(0, s.depots.length - 1) * EXTRA_BASE_LOAD;

export function officeCapacity(s: S): number {
  const office = s.depots.reduce((n, d) => n + d.staff.office, 0);
  const heads = (Object.keys(MANAGER_SPAN) as (keyof typeof MANAGER_SPAN)[]).reduce((n, id) => n + (s.managers?.[id] ? MANAGER_SPAN[id] : 0), 0);
  return OWNER_SPAN + office * OFFICE_SPAN + heads;
}

/** How far the work has outgrown the office: 0 when it's coping, 0.5 when there's half as much again as it can handle. */
export const officeStretch = (s: S) => Math.max(0, officeLoad(s) / officeCapacity(s) - 1);

/** Chance per show that the office gets the call times wrong (and the truck turns up late). */
export const officeSlipChance = (stretch: number) => Math.min(0.6, stretch * 0.3);
/** Hours lost when it does: more, the more the office is drowning. */
export const officeSlipHours = (stretch: number, roll: (n: number) => number) => 1 + roll(Math.min(5, 2 + Math.floor(stretch)));
/** Invoices nobody chases go late more often. */
export const officeLateFactor = (stretch: number) => 1 + Math.min(1, stretch * 0.5);
/** How much likelier a stretched warehouse is to leave a case behind. */
export const officePrepFactor = (stretch: number) => 1 + stretch;
