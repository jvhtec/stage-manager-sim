/**
 * The briefing. With this many moving parts, a good manager keeps a list of
 * what needs doing before it bites: shows with no truck, rehearsals still to
 * book, a thin bank balance, a sponsor you're about to disappoint. Pure
 * reading of the state — nothing here changes anything.
 */
import { SERVICE_INTERVAL_DAYS } from './catalog';
import { auditScore, PASS_SCORE } from './audits';
import { certCount, requiredCerts } from './certs';
import { dateOfDay, dayOf, formatMoney, yearOf } from './core';
import { monthlyRent, monthlySalaries } from './facilities';
import { INSURANCE, insuredValue } from './incidents';
import { PAY } from './crew';
import { marketNow } from './market';
import { worldOf } from './mapgen';
import { dayRate } from './people';
import { requiredStageLevel, bestStageLevel, stageName } from './annexes';
import { showsThisMonth } from './sponsors';
import type { TycoonState } from './types';

export type AlertTone = 'bad' | 'warn' | 'info';

/** Which window deals with an alert (a subset of the UI's window kinds). */
export type AlertTarget = 'decisions' | 'crew' | 'gig' | 'finance' | 'policies' | 'market' | 'vehicles' | 'shows' | 'depot' | 'depots';

export interface Alert {
  id: string;
  tone: AlertTone;
  text: string;
  /** What to open to deal with it. */
  go?: { kind: AlertTarget; refId?: string };
}

const TONE_ORDER: Record<AlertTone, number> = { bad: 0, warn: 1, info: 2 };

/** Rough monthly cost of standing still: rent, salaries, crew pay and insurance. */
export function monthlyBurn(s: TycoonState): number {
  const world = worldOf(s);
  const pay = PAY[s.policies.pay].wage;
  const rent = s.depots.reduce((sum, d) => sum + monthlyRent(world, d), 0);
  const wages = Math.round(s.people.reduce((sum, m) => sum + dayRate(m), 0) * pay * 30);
  const insurance = Math.round(insuredValue(s) * INSURANCE[s.policies.insurance].monthlyRate);
  return rent + monthlySalaries(s, pay) + wages + insurance + Math.round(s.company.loan * (marketNow(s).loanRate / 12));
}

