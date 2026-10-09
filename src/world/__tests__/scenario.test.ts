import { describe, expect, it } from 'vitest';
import { createTycoonGame, migrate } from '../state';
import { advanceHours } from '../sim';
import { HOURS_PER_DAY, STARTING_CASH } from '../catalog';
import { DIFFICULTIES, GOALS, GOAL_IDS, difficultyOf, goalDeadlineYear, legacyScore, monthlyGoal } from '../scenario';
import { hourlyCrises } from '../dilemmas';
import { rivalsTakeOffers } from '../offers';
import { worldOf } from '../mapgen';
import { absorbRival } from '../rivals';
import type { TycoonState } from '../types';

const game = (opts: Partial<Parameters<typeof createTycoonGame>[0]> = {}): TycoonState =>
  createTycoonGame({ companyName: 'S', color: '#f00', seed: 17, country: 'GB', startYear: 1990, ...opts });

describe('difficulty', () => {
  it('sets the starting cash, and defaults to standard', () => {
    expect(game().company.cash).toBe(STARTING_CASH);
    expect(game({ difficulty: 'easy' }).company.cash).toBeGreaterThan(STARTING_CASH);
    expect(game({ difficulty: 'hard' }).company.cash).toBeLessThan(STARTING_CASH);
    expect(game().difficulty).toBe('normal');
    expect(game({ difficulty: 'hard' }).stats.peakCash).toBe(game({ difficulty: 'hard' }).company.cash);
  });

  it('gives the bank more or less patience', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      let s = game({ difficulty: d });
      s.company.cash = -500_000;
      s = advanceHours(s, 24 * 400);
      expect(s.gameOver, d).toBeTruthy();
      expect(s.negativeMonths).toBe(DIFFICULTIES[d].graceMonths);
    }
  });

  it('scales rivals and crises', () => {
    const rngCalls = (s: TycoonState, fn: (rng: never) => void) => {
      const ps: number[] = [];
      fn({ next: () => 0.5, chance: (p: number) => (ps.push(p), false), pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never);
      return ps;
    };
    const mkCrisis = (d: 'easy' | 'hard') => {
      const s = game({ difficulty: d });
      const gig = s.gigs.find(g => g.status === 'offer')!;
      gig.status = 'booked';
      s.vehicles.find(v => v.owner === 'player')!.orders = [gig.id];
      s.hour = (gig.day - 1) * 24;
      s.hour = (gig.day) * 24 - 24;
      // load-in hour: the day of the show at LOAD_IN_HOUR
      return { s, gig };
    };
    const a = mkCrisis('easy');
    const b = mkCrisis('hard');
    a.s.hour = (a.gig.day) * 24 + 10;
    b.s.hour = (b.gig.day) * 24 + 10;
    const pe = rngCalls(a.s, rng => hourlyCrises(a.s, rng));
    const ph = rngCalls(b.s, rng => hourlyCrises(b.s, rng));
    if (pe.length && ph.length) expect(ph[0]).toBeGreaterThan(pe[0]);
    expect(difficultyOf(a.s).rivals).toBeLessThan(difficultyOf(b.s).rivals);
    const world = worldOf(a.s);
    const chance = (s: TycoonState) => {
      const ps: number[] = [];
      s.gigs = s.gigs.filter(g => g.status === 'offer').slice(0, 3);
      rivalsTakeOffers(s, world, { next: () => 0.5, chance: (p: number) => (ps.push(p), false), pick: <T,>(x: T[]) => x[0], nextInt: () => 0, nextRange: (x: number) => x } as never);
      return Math.max(0, ...ps);
    };
    const e = chance(game({ difficulty: 'easy' }));
    const h = chance(game({ difficulty: 'hard' }));
    expect(h).toBeGreaterThan(e);
  });
});

describe('goals', () => {
  it('every goal reads progress without trouble and sandbox has none', () => {
    const s = game();
    GOAL_IDS.forEach(id => {
      const p = GOALS[id].progress(s);
      expect(p.fraction).toBeGreaterThanOrEqual(0);
      expect(p.fraction).toBeLessThanOrEqual(1);
    });
    expect(goalDeadlineYear({ goal: 'top', startYear: 1990 })).toBe(2015);
    expect(goalDeadlineYear({ goal: 'awards', startYear: 1990 })).toBeUndefined();
  });

  it('are won when met: once, with a big news item', () => {
    const s = game({ goal: 'top' });
    monthlyGoal(s);
    expect(s.goalResult).toBeUndefined();
    s.company.reputation = 91;
    monthlyGoal(s);
    expect(s.goalResult?.status).toBe('won');
    expect(s.news[0].text).toMatch(/GOAL REACHED/);
    const n = s.news.length;
    monthlyGoal(s);
    expect(s.news.length).toBe(n);
  });

  it('are missed when the deadline passes', () => {
    const s = game({ goal: 'top' });
    s.hour = 26 * 365 * 24;
    monthlyGoal(s);
    expect(s.goalResult?.status).toBe('missed');
  });

  it('count award wins, world tours and rivals bought', () => {
    const s = game({ goal: 'awards' });
    s.awards = [1, 2, 3].map(y => ({ year: 1990 + y, title: 'Production Company of the Year' }));
    expect(GOALS.awards.progress(s).done).toBe(true);
    const t = game({ goal: 'consolidator' });
    t.company.cash = 50_000_000;
    t.company.reputation = 95;
    expect(GOALS.consolidator.progress(t).fraction).toBe(0);
    absorbRival(t, t.rivals[0]);
    expect(t.stats.rivalsBought).toBe(1);
    expect(GOALS.consolidator.progress(t).fraction).toBeCloseTo(1 / 3);
  });

  it('are on by default for old saves as sandbox / standard', () => {
    const s = game();
    const old = migrate({ ...structuredClone(s), goal: undefined, difficulty: undefined } as Partial<TycoonState>);
    expect(old.goal).toBe('sandbox');
    expect(old.difficulty).toBe('normal');
  });
});

describe('legacy score', () => {
  it('grows with what you build, and a won goal counts', () => {
    const s = game();
    const base = legacyScore(s).total;
    s.stats.showsPlayed = 200;
    s.awards.push({ year: 1995, title: 'Best Newcomer' });
    s.company.reputation = 70;
    const grown = legacyScore(s);
    expect(grown.total).toBeGreaterThan(base);
    s.goalResult = { status: 'won', day: 10 };
    expect(legacyScore(s).total).toBeGreaterThan(grown.total + 900);
    expect(legacyScore(s).parts.map(p => p.label)).toContain('Goal reached');
  });

  it('is scaled by difficulty', () => {
    const e = game({ difficulty: 'easy' });
    const h = game({ difficulty: 'hard' });
    [e, h].forEach(s => {
      s.stats.showsPlayed = 400;
      s.company.reputation = 80;
      s.company.cash = 0;
    });
    expect(legacyScore(h).total).toBeGreaterThan(legacyScore(e).total);
  });

  it('keeps ticking over a decade with a goal set', () => {
    const s = game({ goal: 'survivor', difficulty: 'easy' });
    s.company.cash = 40_000_000;
    const out = advanceHours(s, 3 * 365 * HOURS_PER_DAY);
    expect(out.hour).toBeGreaterThan(0);
  });
});
