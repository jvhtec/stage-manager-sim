/**
 * Headhunting. Every rival has a standout tech on the payroll; if you can
 * afford the premium, you can lure them over — and the rival feels it.
 * It leaves a bad taste though, and poached stars expect to be paid like it.
 */
import { createRng } from '@/lib/rng';
import { dayOf, formatMoney } from './core';
import { CREW_DEPTS, hireFee, makePerson } from './people';
import { rivalHealth } from './rivals';
import type { CrewDept, CrewMember, Rival, TycoonState } from './types';

/** Multiple of the normal signing fee. */
export const HEADHUNT_PREMIUM = 3;
/** Pay rise they expect on top of the going rate. */
export const HEADHUNT_PAY_BUMP = 1.15;
/** Days before the same rival can be raided again. */
export const HEADHUNT_COOLDOWN_DAYS = 180;
/** What it does to them and to you. */
export const HEADHUNT_RIVAL_HEALTH = 6;
export const HEADHUNT_REP_COST = 1;

const MONTH = 30;
const hash = (str: string) => [...str].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

const crewDeptOf = (r: Rival, rng: ReturnType<typeof createRng>): CrewDept => {
  const d = r.specialty === 'console' ? 'audio' : (r.specialty as CrewDept);
  return CREW_DEPTS.includes(d) ? d : rng.pick(CREW_DEPTS);
};

/** The star a rival is currently carrying. Stable within a month; never disturbs the sim's rng. */
export function headhuntTarget(s: TycoonState, r: Rival): CrewMember {
  const month = Math.floor(dayOf(s.hour) / MONTH);
  const rng = createRng((s.mapSeed ^ hash(r.id) ^ Math.imul(month + 1, 2654435761)) >>> 0);
  const level = Math.min(5, 3 + (r.reputation >= 55 ? 1 : 0) + (r.reputation >= 80 ? 1 : 0));
  const scratch = { ...s, nextId: 0 } as TycoonState;
  const m = makePerson(scratch, rng, level, crewDeptOf(r, rng));
  m.id = `hh-${r.id}-${month}`;
  m.payBump = HEADHUNT_PAY_BUMP;
  return m;
}

export const headhuntFee = (m: CrewMember) => hireFee(m) * HEADHUNT_PREMIUM;

export function headhuntBlocker(s: TycoonState, r: Rival): string | null {
  if (s.goneRivals.includes(r.id)) return 'They have gone under.';
  const last = s.headhunted?.[r.id];
  const today = dayOf(s.hour);
  if (last !== undefined && today - last < HEADHUNT_COOLDOWN_DAYS) return `You raided ${r.name} recently — give it ${HEADHUNT_COOLDOWN_DAYS - (today - last)} more days.`;
  if (!s.depots.length) return 'You need a base for them to report to.';
  const fee = headhuntFee(headhuntTarget(s, r));
  if (s.company.cash < fee) return `Needs ${formatMoney(s, fee)} for the signing.`;
  return null;
}

export const headhuntRivalHealthAfter = (r: Rival) => Math.max(0, rivalHealth(r) - HEADHUNT_RIVAL_HEALTH);
