/**
 * Cause and effect you can read back. Nothing here rolls a random disaster: it records the
 * conditions that led to one. A late invoice leaves cash short, cash short defers a service, a
 * skipped service makes a breakdown likelier, the breakdown makes the load-in late, and the post-mortem
 * names the whole chain. The log is kept so any bad night can answer "why did that happen?".
 */
import { SERVICE_INTERVAL_DAYS, HOURS_PER_DAY } from './catalog';
import { formatMoney, newId, pushNews, vehicleAgeYears } from './core';
import { getModel } from './catalog';
import { owed } from './receivables';
import type { Cause, Gig, Incident, TycoonState, Vehicle } from './types';

const MAX_INCIDENTS = 80;
/** Cash below this many times a bill, and the bill gets put off. */
const RESERVE_MULTIPLE = 4;

export const incidentsOf = (s: Pick<TycoonState, 'incidents'>) => s.incidents ?? [];

export function logIncident(s: TycoonState, inc: Omit<Incident, 'id' | 'hour'>): Incident {
  const full: Incident = { id: newId(s, 'inc'), hour: s.hour, ...inc, causes: [...inc.causes].sort((a, b) => b.weight - a.weight) };
  s.incidents = [...incidentsOf(s), full].slice(-MAX_INCIDENTS);
  return full;
}

export const findIncident = (s: Pick<TycoonState, 'incidents'>, id: string | undefined) => incidentsOf(s).find(i => i.id === id);

/** Why money is tight right now: invoices not yet paid, and how late they are. */
export function squeezeCauses(s: TycoonState): Cause[] {
  const causes: Cause[] = [];
  const unpaid = owed(s);
  if (unpaid > 0) {
    const late = s.receivables.filter(i => i.slipped);
    const lateSum = late.reduce((a, i) => a + i.amount, 0);
    causes.push({
      id: 'unpaid-invoices',
      label: late.length ? 'Promoters paying late' : 'Money tied up in invoices',
      detail: `${formatMoney(s, unpaid)} is owed to you across ${s.receivables.length} invoice${s.receivables.length === 1 ? '' : 's'}${late.length ? `, ${formatMoney(s, lateSum)} of it already late` : ''}.`,
      weight: Math.min(1, unpaid / Math.max(1, unpaid + Math.max(0, s.company.cash))) * (late.length ? 1 : 0.7),
    });
  }
  if (s.company.loan > 0) causes.push({ id: 'loan', label: 'Debt service', detail: `A ${formatMoney(s, s.company.loan)} loan takes interest every month.`, weight: 0.25 });
  if (s.company.cash < 0) causes.push({ id: 'overdrawn', label: 'Overdrawn', detail: `The account is ${formatMoney(s, -s.company.cash)} in the red.`, weight: 0.6 });
  const recent = s.vehicles.filter(v => v.owner === 'player' && v.profitLastYear < 0).length;
  if (recent) causes.push({ id: 'losing-trucks', label: 'Trucks losing money', detail: `${recent} vehicle${recent === 1 ? '' : 's'} lost money last year.`, weight: 0.2 });
  if (!causes.length) causes.push({ id: 'thin-cash', label: 'Thin cash', detail: `Only ${formatMoney(s, Math.max(0, s.company.cash))} in the bank.`, weight: 0.5 });
  return causes;
}

/** Is there enough in the bank to pay `cost` without dipping into the reserve? */
export const canAfford = (s: TycoonState, cost: number) => s.company.cash >= cost * RESERVE_MULTIPLE;

// ---------------------------------------------------------------------------
// Deferred maintenance
// ---------------------------------------------------------------------------

/** A truck is due its service and there isn't the cash: it goes back out unserviced. */
export function deferService(s: TycoonState, v: Vehicle) {
  if (v.serviceSkipped) return;
  const causes = squeezeCauses(s);
  const inc = logIncident(s, {
    kind: 'cash',
    title: `Service deferred: ${v.name}`,
    vehicleId: v.id,
    causes,
    outcome: `${v.name} stays on the road past its service interval, so it will be less reliable.`,
  });
  v.serviceSkipped = { hour: s.hour, incidentId: inc.id };
  pushNews(s, `Cash is short, so ${v.name}'s service has been put off (${causes[0].detail}) It will be less reliable until you pay for it.`, 'bad', { vehicleId: v.id });
}

export const serviceCleared = (v: Vehicle) => {
  v.serviceSkipped = undefined;
};

/** Days past the service interval. */
export const overdueDays = (s: TycoonState, v: Vehicle) => Math.max(0, Math.floor((s.hour - v.lastServiceHour) / HOURS_PER_DAY) - SERVICE_INTERVAL_DAYS);

/** Extra reliability lost per day while a service is being put off. */
export const OVERDUE_DECAY = 0.12;

