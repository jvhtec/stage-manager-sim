/**
 * Tickets. Big shows are inspected: council safety officers want a certified
 * rigger on anything hung overhead and a first aider in the crew. People can
 * be sent on courses (away from work for a few days, for a fee — cheaper in
 * your own training room or academy), and the hiring market turns up some
 * with tickets already.
 */
import type { Rng } from '@/lib/rng';
import { book, dayOf, formatMoney, newId, pushNews } from './core';
import { modLevel as annexLevel } from './annexes';
import { makePerson, CREW_DEPTS } from './people';
import { worldOf } from './mapgen';
import type { CertId, CrewMember, Gig, TycoonState } from './types';

export interface CertInfo {
  label: string;
  short: string;
  icon: string;
  /** Course fee. */
  cost: number;
  days: number;
  blurb: string;
}

export const CERTS: Record<CertId, CertInfo> = {
  rigging: { label: 'Rigging ticket', short: 'Rigger', icon: '🪢', cost: 900, days: 5, blurb: 'Working at height and hanging loads: required overhead on big shows.' },
  safety: { label: 'Safety & first aid', short: 'First aid', icon: '⛑️', cost: 350, days: 3, blurb: 'Event safety and first aid: every big crew needs someone.' },
};
export const CERT_IDS: CertId[] = ['rigging', 'safety'];

/** Certified people a show needs aboard (shows from tier 3 up). */
export function requiredCerts(gig: Pick<Gig, 'tier'> & { meister?: boolean }): Record<CertId, number> {
  const base = gig.tier >= 4 ? { rigging: 2, safety: 1 } : gig.tier >= 3 ? { rigging: 1, safety: 1 } : { rigging: 0, safety: 0 };
  // Germany: a Meister für Veranstaltungstechnik is one more certified rigger.
  return gig.meister ? { ...base, rigging: base.rigging + 1 } : base;
}

export const hasCert = (m: Pick<CrewMember, 'certs'>, c: CertId) => !!m.certs?.includes(c);
export const certCount = (people: Pick<CrewMember, 'certs'>[], c: CertId) => people.filter(m => hasCert(m, c)).length;

export function certShortfall(people: Pick<CrewMember, 'certs'>[], gig: Pick<Gig, 'tier'> & { meister?: boolean }): Record<CertId, number> {
  const need = requiredCerts(gig);
  return { rigging: Math.max(0, need.rigging - certCount(people, 'rigging')), safety: Math.max(0, need.safety - certCount(people, 'safety')) };
}

/** What an uncertified crew costs a show. */
export const MISSING_RIGGER_QUALITY = 0.04;
export const MISSING_RIGGER_FAILURE = 1.12;
export const MISSING_SAFETY_FAILURE = 1.06;
/** Inspection fine per missing ticket, as a share of the fee. */
export const INSPECTION_FINE = 0.05;

export function certPenalty(short: Record<CertId, number>, gig: Pick<Gig, 'fee'>) {
  const missing = short.rigging + short.safety;
  return {
    missing,
    quality: short.rigging * MISSING_RIGGER_QUALITY,
    failureFactor: Math.pow(MISSING_RIGGER_FAILURE, short.rigging) * Math.pow(MISSING_SAFETY_FAILURE, short.safety),
    fine: Math.round((gig.fee * INSPECTION_FINE * missing) / 10) * 10,
  };
}

/** Starting tickets for people who turn up in the hiring market: deterministic from their id. */
export function startingCerts(id: string, primary: CrewMember['primary'], level: number): CertId[] {
  const h = [...id].reduce((acc, c) => (Math.imul(acc, 31) + c.charCodeAt(0)) >>> 0, 17);
  const certs: CertId[] = [];
  const rig = primary === 'stage' ? 0.55 : primary === 'lighting' ? 0.25 : 0.08;
  if (((h >>> 3) % 100) / 100 < rig + (level >= 3 ? 0.15 : 0)) certs.push('rigging');
  if (((h >>> 11) % 100) / 100 < 0.2 + (level >= 2 ? 0.1 : 0)) certs.push('safety');
  return certs;
}

/** Best training room you have: 0 (none), 1 or 2. */
export const academyLevel = (s: Pick<TycoonState, 'depots'>) => s.depots.reduce((m, d) => Math.max(m, annexLevel(d, 'academy')), 0);
const FEE_FACTOR = [1, 0.7, 0.5];
const DAYS_FACTOR = [1, 0.6, 0.4];
export const courseCost = (s: Pick<TycoonState, 'depots'>, c: CertId) => Math.round((CERTS[c].cost * FEE_FACTOR[academyLevel(s)]) / 10) * 10;
export const courseDays = (s: Pick<TycoonState, 'depots'>, c: CertId) => Math.max(1, Math.round(CERTS[c].days * DAYS_FACTOR[academyLevel(s)]));

export function courseBlocker(s: TycoonState, m: CrewMember, c: CertId): string | null {
  if (hasCert(m, c)) return 'Already qualified.';
  if (m.course) return 'Already on a course.';
  if (!m.depotId) return 'They are out on a job — send them when they are back at base.';
  const cost = courseCost(s, c);
  if (s.company.cash < cost) return `The course costs ${formatMoney(s, cost)}.`;
  return null;
}

export function startCourse(s: TycoonState, m: CrewMember, c: CertId): string {
  const cost = courseCost(s, c);
  book(s, 'training', -cost);
  m.course = { cert: c, untilDay: dayOf(s.hour) + courseDays(s, c) };
  return `${m.name} starts the ${CERTS[c].label.toLowerCase()} course (${courseDays(s, c)} days, ${formatMoney(s, cost)}).`;
}

/** Daily: courses finish. */
export function dailyCourses(s: TycoonState) {
  const today = dayOf(s.hour);
  s.people.forEach(m => {
    if (!m.course || m.course.untilDay > today) return;
    (m.certs ??= []).push(m.course.cert);
    pushNews(s, `${m.name} passes the ${CERTS[m.course.cert].label.toLowerCase()} course.`, 'good');
    m.course = undefined;
  });
}

/** Quarterly: a proper academy turns out an apprentice. Uses a side rng. */
export function monthlyCerts(s: TycoonState, rng: Rng) {
  const month = Math.floor(dayOf(s.hour) / 30);
  if (month % 3 !== 0) return;
  s.depots.forEach(d => {
    if (annexLevel(d, 'academy') < 2 || d.kind !== 'warehouse') return;
    const m = makePerson(s, rng, 1, rng.pick(CREW_DEPTS));
    m.id = newId(s, 'crew');
    m.depotId = d.id;
    m.hiredHour = s.hour;
    if (rng.chance(0.6)) (m.certs ??= []).push(rng.chance(0.5) ? 'rigging' : 'safety');
    s.people.push(m);
    pushNews(s, `${m.name} graduates from your academy in ${worldOf(s).cityById.get(d.cityId)?.name} and joins the crew.`, 'good', { cityId: d.cityId });
  });
}
