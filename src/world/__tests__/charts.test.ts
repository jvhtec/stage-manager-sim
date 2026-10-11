import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { HOURS_PER_DAY } from '../catalog';
import { biggestTours, yearEndCharts } from '../charts';
import type { Gig, TycoonState } from '../types';

describe('year-end charts', () => {
  it('names the biggest tours of the year from the touring acts', () => {
    const t = biggestTours('GB', 1985);
    expect(t.length).toBeGreaterThan(0);
    expect(t[0].tier).toBeGreaterThanOrEqual(t[t.length - 1].tier);
  });

  const withShows = (): TycoonState => {
    const s = createTycoonGame({ companyName: 'Press', color: '#f00', seed: 7, country: 'GB', startYear: 1985 });
    const venue = s.gigs[0]?.venueId ?? 'v';
    const mk = (id: string, act: string, status: 'done' | 'failed', quality: number): Gig =>
      ({ id, act, venueId: venue, cityId: s.company.hqCityId, tier: 1, day: 100, status, result: { quality, payout: 1000, lateHours: 0, gearCoverage: 1, crewCoverage: 1 } }) as unknown as Gig;
    s.gigs.push(mk('a', 'Queen', 'done', 0.97), mk('b', 'Local Band', 'failed', 0.2));
    s.yearStats[1985] = { shows: 20, failed: 1, qualitySum: 17, festivals: 0, festivalQualitySum: 0, tours: 0, worldTours: 0 };
    return s;
  };

  it('prints a chart, a rave and a panning, and moves reputation a little', () => {
    const s = withShows();
    const before = s.company.reputation;
    const chart = yearEndCharts(s, 1985)!;
    expect(chart.rank).toBeGreaterThanOrEqual(1);
    expect(chart.table.some(r => r.you)).toBe(true);
    expect(chart.rave?.act).toBe('Queen');
    expect(chart.pan?.act).toBe('Local Band');
    expect(Math.abs(s.company.reputation - before)).toBeLessThan(2);
    expect(s.news.some(n => n.text.includes('supplier chart'))).toBe(true);
    // Idempotent.
    expect(yearEndCharts(s, 1985)).toBeUndefined();
    expect(s.charts).toHaveLength(1);
  });

  it('lands on New Year\'s Day in a running game', () => {
    let s = withShows();
    s.company.cash = 50_000_000;
    s = advanceHours(s, 366 * HOURS_PER_DAY);
    expect(s.charts?.some(c => c.year === 1985)).toBe(true);
  });
});