/** The monthly workshop bill can't be paid, so the benches stand idle. */
export function deferWorkshop(s: TycoonState, cost: number): boolean {
  if (cost <= 0) {
    if (s.lapses?.workshop) s.lapses = { ...s.lapses, workshop: undefined };
    return false;
  }
  if (canAfford(s, cost)) {
    s.lapses = { ...s.lapses, workshop: undefined };
    return false;
  }
  if (!s.lapses?.workshop) {
    const causes = squeezeCauses(s);
    const inc = logIncident(s, {
      kind: 'cash',
      title: 'Workshop bill deferred',
      causes,
      outcome: 'No repairs this month: worn kit stays worn and is likelier to fail on the night.',
    });
    s.lapses = { ...s.lapses, workshop: { hour: s.hour, incidentId: inc.id } };
    pushNews(s, `You can't cover the ${formatMoney(s, cost)} workshop bill: the benches stand idle and worn kit stays worn (${causes[0].detail})`, 'bad');
  }
  return true;
}

export const workshopLapsed = (s: Pick<TycoonState, 'lapses'>) => !!s.lapses?.workshop;

// ---------------------------------------------------------------------------
// Breakdowns
// ---------------------------------------------------------------------------

export function breakdownCauses(s: TycoonState, v: Vehicle, winter: boolean): Cause[] {
  const model = getModel(v.modelId);
  const causes: Cause[] = [];
  const over = overdueDays(s, v);
  if (over > 0) {
    causes.push({
      id: 'overdue',
      label: 'Service overdue',
      detail: `${v.name} is ${over} days past its ${SERVICE_INTERVAL_DAYS}-day service${v.serviceSkipped ? ', put off when cash ran short' : ''}.`,
      weight: Math.min(1, 0.35 + over / 60),
      link: v.serviceSkipped?.incidentId,
    });
  }
  const age = vehicleAgeYears(v, s.hour);
  if (age > model.lifespanYears) causes.push({ id: 'old', label: 'Past its working life', detail: `${v.name} is ${Math.floor(age)} years old; the ${model.name} is built for ${model.lifespanYears}.`, weight: Math.min(0.8, 0.3 + (age - model.lifespanYears) * 0.1) });
  if (v.reliability < model.reliability - 20) causes.push({ id: 'worn', label: 'Worn out', detail: `Reliability is down to ${Math.round(v.reliability)}% against ${model.reliability}% new.`, weight: Math.min(0.7, (model.reliability - v.reliability) / 100) });
  if (winter) causes.push({ id: 'winter', label: 'Winter roads', detail: 'Cold and snow on the high roads.', weight: 0.2 });
  if (!causes.length) causes.push({ id: 'bad-luck', label: 'Just unlucky', detail: `${v.name} was serviced and sound; it happens.`, weight: 0.1 });
  return causes;
}

export function recordBreakdown(s: TycoonState, v: Vehicle, winter: boolean): Incident {
  const causes = breakdownCauses(s, v, winter);
  const gigs = v.orders.map(id => s.gigs.find(g => g.id === id)).filter((g): g is Gig => !!g && g.status === 'booked');
  const inc = logIncident(s, {
    kind: 'breakdown',
    title: `${v.name} broke down`,
    vehicleId: v.id,
    gigId: gigs[0]?.id,
    causes,
    outcome: gigs.length ? `A show was waiting on it: ${gigs[0].act}.` : 'No show was waiting on it.',
  });
  gigs.forEach(g => (g.trouble = [...(g.trouble ?? []), { id: `breakdown-${inc.id}`, label: 'Truck broke down on the way', detail: `${v.name}: ${causes[0].label.toLowerCase()}.`, weight: 0.7, link: inc.id }]));
  return inc;
}

// ---------------------------------------------------------------------------
// Post-mortems
// ---------------------------------------------------------------------------

export interface NightFacts {
  lateHours: number;
  failedKit: string[];
  avgCondition: number;
  crewCoverage: number;
  crewFatigue: number;
  forgotten: number;
  unrehearsed: boolean;
  missingTickets: number;
  venueNotes: string[];
  breaches?: string[];
  production?: string[];
  feuds?: string[];
  slowLoad?: string;
  present: boolean;
  workshop: string;
  noKit: boolean;
}

