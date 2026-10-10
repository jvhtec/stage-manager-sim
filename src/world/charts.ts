/**
 * The trade press, every New Year: the supplier league table for the year just gone, the year's
 * biggest tours (and whether you carried any of them), and reviews of your best and worst nights.
 * A rave or a panning moves your name a little; the chart itself is bragging rights.
 */
import { pushNews, yearOf } from './core';
import { companyRating, rivalRating, yearStats } from './awards';
import { ARTISTS, artistTierIn } from './content/artists';
import type { Gig, TycoonState, YearChart } from './types';

const RAVE_QUALITY = 0.9;
const PAN_QUALITY = 0.55;
const RAVE_REPUTATION = 0.4;
const PAN_REPUTATION = 0.4;
const TOUR_REPUTATION = 0.3;
const MAX_CHARTS = 20;

const RAVES = [
  'A triumph — every cue on the beat.',
  'The sound alone was worth the ticket.',
  'Flawless production from curtain-up to encore.',
  'A rig that let the band be the star.',
];
const PANS = [
  'A shambles — the PA had its own opinions.',
  'Late, loud in the wrong places and short on kit.',
  'The crowd came for the band and left talking about the sound.',
  'A night the promoter will not forget, for the wrong reasons.',
];
const pick = <T,>(list: T[], key: string) => list[[...key].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % list.length];

/** The year's biggest tours in this market: the acts at the top venue tier that year. */
export function biggestTours(country: string, year: number, n = 5): { act: string; tier: number }[] {
  const rows = ARTISTS.filter(a => !a.country || a.country === country)
    .map(a => ({ act: a.name, tier: artistTierIn(a, year) }))
    .filter(r => r.tier > 0)
    .sort((a, b) => b.tier - a.tier || a.act.localeCompare(b.act));
  return rows.slice(0, n);
}

const doneIn = (s: TycoonState, year: number): Gig[] =>
  s.gigs.filter(g => (g.status === 'done' || g.status === 'failed') && g.day >= 0 && yearOf(s, g.day * 24) === year);

/** New Year's Day: compile the charts for `year`, post them to the news and apply the press's verdict. */
export function yearEndCharts(s: TycoonState, year: number): YearChart | undefined {
  if (s.charts?.some(c => c.year === year)) return;
  const y = yearStats(s, year);
  if (!y.shows && !y.failed) return;

  const rating = companyRating(s, year).total;
  const table = [
    { name: s.company.name, score: rating, you: true },
    ...s.rivals.map(r => ({ name: r.name, score: rivalRating(r.reputation, r.showsPlayed + year), you: false })),
  ].sort((a, b) => b.score - a.score);
  const rank = table.findIndex(r => r.you) + 1;

  const tours = biggestTours(s.country, year);
  const gigs = doneIn(s, year);
  const carried = tours.filter(t => gigs.some(g => g.status === 'done' && g.act === t.act));

  const played = gigs.filter(g => g.status === 'done' && g.result);
  const best = [...played].sort((a, b) => b.result!.quality - a.result!.quality)[0];
  const failed = gigs.find(g => g.status === 'failed');
  const low = [...played].sort((a, b) => a.result!.quality - b.result!.quality)[0];
  const worst = failed ?? (low && low.result!.quality < PAN_QUALITY ? low : undefined);

  const chart: YearChart = {
    year,
    rank,
    firms: table.length,
    table: table.slice(0, 10).map(r => ({ name: r.name, score: r.score, you: r.you || undefined })),
    tours: tours.map(t => ({ ...t, yours: carried.some(c => c.act === t.act) || undefined })),
  };
  if (best && best.result!.quality >= RAVE_QUALITY) chart.rave = { act: best.act, quality: best.result!.quality, text: pick(RAVES, best.id) };
  if (worst) chart.pan = { act: worst.act, quality: worst.result?.quality ?? 0, text: pick(PANS, worst.id) };

  const rep = (chart.rave ? RAVE_REPUTATION : 0) - (chart.pan ? PAN_REPUTATION : 0) + Math.min(3, carried.length) * TOUR_REPUTATION;
  s.company.reputation = Math.max(0, Math.min(100, s.company.reputation + rep));

  s.charts = [...(s.charts ?? []), chart].slice(-MAX_CHARTS);
  const top = table[0];
  pushNews(
    s,
    `📈 ${year} supplier chart: ${top.you ? 'you top the table' : `${top.name} top the table, you are ${rank} of ${table.length}`}.${carried.length ? ` You carried ${carried.map(c => c.act).join(' and ')}, among the year's biggest tours.` : ''}`,
    rank <= 3 ? 'good' : 'info',
  );
  if (chart.rave) pushNews(s, `⭐ Review: ${chart.rave.act} — “${chart.rave.text}” The trade press credits ${s.company.name}.`, 'good');
  if (chart.pan) pushNews(s, `📰 Review: ${chart.pan.act} — “${chart.pan.text}” ${s.company.name} takes the blame.`, 'bad');
  return chart;
}