export function briefing(s: TycoonState): Alert[] {
  const out: Alert[] = [];
  const today = dayOf(s.hour);
  const world = worldOf(s);
  const city = (id: string) => world.cityById.get(id)?.name ?? '';
  const booked = s.gigs.filter(g => g.status === 'booked' && !g.result).sort((a, b) => a.day - b.day);

  if (s.dilemmas.length) {
    out.push({ id: 'decisions', tone: 'bad', text: `${s.dilemmas.length} decision${s.dilemmas.length === 1 ? '' : 's'} waiting for you — the default happens at the deadline.`, go: { kind: 'decisions' } });
  }
  if (s.poachBids.length) {
    out.push({ id: 'poach', tone: 'warn', text: `A rival has made an offer to ${s.poachBids.length === 1 ? 'one of your people' : `${s.poachBids.length} of your people`}.`, go: { kind: 'crew' } });
  }

  booked.forEach(g => {
    const away = g.day - today;
    if (away > 7) return;
    const assigned = s.vehicles.some(v => v.owner === 'player' && v.orders.includes(g.id));
    if (!assigned && away <= 4) {
      out.push({ id: `unassigned-${g.id}`, tone: 'bad', text: `${g.act} in ${city(g.cityId)} ${away <= 0 ? 'is today' : `is in ${away} day${away === 1 ? '' : 's'}`} and has no vehicle assigned.`, go: { kind: 'gig', refId: g.id } });
    }
    const need = requiredStageLevel(s, g);
    if (need > 0 && !g.rehearsed && away >= 0) {
      out.push({
        id: `rehearse-${g.id}`,
        tone: away <= 3 ? 'bad' : 'warn',
        text: `${g.act} still needs a rehearsal (${stageName(need)}) — ${away <= 0 ? 'today' : `${away} day${away === 1 ? '' : 's'}`} to go.`,
        go: { kind: 'gig', refId: g.id },
      });
    }
    const certs = requiredCerts(g);
    if ((certs.rigging && certCount(s.people, 'rigging') < certs.rigging) || (certs.safety && certCount(s.people, 'safety') < certs.safety)) {
      out.push({ id: `tickets-${g.id}`, tone: 'warn', text: `${g.act} needs ticketed crew (rigger / first aider) and you don't have enough on staff.`, go: { kind: 'crew' } });
    }
  });

  // Money.
  const burn = monthlyBurn(s);
  if (burn > 0) {
    if (s.company.cash < burn) out.push({ id: 'cash-low', tone: 'bad', text: `Cash (${formatMoney(s, s.company.cash)}) is below a month of fixed costs (about ${formatMoney(s, burn)}).`, go: { kind: 'finance' } });
    else if (s.company.cash < burn * 2.5) out.push({ id: 'cash-thin', tone: 'warn', text: `Cash is thin: under ${(s.company.cash / burn).toFixed(1)} months of fixed costs.`, go: { kind: 'finance' } });
  }
  if (s.company.cash > 0 && s.company.loan > 0 && marketNow(s).loanRate > 0.1 && s.company.cash > s.company.loan * 1.5) {
    out.push({ id: 'repay', tone: 'info', text: `You're paying ${(marketNow(s).loanRate * 100).toFixed(0)}% on a loan you could clear from cash.`, go: { kind: 'finance' } });
  }
  if (s.policies.insurance === 'none' && insuredValue(s) > 100_000) {
    out.push({ id: 'uninsured', tone: 'warn', text: `${formatMoney(s, insuredValue(s))} of kit and trucks and no insurance.`, go: { kind: 'policies' } });
  }
  const fuel = marketNow(s).fuel;
  if (fuel >= 1.3 && !(s.fuelLock && s.fuelLock.untilDay > today)) {
    out.push({ id: 'fuel', tone: 'info', text: `Diesel is ${Math.round((fuel - 1) * 100)}% above normal. A fuel contract would fix the price.`, go: { kind: 'market' } });
  }

  // People and kit.
  const worn = s.vehicles.filter(v => v.owner === 'player' && (v.reliability < 40 || (s.hour - v.lastServiceHour) / 24 > SERVICE_INTERVAL_DAYS * 1.5));
  if (worn.length) out.push({ id: 'service', tone: 'warn', text: `${worn.length} vehicle${worn.length === 1 ? ' is' : 's are'} overdue for service or unreliable.`, go: { kind: 'vehicles' } });
  const tired = s.people.filter(m => m.fatigue >= 70).length;
  if (s.people.length >= 4 && tired / s.people.length >= 0.4) out.push({ id: 'tired', tone: 'info', text: `${tired} of ${s.people.length} crew are worn out. Consider a rest rota.`, go: { kind: 'policies' } });

  // Sponsors.
  s.sponsors
    .filter(d => d.status === 'active')
    .forEach(d => {
      const played = showsThisMonth(s);
      const dom = dateOfDay(s, today).getUTCDate();
      if (played < d.minShows && dom >= 18) out.push({ id: `sponsor-${d.id}`, tone: 'warn', text: `A sponsor expects ${d.minShows} shows this month; you've played ${played}.`, go: { kind: 'shows' } });
    });

  // Audits in the run-up (the council calls in September).
  if (dateOfDay(s, today).getUTCMonth() + 1 === 8) {
    s.depots.forEach(d => {
      const score = auditScore(s, d).total;
      if (score < PASS_SCORE) out.push({ id: `audit-${d.id}`, tone: 'warn', text: `The council audits in September and your ${city(d.cityId)} base would score about ${score}.`, go: { kind: 'depot', refId: d.id } });
    });
  }

  // Opportunities.
  const expiring = s.gigs.filter(g => g.status === 'offer' && g.acceptByDay - today <= 1 && g.acceptByDay >= today);
  if (expiring.length) out.push({ id: 'expiring', tone: 'info', text: `${expiring.length} offer${expiring.length === 1 ? '' : 's'} close${expiring.length === 1 ? 's' : ''} within a day.`, go: { kind: 'shows' } });
  const month = dateOfDay(s, today).getUTCMonth() + 1;
  if (month >= 1 && month <= 4 && !(s.ownFestival && s.ownFestival.year === yearOf(s, s.hour)) && s.depots.length && s.company.reputation >= 35) {
    out.push({ id: 'festival', tone: 'info', text: 'Planning for your own summer festival closes at the end of April.', go: { kind: 'market' } });
  }
  if (bestStageLevel(s) === 0 && s.company.reputation >= 45) {
    out.push({ id: 'stage', tone: 'info', text: 'Arena shows and tours need a rehearsal stage — add one at a warehouse (Base → Annexes).', go: { kind: 'depots' } });
  }

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

export const attentionCount = (alerts: Alert[]) => alerts.filter(a => a.tone !== 'info').length;