/** Turn what happened on the night into causes, then fold in anything noted on the way. */
export function nightCauses(s: TycoonState, gig: Gig, f: NightFacts): Cause[] {
  const causes: Cause[] = [...(gig.trouble ?? [])];
  if (!f.present) causes.push({ id: 'no-show', label: 'Nobody arrived', detail: 'No vehicle with the kit reached the venue before the doors.', weight: 1 });
  if (f.lateHours > 0 && f.present) {
    const broke = causes.find(c => c.label.startsWith('Truck broke'));
    causes.push({ id: 'late', label: `Load-in ${f.lateHours.toFixed(1)}h late`, detail: broke ? 'The breakdown ate the load-in window.' : 'The truck was not there when the venue opened.', weight: Math.min(0.9, 0.3 + f.lateHours / 10), link: broke?.link });
  }
  if (f.failedKit.length) {
    const lapsed = workshopLapsed(s);
    causes.push({
      id: 'kit-failed',
      label: `${f.failedKit.join(' and ')} died on stage`,
      detail: `The kit averaged ${Math.round(f.avgCondition)}% condition${lapsed ? '; the workshop bill had been deferred' : f.workshop === 'none' ? '; there is no workshop' : ''}.`,
      weight: Math.min(0.9, 0.35 + (75 - Math.min(75, f.avgCondition)) / 100),
      link: s.lapses?.workshop?.incidentId,
    });
  } else if (f.avgCondition < 60) {
    causes.push({ id: 'kit-worn', label: 'Tired kit', detail: `The rig averaged ${Math.round(f.avgCondition)}% condition.`, weight: 0.25 });
  }
  if (f.crewCoverage < 0.9) causes.push({ id: 'short-crew', label: 'Short-handed', detail: `Crew covered ${Math.round(f.crewCoverage * 100)}% of what the show needed.`, weight: Math.min(0.8, (1 - f.crewCoverage) * 1.2) });
  if (f.crewFatigue >= 55) causes.push({ id: 'tired-crew', label: 'Exhausted crew', detail: `Average fatigue was ${Math.round(f.crewFatigue)}%, from back-to-back jobs and long drives.`, weight: Math.min(0.7, (f.crewFatigue - 40) / 80) });
  if (f.forgotten) causes.push({ id: 'prep', label: 'Kit left behind', detail: `${f.forgotten} case${f.forgotten === 1 ? '' : 's'} stayed on the warehouse floor: prep was too thin.`, weight: 0.3 });
  if (f.unrehearsed) causes.push({ id: 'unrehearsed', label: 'Not rehearsed', detail: 'A show this size should have had a rehearsal.', weight: 0.3 });
  if (f.missingTickets) causes.push({ id: 'tickets', label: 'Uncertified crew', detail: `${f.missingTickets} ticket${f.missingTickets === 1 ? '' : 's'} short, so the inspectors were not happy.`, weight: 0.25 });
  if (f.slowLoad) causes.push({ id: 'slow-load', label: 'Slow load-in', detail: f.slowLoad, weight: 0.4 });
  (f.feuds ?? []).forEach((p, i) => causes.push({ id: `feud-${i}`, label: 'Crew at loggerheads', detail: `${p} were on the same crew and it showed.`, weight: 0.3 }));
  (f.production ?? []).forEach((b, i) => causes.push({ id: `room-${i}`, label: 'The production didn’t fit the room', detail: b, weight: 0.45 }));
  (f.breaches ?? []).forEach((b, i) => causes.push({ id: `rider-${i}`, label: 'Rider broken', detail: b, weight: 0.55 }));
  f.venueNotes.forEach((n, i) => causes.push({ id: `venue-${i}`, label: 'The venue', detail: n.charAt(0).toUpperCase() + n.slice(1) + '.', weight: 0.25 }));
  return causes;
}

const TROUBLE_QUALITY = 0.7;

/** Log a post-mortem when a night went badly or had trouble; returns the sentence to append to the news. */
export function postMortem(s: TycoonState, gig: Gig, where: string, quality: number, failed: boolean, causes: Cause[]): string {
  if (!failed && quality >= TROUBLE_QUALITY && !causes.some(c => c.weight >= 0.5)) return '';
  const real = causes.filter(c => c.id !== 'bad-luck');
  if (!real.length) return '';
  const inc = logIncident(s, {
    kind: 'show',
    title: `${gig.act} at ${where}`,
    gigId: gig.id,
    causes: real,
    outcome: `${failed ? 'Failed' : quality >= 0.9 ? 'Pulled off' : 'Rough night'}: ${Math.round(quality * 100)}%.`,
  });
  const top = inc.causes.slice(0, 3).map(c => c.label.toLowerCase());
  const chain = inc.causes[0].link ? ' It traces back: ' + chainText(s, inc.causes[0]) : '';
  return ` Why: ${top.join('; ')}.${chain}`;
}

/** Walk a cause's link back to where it started. */
export function chainText(s: TycoonState, cause: Cause): string {
  const parts: string[] = [];
  let link = cause.link;
  let guard = 0;
  while (link && guard++ < 4) {
    const inc = findIncident(s, link);
    if (!inc) break;
    parts.push(inc.title.toLowerCase());
    link = inc.causes[0]?.link;
    if (!link && inc.causes[0]) parts.push(inc.causes[0].label.toLowerCase());
  }
  return parts.reverse().join(' → ') + '.';
}

/** What a bad night costs beyond reputation: the crew's mood and the act's goodwill. */
export function lastingConsequences(s: TycoonState, gig: Gig, quality: number, causes: Cause[]) {
  const tired = causes.find(c => c.id === 'tired-crew');
  const short = causes.find(c => c.id === 'short-crew');
  if ((tired || short) && quality < TROUBLE_QUALITY) s.crewMorale = Math.max(0, s.crewMorale - (tired ? 3 : 1.5));
  if (quality < 0.4) s.artistRelations[gig.act] = Math.max(0, (s.artistRelations[gig.act] ?? 0) - 2);
}
