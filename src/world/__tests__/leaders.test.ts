import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createTycoonGame } from '../state';
import { updateRivals } from '../sim';
import { getWorld } from '../mapgen';
import { RIVAL_COMPANIES, entryYear, rivalsFor } from '../content/companies';
import { STYLES, bossOf, leaderIn, pickWeighted, styleOf } from '../leaders';
import { aggression } from '../rivalry';
import { monthlyRivalOps, opsOf, rivalOverhead } from '../rivalOps';

const game = (country: 'ES' | 'GB' | 'US' | 'DE' | 'FR' | 'IT', startYear = 1990) =>
  createTycoonGame({ companyName: 'Test', color: '#ff0066', seed: 99, country, startYear });

describe('rival leaders', () => {
  it('lists each firm\'s bosses in order, with a known style', () => {
    RIVAL_COMPANIES.forEach(t => {
      const ls = t.leaders ?? [];
      ls.forEach((l, i) => {
        expect(STYLES[l.style], `${t.id}: ${l.name}`).toBeDefined();
        if (l.to !== undefined) expect(l.to).toBeGreaterThanOrEqual(l.from);
        if (i) expect(l.from, `${t.id}: ${l.name}`).toBeGreaterThan(ls[i - 1].to ?? ls[i - 1].from);
      });
    });
  });

  it('knows who is in charge in a given year', () => {
    const clair = RIVAL_COMPANIES.find(t => t.id === 'clair')!;
    expect(leaderIn(clair, 1980)?.name).toBe('Roy and Gene Clair');
    expect(leaderIn(clair, 2010)?.name).toBe('Troy Clair');
    expect(leaderIn(clair, 1960)).toBeUndefined();
    // A boss who left with nobody named after: back to a steady hand.
    const prg = RIVAL_COMPANIES.find(t => t.id === 'prg')!;
    expect(leaderIn(prg, 2023)).toBeUndefined();
    expect(styleOf({ id: 'prg' }, 2023).label).toBe('Steady');
    expect(styleOf({ id: 'prg' }, 2000).label).toBe('Dealmaker');
    // Startups get a style of their own, stable per firm.
    expect(bossOf({ id: 'rival-x1' }, 2000).style).toBe(bossOf({ id: 'rival-x1' }, 2010).style);
    expect(bossOf({ id: 'rival-x1' }, 2000).name).toBeUndefined();
  });

  it('gives each style a different way of playing', () => {
    expect(STYLES.dealmaker.buyer).toBeGreaterThan(STYLES.perfectionist.buyer);
    expect(STYLES.hustler.war).toBeGreaterThan(STYLES.perfectionist.war);
    expect(STYLES.perfectionist.fix).toBeGreaterThan(STYLES.hustler.fix);
    expect(STYLES.prudent.reinvest).toBeGreaterThan(STYLES.expansionist.reinvest);
    expect(STYLES.expansionist.take).toBeGreaterThan(STYLES.perfectionist.take);
    // Grudges shift with the boss but stay in range.
    RIVAL_COMPANIES.forEach(t => {
      [1980, 2000, 2020].forEach(y => {
        const a = aggression({ id: t.id }, y);
        expect(a).toBeGreaterThanOrEqual(0.1);
        expect(a).toBeLessThanOrEqual(1);
      });
    });
  });

  it('a prudent boss keeps more cash back before spending than an expansionist', () => {
    const s = game('GB', 1995);
    const spend = (id: string) => {
      const r = s.rivals.find(x => x.id === id)!;
      const ops = opsOf(s, r);
      ops.quality = 99; // kit is current: the spend goes on what's turning work away
      ops.record.declined = { trucks: 9 };
      ops.cash = rivalOverhead(ops) * 4.5; // 3.5 months left after this month's overhead
      const trucks = ops.trucks;
      monthlyRivalOps(s, r, createRng(1));
      return ops.trucks - trucks;
    };
    expect(styleOf({ id: 'negearth' }, 1995).label).toBe('Prudent');
    expect(styleOf({ id: 'delta' }, 1995).label).toBe('Expansionist');
    expect(spend('negearth')).toBe(0);
    expect(spend('delta')).toBe(1);
  });

  it('picks by weight', () => {
    const rng = createRng(5);
    const tally = { a: 0, b: 0 };
    for (let i = 0; i < 4000; i++) tally[pickWeighted(rng, ['a', 'b'] as const, x => (x === 'a' ? 3 : 1))!]++;
    expect(tally.a / 4000).toBeGreaterThan(0.7);
    expect(tally.a / 4000).toBeLessThan(0.8);
    expect(pickWeighted(rng, ['a'], () => 0)).toBeUndefined();
  });

  it('announces a change at the top', () => {
    const s = game('GB', 1985);
    s.hour = 24 * 400;
    const world = getWorld(s.mapSeed, 'GB');
    expect(s.rivals.find(r => r.id === 'britrow')!.boss).toBe('Bryan Grant and Robbie Williams');
    updateRivals(s, world, 1991);
    expect(s.rivals.find(r => r.id === 'britrow')!.boss).toBe('Bryan Grant and Mike Lowe');
    expect(s.news.some(n => n.text.startsWith('Bryan Grant and Mike Lowe take charge at Britannia Row'))).toBe(true);
  });
});

describe('when the international houses arrive', () => {
  it('opens foreign bases only from the year they really set up', () => {
    const clair = RIVAL_COMPANIES.find(t => t.id === 'clair')!;
    expect(entryYear(clair, 'US')).toBe(1966);
    expect(entryYear(clair, 'GB')).toBe(2008);
    expect(game('GB', 1990).rivals.some(r => r.id === 'clair')).toBe(false);
    expect(game('US', 1990).rivals.some(r => r.id === 'clair')).toBe(true);
  });

  it('uses the local base and entry story', () => {
    const s = game('GB', 2005);
    s.hour = 24 * 400;
    const world = getWorld(s.mapSeed, 'GB');
    // London if there's a lot free, otherwise the emptiest big town.
    const london = world.cities.find(c => c.name === 'London')!;
    s.rivals = s.rivals.filter(r => r.hqCityId !== london.id);
    updateRivals(s, world, 2008);
    const clair = s.rivals.find(r => r.id === 'clair')!;
    if (s.company.hqCityId !== london.id) expect(clair.hqCityId).toBe(london.id);
    expect(s.news.some(n => n.text.includes('Concert Sound'))).toBe(true);
  });

  it('brings the foreign groups to Spain late, and the giants not at all', () => {
    const s = game('ES', 1995);
    s.hour = 24 * 400;
    const world = getWorld(s.mapSeed, 'ES');
    updateRivals(s, world, 2005);
    expect(s.rivals.some(r => r.id === 'eml')).toBe(true);
    expect(s.rivals.some(r => r.id === 'prg')).toBe(false);
    updateRivals(s, world, 2012);
    expect(s.rivals.some(r => r.id === 'eml')).toBe(false);
    const prg = s.rivals.find(r => r.id === 'prg')!;
    expect(prg.name).toBe('PRG');
    expect(s.news.some(n => n.text.includes('PRG Spain'))).toBe(true);
    updateRivals(s, world, 2025);
    expect(s.rivals.some(r => r.id === 'clair' || r.id === 'solotech')).toBe(false);
  });

  it('keeps firms out of countries they never set up in', () => {
    expect(rivalsFor('FR').some(t => t.id === 'clair')).toBe(false);
    expect(rivalsFor('DE').some(t => t.id === 'clair')).toBe(true);
  });
});
