import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { reputationAfterShow } from '../sim';
import { REP_MEMORY_DAYS, TIER_REP_CEILING, clientFees, monthlyReputation, noteShow, reputationSupport } from '../reputation';
import type { TycoonState } from '../types';

const game = (): TycoonState => createTycoonGame({ companyName: 'R', color: '#f00', seed: 4, country: 'GB', startYear: 1990 });

describe('reputation over time', () => {
  it('good shows climb with diminishing returns, capped by the venue tier', () => {
    let rep = 20;
    for (let i = 0; i < 500; i++) rep = reputationAfterShow(rep, 2, 0.9);
    expect(rep).toBe(TIER_REP_CEILING[2]);
    const early = reputationAfterShow(20, 3, 0.9) - 20;
    const late = reputationAfterShow(80, 3, 0.9) - 80;
    expect(early).toBeGreaterThan(late);
    expect(reputationAfterShow(100, 4, 1)).toBe(100);
  });

  it('bad shows cost more at bigger venues and never take it below zero', () => {
    expect(100 - reputationAfterShow(100, 4, 0.2)).toBeGreaterThan(100 - reputationAfterShow(100, 1, 0.2));
    expect(reputationAfterShow(0.5, 4, 0)).toBe(0);
  });

  it('a run of disasters brings a big name down, and steady good work brings it back', () => {
    let rep = 90;
    for (let i = 0; i < 10; i++) rep = reputationAfterShow(rep, 4, 0.25);
    expect(rep).toBeLessThan(70);
    let shows = 0;
    while (rep < 85 && shows < 1000) {
      rep = reputationAfterShow(rep, 4, 0.85);
      shows++;
    }
    expect(rep).toBeGreaterThanOrEqual(85);
    // It takes longer to win back than to lose.
    expect(shows).toBeGreaterThan(10);
  });

  it('the industry forgets: without recent big shows, reputation slides to what recent work supports', () => {
    const s = game();
    s.hour = 24 * (REP_MEMORY_DAYS + 30);
    s.company.reputation = 90;
    noteShow(s, { act: 'A', tier: 2, fee: 5000 }, 0.9);
    expect(reputationSupport(s)).toBe(TIER_REP_CEILING[2]);
    for (let m = 0; m < 36; m++) monthlyReputation(s);
    expect(s.company.reputation).toBeLessThan(75);
    expect(s.company.reputation).toBeGreaterThan(TIER_REP_CEILING[2] - 5);
  });

  it('at the top, regular arena work holds it; the fade alone is gentle', () => {
    const s = game();
    s.hour = 24 * (REP_MEMORY_DAYS + 30);
    s.company.reputation = 100;
    noteShow(s, { act: 'A', tier: 4, fee: 90000 }, 0.9);
    for (let m = 0; m < 12; m++) monthlyReputation(s);
    expect(s.company.reputation).toBeGreaterThan(97);
    expect(s.company.reputation).toBeLessThan(100);
  });

  it('a new company has its first year before the memory kicks in', () => {
    const s = game();
    s.company.reputation = 60;
    monthlyReputation(s);
    expect(s.company.reputation).toBe(60);
  });

  it('keeps two years of client fees', () => {
    const s = game();
    noteShow(s, { act: 'A', tier: 3, fee: 1000 }, 0.9);
    s.hour = 24 * 400;
    noteShow(s, { act: 'A', tier: 3, fee: 2000 }, 0.9);
    noteShow(s, { act: 'B', tier: 3, fee: 500 }, 0.9);
    expect(clientFees(s)).toEqual({ A: 3000, B: 500 });
    s.hour = 24 * 800;
    noteShow(s, { act: 'B', tier: 3, fee: 100 }, 0.9);
    expect(clientFees(s)).toEqual({ A: 2000, B: 600 });
    expect(Object.keys(s.clientFees!).length).toBe(2);
  });
});
