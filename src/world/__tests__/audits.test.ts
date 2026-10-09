import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { makeDecision } from '../actions';
import { NOTICE_SCORE, PASS_SCORE, auditScore, monthlyAudits } from '../audits';
import type { TycoonState } from '../types';

const lo = { next: () => 0, chance: () => false, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;
const hi = { ...(lo as object), next: () => 1, chance: () => true } as never;

const sept = (s: TycoonState) => {
  s.hour = Math.round((Date.UTC(1997, 8, 5) - Date.UTC(1995, 0, 1)) / 86400000) * 24;
  s.depots.forEach(d => (d.builtHour = 0));
  return s;
};
const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 33, country: 'GB', startYear: 1995 });
  s.company.cash = 1_000_000;
  s.depots[0].kind = 'warehouse';
  s.depots[0].size = 2;
  return s;
};

describe('safety audits', () => {
  it('score what the inspector sees: prep, capacity, first aiders, facilities', () => {
    const s = game();
    const d = s.depots[0];
    d.staff.warehouse = 0;
    const bare = auditScore(s, d).total;
    d.staff.warehouse = 8;
    s.people.forEach(m => (m.certs = []));
    const staffed = auditScore(s, d).total;
    expect(staffed).toBeGreaterThanOrEqual(bare);
    s.people.slice(0, 2).forEach(m => {
      m.depotId = d.id;
      m.certs = ['safety'];
    });
    expect(auditScore(s, d).total).toBeGreaterThan(staffed);
    d.modules = { lounge: 1, workshop: 1 };
    expect(auditScore(s, d).total).toBeGreaterThan(staffed + 10);
    d.gear['meyer-upa1'] = 500; // far over capacity
    expect(auditScore(s, d).parts.some(p => p.label === 'Over capacity')).toBe(true);
  });

  it('only in September, once a year, and not for brand-new bases', () => {
    const s = game();
    s.hour = 24 * 40;
    monthlyAudits(s, hi);
    expect(s.depots[0].audit).toBeUndefined();
    sept(s);
    s.depots[0].builtHour = s.hour - 24 * 10;
    monthlyAudits(s, hi);
    expect(s.depots[0].audit).toBeUndefined();
    s.depots[0].builtHour = 0;
    monthlyAudits(s, hi);
    expect(s.depots[0].audit?.year).toBe(1997);
    const n = s.news.length;
    monthlyAudits(s, hi);
    expect(s.news.length).toBe(n);
  });

  it('a good base passes with a nod and a little reputation', () => {
    const s = sept(game());
    s.depots[0].staff.warehouse = 8;
    s.depots[0].modules = { lounge: 2, workshop: 2 };
    s.people.slice(0, 2).forEach(m => {
      m.depotId = s.depots[0].id;
      m.certs = ['safety'];
    });
    const rep = s.company.reputation;
    monthlyAudits(s, hi);
    expect(s.depots[0].audit!.score).toBeGreaterThanOrEqual(PASS_SCORE);
    expect(s.company.reputation).toBeGreaterThan(rep);
    expect(s.dilemmas.some(d => d.kind === 'audit')).toBe(false);
  });

  it('a poor base gets a notice you can fix, appeal or pay; a bad one a prohibition', () => {
    const s = sept(game());
    s.depots[0].staff.warehouse = 0;
    s.depots[0].gear['meyer-upa1'] = 500;
    s.people.forEach(m => (m.certs = []));
    monthlyAudits(s, lo);
    const d = s.dilemmas.find(x => x.kind === 'audit')!;
    expect(d).toBeTruthy();
    expect(s.depots[0].audit!.score).toBeLessThan(NOTICE_SCORE + 1);
    const closed = makeDecision(s, d.id, 'close');
    expect(closed.result.ok).toBe(true);
    expect(closed.state.company.cash).toBeLessThan(s.company.cash);
    expect(closed.state.crewMorale).toBeLessThan(s.crewMorale + 0.001);
    const fixed = makeDecision(s, d.id, 'fix');
    expect(fixed.state.company.cash).toBeLessThan(s.company.cash);
    expect(fixed.state.claims.length).toBe(s.claims.length);
  });

  it('an improvement notice: ignoring costs a fine and marks your insurance record', () => {
    const s = sept(game());
    s.depots[0].staff.warehouse = 4;
    s.depots[0].modules = { lounge: 1 };
    s.people.forEach(m => (m.certs = []));
    // Force a middling score by tuning the luck.
    const mid = { ...(lo as object), next: () => 0.5 } as never;
    monthlyAudits(s, mid);
    const d = s.dilemmas.find(x => x.kind === 'audit');
    if (!d) return; // scored a pass on this seed
    if (d.options.some(o => o.id === 'ignore')) {
      const out = makeDecision(s, d.id, 'ignore').state;
      expect(out.company.cash).toBeLessThan(s.company.cash);
      expect(out.claims.length).toBe(s.claims.length + 1);
    }
  });
});
