import { describe, expect, it } from 'vitest';
import { runBot, STRATEGIES } from '../__bench__/bot';
import { explain, renderReport } from '../__bench__/report';

describe('balance bot and reports', () => {
  it('is deterministic, keeps the invariants, and explains its result', () => {
    const run = { country: 'GB' as const, startYear: 1995, years: 1, seed: 5, strategy: STRATEGIES.managed };
    const a = runBot(run);
    const b = runBot(run);
    expect(a.value).toBe(b.value);
    expect(a.shows).toBe(b.shows);
    expect(a.invariantViolations).toEqual([]);
    expect(a.shows).toBeGreaterThan(0);
    const lines = explain(a);
    expect(lines.some(l => /Operating margin/.test(l))).toBe(true);
    expect(lines.some(l => /Rivals \(same rules\)/.test(l))).toBe(true);
    const md = renderReport([a], [STRATEGIES.managed], { years: 1, runs: 'GB 1995, seed 5' });
    expect(md).toMatch(/\| Managed company \|/);
  }, 60_000);

  it('strategies differ in what they do', () => {
    const managed = runBot({ country: 'GB', startYear: 1995, years: 2, seed: 6, strategy: STRATEGIES.managed });
    const reckless = runBot({ country: 'GB', startYear: 1995, years: 2, seed: 6, strategy: STRATEGIES.reckless });
    // The corner-cutter never meets a rider, fixes a room, refurbishes, pushes for terms, reads the
    // forecast or its post-mortems; the managed company does at least some of that.
    const managing = (r: typeof managed) => r.bot.crossHires + r.bot.fixes + r.bot.refurbished + r.bot.termsAsked + r.bot.lessons.length + r.forecastWarnings;
    expect(managing(reckless)).toBe(0);
    expect(managing(managed)).toBeGreaterThan(0);
  }, 60_000);
});
