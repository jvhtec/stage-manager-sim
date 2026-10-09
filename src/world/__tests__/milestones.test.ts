import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { HOURS_PER_DAY } from '../catalog';
import { MILESTONES, annualReport, buildReport, monthlyMilestones, unlock } from '../milestones';
import { buyRival } from '../actions';
import type { TycoonState } from '../types';

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'M', color: '#f00', seed: 25, country: 'GB', startYear: 1995 });
  return { ...s, company: { ...s.company, cash: 3_000_000 } };
};

describe('milestones', () => {
  it('tick off when their conditions are met, once', () => {
    const s = game();
    monthlyMilestones(s);
    expect(s.milestones.some(m => m.id === 'first-show')).toBe(false);
    s.stats.showsPlayed = 30;
    s.company.reputation = 55;
    monthlyMilestones(s);
    const ids = s.milestones.map(m => m.id);
    expect(ids).toEqual(expect.arrayContaining(['first-show', 'shows-25', 'rep-50']));
    expect(ids).not.toContain('shows-100');
    const n = s.milestones.length;
    monthlyMilestones(s);
    expect(s.milestones.length).toBe(n);
    expect(unlock(s, 'first-show')).toBe(false);
  });

  it('every milestone has a unique id and is reachable in principle', () => {
    expect(new Set(MILESTONES.map(m => m.id)).size).toBe(MILESTONES.length);
  });

  it('buying a rival unlocks the takeover milestone', () => {
    const s = game();
    s.company.reputation = 90;
    const r = s.rivals.find(x => x.reputation < 80)!;
    const out = buyRival(s, r.id);
    expect(out.result.ok).toBe(true);
    expect(out.state.milestones.some(m => m.id === 'takeover')).toBe(true);
  });
});

describe('annual report', () => {
  it('summarises the year from the books', () => {
    const s = game();
    s.ledger[1995] = { shows: 80000, wages: -30000, running: -10000, sales: 5000 };
    s.yearStats[1995] = { shows: 10, failed: 1, qualitySum: 8, festivals: 0, festivalQualitySum: 0, tours: 0, worldTours: 0 };
    const r = buildReport(s, 1995);
    expect(r.revenue).toBe(80000);
    expect(r.costs).toBe(40000);
    expect(r.net).toBe(40000);
    expect(r.shows).toBe(10);
    expect(r.avgQuality).toBeCloseTo(0.8);
    expect(r.rank).toBeGreaterThanOrEqual(1);
    expect(r.firms).toBe(s.rivals.length + 1);
  });

  it('lands at New Year in play, once, and unlocks profit-year', () => {
    const s = game();
    s.ledger[1995] = { shows: 5_000_000, wages: -20000 };
    s.yearStats[1995] = { shows: 5, failed: 0, qualitySum: 4, festivals: 0, festivalQualitySum: 0, tours: 0, worldTours: 0 };
    s.company.cash = 50_000_000;
    const out = advanceHours(s, 366 * HOURS_PER_DAY);
    expect(out.reports.filter(r => r.year === 1995)).toHaveLength(1);
    expect(out.reports[0].net).toBeGreaterThan(0);
    annualReport(out, 1995);
    expect(out.reports.filter(r => r.year === 1995)).toHaveLength(1);
    expect(out.milestones.some(m => m.id === 'profit-year')).toBe(true);
  });

  it('skips a year with nothing in it', () => {
    const s = game();
    annualReport(s, 1995);
    expect(s.reports).toHaveLength(0);
  });
});
