/**
 * Safety audits. Every September the council inspects each of your bases.
 * A tidy, well-staffed base with first-aiders and a decent bench passes with
 * a nod; a crowded one with no prep crew draws an improvement notice, and a
 * bad one a prohibition. You fix it, appeal, or take the fine.
 */
import type { Rng } from '@/lib/rng';
import { book, dayOf, formatMoney, newId, pushNews, yearOf } from './core';
import { modLevel } from './annexes';
import { hasCert } from './certs';
import { facilitySpec, prepRatio, usedCapacity } from './facilities';
import { worldOf } from './mapgen';
import type { Depot, TycoonState } from './types';

export const AUDIT_MONTH = 9;
export const PASS_SCORE = 70;
export const NOTICE_SCORE = 45;
/** Don't audit a base younger than this. */
export const AUDIT_MIN_AGE_DAYS = 120;
export const FIX_SHARE = 0.04;
export const APPEAL_FEE_SHARE = 0.015;
export const APPEAL_WIN = 0.4;
export const FINE_SHARE = 0.07;
export const PROHIBITION_FIX_SHARE = 0.08;
export const PROHIBITION_FINE_SHARE = 0.15;

export interface AuditScore {
  total: number;
  parts: { label: string; points: number }[];
}

/** What the inspector sees (before the luck of who turns up). */
export function auditScore(s: TycoonState, d: Depot): AuditScore {
  const parts: { label: string; points: number }[] = [{ label: 'Housekeeping', points: 60 }];
  if (d.kind === 'warehouse') parts.push({ label: 'Prep crew keeping up', points: Math.round(prepRatio(s, d) * 20) });
  else parts.push({ label: 'Small premises', points: 15 });
  const over = usedCapacity(s, d) > facilitySpec(d).capacity;
  if (over) parts.push({ label: 'Over capacity', points: -20 });
  const aiders = s.people.filter(m => m.depotId === d.id && hasCert(m, 'safety')).length;
  if (aiders) parts.push({ label: aiders > 1 ? 'First aiders on site' : 'First aider on site', points: aiders > 1 ? 15 : 10 });
  if (modLevel(d, 'lounge')) parts.push({ label: 'Crew facilities', points: 4 });
  if (modLevel(d, 'workshop')) parts.push({ label: 'Workshop bench', points: 4 });
  return { total: parts.reduce((sum, p) => sum + p.points, 0), parts };
}

const buildOf = (d: Depot) => facilitySpec(d).build;
const baseName = (s: TycoonState, d: Depot) => worldOf(s).cityById.get(d.cityId)?.name ?? 'your';

/** September: the inspectors call. Uses a side rng. */
export function monthlyAudits(s: TycoonState, rng: Rng) {
  const date = new Date(Date.UTC(s.startYear, 0, 1) + dayOf(s.hour) * 86400000);
  if (date.getUTCMonth() + 1 !== AUDIT_MONTH) return;
  const year = yearOf(s, s.hour);
  s.depots.forEach(d => {
    if (dayOf(s.hour) - Math.floor(d.builtHour / 24) < AUDIT_MIN_AGE_DAYS) return;
    if (d.audit?.year === year) return;
    const found = auditScore(s, d);
    const score = Math.max(0, Math.min(100, found.total + Math.round((rng.next() - 0.5) * 20)));
    d.audit = { year, score };
    const name = baseName(s, d);
    if (score >= PASS_SCORE) {
      s.company.reputation = Math.min(100, s.company.reputation + 0.3);
      pushNews(s, `Safety audit at your ${name} base: a clean pass (${score}/100).`, 'good', { cityId: d.cityId });
      return;
    }
    const build = buildOf(d);
    if (score >= NOTICE_SCORE) {
      const fix = Math.round((build * FIX_SHARE) / 10) * 10;
      const appeal = Math.round((build * APPEAL_FEE_SHARE) / 10) * 10;
      const fine = Math.round((build * FINE_SHARE) / 10) * 10;
      s.dilemmas.push({
        id: newId(s, 'dl'),
        kind: 'audit',
        title: `Improvement notice at your ${name} base`,
        text: `The inspector scored you ${score}/100: cluttered gangways, stretched staff and patchy records. Put it right, or argue the point.`,
        options: [
          { id: 'fix', label: 'Put it right', detail: `${formatMoney(s, fix)} on racking, signage and training. Notice lifted.`, cost: fix },
          { id: 'appeal', label: 'Appeal', detail: `${formatMoney(s, appeal)}: ${Math.round(APPEAL_WIN * 100)}% it's overturned; otherwise a ${formatMoney(s, fine)} fine.`, cost: appeal },
          { id: 'ignore', label: 'Pay the fine', detail: `${formatMoney(s, fine)} and your insurer hears about it.` },
        ],
        defaultOption: 'ignore',
        payload: `${d.id}|${score}`,
        createdHour: s.hour,
        expiresHour: s.hour + 24 * 14,
      });
      pushNews(s, `The council has served an improvement notice on your ${name} base (${score}/100).`, 'bad', { cityId: d.cityId });
      return;
    }
    const fix = Math.round((build * PROHIBITION_FIX_SHARE) / 10) * 10;
    const fine = Math.round((build * PROHIBITION_FINE_SHARE) / 10) * 10;
    s.dilemmas.push({
      id: newId(s, 'dl'),
      kind: 'audit',
      title: `Prohibition notice at your ${name} base`,
      text: `The inspector scored you ${score}/100 and ordered work stopped until it is fixed: a serious breach.`,
      options: [
        { id: 'fix', label: 'Fix it now', detail: `${formatMoney(s, fix)} on an emergency overhaul. Back to work.`, cost: fix },
        { id: 'close', label: 'Shut and wait', detail: `${formatMoney(s, fine)} fine, crew morale −3 and your name takes a knock.` },
      ],
      defaultOption: 'close',
      payload: `${d.id}|${score}`,
      createdHour: s.hour,
      expiresHour: s.hour + 24 * 7,
    });
    pushNews(s, `The council has ordered work stopped at your ${name} base (${score}/100).`, 'big', { cityId: d.cityId });
  });
}

/** Mutating: the answer to an audit notice. Returns a line. */
export function resolveAudit(s: TycoonState, dilemmaId: string, choice: string, payload: string, rng: Rng): string {
  const [depotId] = payload.split('|');
  const d = s.depots.find(x => x.id === depotId);
  if (!d) return '';
  const build = buildOf(d);
  if (choice === 'fix') return 'Notice lifted.';
  if (choice === 'appeal') {
    if (rng.chance(APPEAL_WIN)) return 'The appeal succeeds: no fine.';
    const fine = Math.round((build * FINE_SHARE) / 10) * 10;
    book(s, 'legal', -fine);
    s.claims.push(dayOf(s.hour));
    return `The appeal fails: fined ${formatMoney(s, fine)}.`;
  }
  if (choice === 'ignore') {
    const fine = Math.round((build * FINE_SHARE) / 10) * 10;
    book(s, 'legal', -fine);
    s.claims.push(dayOf(s.hour));
    return `Fined ${formatMoney(s, fine)}.`;
  }
  const fine = Math.round((build * PROHIBITION_FINE_SHARE) / 10) * 10;
  book(s, 'legal', -fine);
  s.crewMorale = Math.max(0, s.crewMorale - 3);
  s.company.reputation = Math.max(0, s.company.reputation - 1);
  return `Shut for a week: fined ${formatMoney(s, fine)}.`;
}
