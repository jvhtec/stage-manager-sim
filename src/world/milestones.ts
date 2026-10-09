/**
 * The long game: the annual report that lands every New Year, and a career
 * ladder of milestones — first show, first arena, first warehouse, your first
 * million. Milestones are only recognition; they don't move the economy.
 */
import { dayOf, formatMoney, pushNews, yearOf } from './core';
import { companyRating, rivalRating, yearStats } from './awards';
import { levelOf } from './people';
import { companyValue } from './queries';
import { FEST_TIERS } from './ownfest';
import type { AnnualReport, TycoonState } from './types';

export interface Milestone {
  id: string;
  label: string;
  blurb: string;
  done: (s: TycoonState) => boolean;
}

const players = (s: TycoonState) => s.vehicles.filter(v => v.owner === 'player');
const gigsDone = (s: TycoonState) => s.gigs.filter(g => g.status === 'done');

export const MILESTONES: Milestone[] = [
  { id: 'first-show', label: 'Curtain up', blurb: 'Play your first show.', done: s => s.stats.showsPlayed >= 1 },
  { id: 'shows-25', label: 'Regulars', blurb: 'Play 25 shows.', done: s => s.stats.showsPlayed >= 25 },
  { id: 'shows-100', label: 'Centurion', blurb: 'Play 100 shows.', done: s => s.stats.showsPlayed >= 100 },
  { id: 'shows-500', label: 'Road dogs', blurb: 'Play 500 shows.', done: s => s.stats.showsPlayed >= 500 },
  { id: 'fleet-5', label: 'A proper fleet', blurb: 'Run five vehicles.', done: s => players(s).length >= 5 },
  { id: 'fleet-15', label: 'Convoy', blurb: 'Run fifteen vehicles.', done: s => players(s).length >= 15 },
  { id: 'second-base', label: 'Branching out', blurb: 'Open a second base.', done: s => s.depots.length >= 2 },
  { id: 'five-bases', label: 'National network', blurb: 'Run five bases.', done: s => s.depots.length >= 5 },
  { id: 'big-warehouse', label: 'Proper depot', blurb: 'Grow a warehouse to size 3.', done: s => s.depots.some(d => d.kind === 'warehouse' && d.size >= 3) },
  { id: 'tour', label: 'Out on tour', blurb: 'Complete a national tour.', done: s => s.tours.some(t => t.status === 'done') },
  { id: 'world-tour', label: 'Round the world', blurb: 'Complete a world tour.', done: s => s.tours.some(t => t.status === 'done' && t.kind === 'world') },
  { id: 'own-festival', label: 'Headline promoter', blurb: 'Put on a sold-out festival of your own.', done: s => s.festivalHistory.some(e => e.attendance >= FEST_TIERS[e.tier].capacity * 0.9) },
  { id: 'sponsored', label: 'Brand name', blurb: 'Sign a brand sponsor.', done: s => s.sponsors.some(d => d.status === 'active') },
  { id: 'good-cause', label: 'Good cause', blurb: 'Put on a charity show.', done: s => (s.charityDone ?? 0) >= 1 },
  { id: 'campus', label: 'Production campus', blurb: 'Grow a warehouse to a production campus.', done: s => s.depots.some(d => d.kind === 'warehouse' && d.size >= 4) },
  { id: 'soundstage', label: 'Soundstage', blurb: 'Build a rehearsal stage and rehearse a show.', done: s => s.gigs.some(g => !!g.rehearsed) },
  { id: 'landlord', label: 'Landlord', blurb: 'Own a venue.', done: s => s.ownedVenues.length >= 1 },
  { id: 'festival', label: 'Mud and glory', blurb: 'Deliver a festival stage.', done: s => gigsDone(s).some(g => g.festival) },
  { id: 'event', label: 'Live to the world', blurb: 'Deliver a special event lot.', done: s => gigsDone(s).some(g => g.event) },
  { id: 'house-rig', label: 'House supplier', blurb: 'Hold a venue’s house contract.', done: s => s.contracts.some(c => c.status === 'active') },
  { id: 'deal', label: 'Exclusive', blurb: 'Sign a production deal with an act.', done: s => s.deals.some(d => d.status === 'active') },
  { id: 'rnd', label: 'In-house design', blurb: 'Build your own product.', done: s => s.ownProducts.length >= 1 },
  { id: 'takeover', label: 'Hostile? Friendly.', blurb: 'Buy out a rival.', done: s => s.milestones.some(m => m.id === 'takeover') },
  { id: 'star-crew', label: 'A five-star tech', blurb: 'Grow a 5★ crew member.', done: s => s.people.some(m => levelOf(m) >= 5) },
  { id: 'crew-25', label: 'A big family', blurb: 'Employ 25 technicians.', done: s => s.people.length >= 25 },
  { id: 'rep-50', label: 'Known name', blurb: 'Reach reputation 50.', done: s => s.company.reputation >= 50 },
  { id: 'rep-80', label: 'Industry giant', blurb: 'Reach reputation 80.', done: s => s.company.reputation >= 80 },
  { id: 'award', label: 'Silverware', blurb: 'Win an industry award.', done: s => s.awards.length >= 1 },
  { id: 'profit-year', label: 'In the black', blurb: 'Close a year in profit.', done: s => s.reports.some(r => r.net > 0) },
  { id: 'million', label: 'Seven figures', blurb: 'Be worth a million.', done: s => companyValue(s) >= 1_000_000 },
  { id: 'ten-million', label: 'Eight figures', blurb: 'Be worth ten million.', done: s => companyValue(s) >= 10_000_000 },
  { id: 'decade', label: 'Ten years on the road', blurb: 'Survive a decade in business.', done: s => s.hour / (24 * 365) >= 10 },
];

