/**
 * Department heads. Early on you handle every rider, generator and change order yourself; later
 * you hire people to do it to your policy. A production manager advances shows (cross-hiring what
 * the rider needs, booking generators, ground support, shuttles and loaders when it's worth it)
 * and answers clients' change requests; a crew chief keeps feuding people apart and rotates the
 * road crew so burnout builds slower; a finance director chases invoices so fewer run late, and
 * sharpens the cash forecast. Each costs a salary every month.
 */
import { book, dateOfDay, dayOf, formatMoney, pushNews } from './core';
import { crossHire, crossHireCost, crossHireOptions } from './techRider';
import { bookFix } from './production';
import { projectCoverage } from './queries';
import { payChance } from './changes';
import type { Gig, TycoonState } from './types';

export type ManagerId = 'production' | 'crew' | 'finance';
export const MANAGER_IDS: ManagerId[] = ['production', 'crew', 'finance'];

export const MANAGERS: Record<ManagerId, { title: string; salary: number; blurb: string }> = {
  production: { title: 'Production manager', salary: 3200, blurb: 'Advances every show: cross-hires what the rider needs and books generators, ground support, shuttles and loaders when they cost under the limit you set. Answers clients’ change requests: quotes when they’re likely to pay, otherwise holds to the contract.' },
  crew: { title: 'Crew chief', salary: 2600, blurb: 'Keeps people who are at loggerheads on different trucks, and rotates the road crew so burnout builds a third slower.' },
  finance: { title: 'Finance director', salary: 3000, blurb: 'Chases invoices: 40% fewer run late. Sharpens the cash forecast.' },
};

/** Share of the fee the production manager may spend on a show's fixes. */
export type SpendLimit = 0.1 | 0.2 | 0.35;
export const SPEND_LIMITS: SpendLimit[] = [0.1, 0.2, 0.35];

export const hasManager = (s: Pick<TycoonState, 'managers'>, id: ManagerId) => !!s.managers?.[id];
export const managerSalaries = (s: Pick<TycoonState, 'managers'>) => MANAGER_IDS.reduce((n, id) => n + (s.managers?.[id] ? MANAGERS[id].salary : 0), 0);

export function monthlyManagers(s: TycoonState) {
  const total = managerSalaries(s);
  if (total) book(s, 'salaries', -total);
}

/** Days ahead the production manager advances a show. */
const ADVANCE_DAYS = 5;

/** Daily: the production manager advances the shows coming up. */
export function dailyProduction(s: TycoonState) {
  if (!hasManager(s, 'production')) return;
  const limit = s.managers?.spendLimit ?? 0.2;
  const today = dayOf(s.hour);
  const done: string[] = [];
  s.gigs
    .filter(g => g.status === 'booked' && g.day - today >= 1 && g.day - today <= ADVANCE_DAYS)
    .forEach(g => {
      let budget = g.fee * limit - (g.pmSpent ?? 0);
      const proj = projectCoverage(s, g);
      if (!proj.vehicles.length && !g.freight) return;
      for (const b of proj.breaches) {
        if (!g.techSpec) break;
        const opt = crossHireOptions(g.techSpec, b.id, dateOfDay(s, g.day).getUTCFullYear())[0];
        const units = b.id === 'pa' ? Math.max(1, g.needs.audio) : 1;
        if (!opt) continue;
        const cost = crossHireCost(opt.id, units, g.days ?? 1);
        if (cost > budget || s.company.cash < cost * 2) continue;
        crossHire(s, g, opt.id, units);
        budget -= cost;
        g.pmSpent = (g.pmSpent ?? 0) + cost;
        done.push(`${opt.brand} ${opt.name} for ${g.act}`);
      }
      for (const p of proj.production) {
        if (p.fixCost > budget || s.company.cash < p.fixCost * 2) continue;
        bookFix(s, g, p);
        budget -= p.fixCost;
        g.pmSpent = (g.pmSpent ?? 0) + p.fixCost;
        done.push(`${p.fixLabel.toLowerCase()} for ${g.act}`);
      }
    });
  if (done.length) pushNews(s, `Your production manager advanced the shows: ${done.join('; ')}.`, 'info');
}

/** The production manager's answer to a change request. */
export function pmAnswer(s: TycoonState, gig: Gig, kind: string): 'charge' | 'decline' | 'absorb' {
  if (payChance(s, gig) >= 0.55) return 'charge';
  if (kind === 'kit' && (s.artistRelations[gig.act] ?? 0) >= 2) return 'absorb';
  return 'decline';
}

export function hireManager(s: TycoonState, id: ManagerId, on: boolean): string {
  s.managers = { ...(s.managers ?? {}), [id]: on || undefined };
  return on ? `${MANAGERS[id].title} hired: ${formatMoney(s, MANAGERS[id].salary)} a month.` : `${MANAGERS[id].title} let go.`;
}
