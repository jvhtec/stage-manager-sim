/**
 * Keeping score. A company rating (0-1000, à la Transport Tycoon's
 * performance rating) from how your last year went, and an industry awards
 * night every January for the year just gone — which raises your standing.
 */
import { book, formatMoney, pushNews } from './core';
import type { CountryCode } from './content/countries';
import type { TycoonState, YearStats } from './types';

const emptyYear = (): YearStats => ({ shows: 0, failed: 0, qualitySum: 0, festivals: 0, festivalQualitySum: 0, tours: 0, worldTours: 0 });

export function yearStats(state: TycoonState, year: number): YearStats {
  return state.yearStats[year] ?? emptyYear();
}

export function recordShow(s: TycoonState, year: number, quality: number, failed: boolean, festival: boolean) {
  const y = (s.yearStats[year] ??= emptyYear());
  if (failed) y.failed += 1;
  else {
    y.shows += 1;
    y.qualitySum += quality;
  }
  if (festival && !failed) {
    y.festivals += 1;
    y.festivalQualitySum += quality;
  }
}

export function recordEvent(s: TycoonState, year: number, quality: number) {
  const y = (s.yearStats[year] ??= emptyYear());
  y.events = (y.events ?? 0) + 1;
  y.eventQualitySum = (y.eventQualitySum ?? 0) + quality;
}

export function recordTour(s: TycoonState, year: number, world: boolean) {
  const y = (s.yearStats[year] ??= emptyYear());
  y.tours += 1;
  if (world) y.worldTours += 1;
}

const yearProfit = (state: TycoonState, year: number) =>
  Object.entries(state.ledger[year] ?? {}).reduce((a, [c, v]) => (c === 'equity' || c === 'tax' ? a : a + (v ?? 0)), 0);

export interface RatingBreakdown {
  total: number;
  parts: { label: string; points: number; max: number }[];
}

/** 0-1000: quality, volume, reliability, standing, profit and the big jobs, over one year. */
export function companyRating(state: TycoonState, year: number): RatingBreakdown {
  const y = yearStats(state, year);
  const avgQ = y.shows ? y.qualitySum / y.shows : 0;
  const profit = yearProfit(state, year);
  const parts = [
    { label: 'Show quality', points: Math.round(Math.max(0, avgQ - 0.4) / 0.6 * 250), max: 250 },
    { label: 'Shows played', points: Math.min(150, y.shows * 2), max: 150 },
    { label: 'Reliability', points: Math.max(0, 100 - y.failed * 20), max: 100 },
    { label: 'Reputation', points: Math.round(state.company.reputation * 2), max: 200 },
    { label: 'Profit', points: Math.round(Math.min(200, Math.max(0, Math.log10(Math.max(1, profit)) - 3) * 66)), max: 200 },
    { label: 'Festivals, tours & events', points: Math.min(100, y.festivals * 15 + y.tours * 10 + y.worldTours * 15 + (y.events ?? 0) * 25), max: 100 },
  ];
  if (!y.shows && !y.failed) parts[2].points = 0;
  return { total: parts.reduce((s, p) => s + p.points, 0), parts };
}

/** Rivals don't keep books we can see; their rating follows their standing. */
export const rivalRating = (reputation: number, salt: number) => Math.round(reputation * 8.5 + (salt % 60));

const AWARDS_BODY: Partial<Record<CountryCode, [number, string][]>> = {
  US: [[2001, 'Parnelli Awards']],
  GB: [[2003, 'TPi Awards']], // verify first year
};

export function awardsName(country: CountryCode, year: number): string {
  return (AWARDS_BODY[country] ?? []).reduce((name, [from, n]) => (year >= from ? n : name), 'Live Production Awards');
}

const PRIZE_REPUTATION = 2.5;
const PRIZE_MONEY = 5000;

/** January 1st: the awards for the year just gone. */
export function awardsNight(s: TycoonState, year: number) {
  const y = yearStats(s, year);
  if (!y.shows && !y.failed) return;
  const body = awardsName(s.country, year + 1);
  const rating = companyRating(s, year).total;
  const best = [...s.rivals].map(r => ({ r, score: rivalRating(r.reputation, r.showsPlayed + year) })).sort((a, b) => b.score - a.score)[0];
  const wins: string[] = [];
  if (!best || rating > best.score) wins.push('Production Company of the Year');
  if (y.festivals >= 2 && y.festivalQualitySum / y.festivals >= 0.82) wins.push('Festival Supplier of the Year');
  if (y.tours >= 2) wins.push('Touring Company of the Year');
  if ((y.events ?? 0) >= 1 && (y.eventQualitySum ?? 0) / (y.events ?? 1) >= 0.85) wins.push('Special Event of the Year');
  const age = year - s.startYear;
  if (age <= 1 && y.shows >= 30 && y.qualitySum / y.shows >= 0.8) wins.push('Best Newcomer');

  wins.forEach(title => s.awards.push({ year, title }));
  if (wins.length) {
    s.company.reputation = Math.min(100, s.company.reputation + PRIZE_REPUTATION * wins.length);
    book(s, 'shows', PRIZE_MONEY * wins.length);
    pushNews(s, `🏆 ${body} ${year}: ${s.company.name} wins ${wins.join(', ')}! (company rating ${rating}; ${formatMoney(s, PRIZE_MONEY * wins.length)} in sponsorship)`, 'big');
  } else if (best) {
    pushNews(s, `${body} ${year}: ${best.r.name} is Production Company of the Year. Your rating: ${rating}.`, 'info');
  }
}