/** Mutating: record a milestone (idempotent). */
export function unlock(s: TycoonState, id: string) {
  if (s.milestones.some(m => m.id === id)) return false;
  const m = MILESTONES.find(x => x.id === id);
  s.milestones.push({ id, day: dayOf(s.hour) });
  if (m && s.hour > 24) pushNews(s, `🏁 Milestone: ${m.label} — ${m.blurb.replace(/\.$/, '')}.`, 'big');
  return true;
}

/** Monthly: tick off whatever's been achieved. */
export function monthlyMilestones(s: TycoonState) {
  MILESTONES.forEach(m => {
    if (!s.milestones.some(x => x.id === m.id) && m.done(s)) unlock(s, m.id);
  });
}

/** The year's books, as the bank would see them. */
export function buildReport(s: TycoonState, year: number): AnnualReport {
  const ledger = s.ledger[year] ?? {};
  let revenue = 0;
  let costs = 0;
  (Object.keys(ledger) as (keyof typeof ledger)[]).forEach(c => {
    const v = ledger[c] ?? 0;
    if (c === 'sales' || c === 'equity') return; // selling assets or shares isn't trading
    if (v > 0) revenue += v;
    else costs -= v;
  });
  const y = yearStats(s, year);
  const rating = companyRating(s, year).total;
  const scores = s.rivals.map(r => rivalRating(r.reputation, r.showsPlayed + year));
  const rank = 1 + scores.filter(sc => sc > rating).length;
  const done = s.gigs.filter(g => g.status === 'done' && g.result && g.day >= 0 && yearOf(s, g.day * 24) === year);
  const best = [...done].sort((a, b) => (b.result?.quality ?? 0) - (a.result?.quality ?? 0))[0];
  return {
    year,
    revenue: Math.round(revenue),
    costs: Math.round(costs),
    net: Math.round(revenue - costs),
    cash: Math.round(s.company.cash),
    value: companyValue(s),
    shows: y.shows,
    failed: y.failed,
    avgQuality: y.shows ? y.qualitySum / y.shows : 0,
    rating,
    rank,
    firms: s.rivals.length + 1,
    reputation: Math.round(s.company.reputation),
    fleet: players(s).length,
    crew: s.people.length,
    best: best ? { act: best.act, quality: best.result!.quality } : undefined,
  };
}

/** New Year: close the books, compare with last year and tell the player. */
export function annualReport(s: TycoonState, year: number) {
  if (s.reports.some(r => r.year === year)) return;
  const y = yearStats(s, year);
  if (!y.shows && !y.failed && !Object.keys(s.ledger[year] ?? {}).length) return;
  const report = buildReport(s, year);
  const last = s.reports.find(r => r.year === year - 1);
  s.reports.push(report);
  s.reports = s.reports.slice(-40);
  const delta = last ? ` (${report.net >= last.net ? '▲' : '▼'} from ${formatMoney(s, last.net)})` : '';
  pushNews(
    s,
    `📊 ${year} annual report: ${report.shows} shows at ${Math.round(report.avgQuality * 100)}% average, net ${formatMoney(s, report.net)}${delta}, ranked ${report.rank} of ${report.firms}.`,
    report.net >= 0 ? 'good' : 'bad',
  );
}
