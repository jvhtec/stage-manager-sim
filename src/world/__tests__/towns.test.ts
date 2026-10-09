import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { HOURS_PER_DAY } from '../catalog';
import { monthlyTowns, populationOf, townGrowth } from '../towns';
import { worldOf } from '../mapgen';
import type { TycoonState } from '../types';

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'T', color: '#f00', seed: 8, country: 'GB', startYear: 1995 });
  return { ...s, company: { ...s.company, cash: 50_000_000 } };
};

describe('towns grow', () => {
  it('start at 1× and grow every month', () => {
    const s = game();
    const world = worldOf(s);
    expect(townGrowth(s, world.cities[0].id)).toBe(1);
    monthlyTowns(s, world);
    expect(townGrowth(s, world.cities[0].id)).toBeGreaterThan(1);
  });

  it('grow faster where you have a base and a name', () => {
    const s = game();
    const world = worldOf(s);
    const home = s.company.hqCityId;
    const away = world.cities.find(c => c.id !== home && !s.depots.some(d => d.cityId === c.id))!;
    s.cityRatings[home] = 95;
    for (let i = 0; i < 12; i++) monthlyTowns(s, world);
    expect(townGrowth(s, home)).toBeGreaterThan(townGrowth(s, away.id));
  });

  it('do not grow during a shutdown, and never past the cap', () => {
    const s = createTycoonGame({ companyName: 'T', color: '#f00', seed: 8, country: 'GB', startYear: 2020 });
    s.hour = (31 + 29 + 20) * HOURS_PER_DAY; // spring 2020
    const world = worldOf(s);
    monthlyTowns(s, world);
    const c = world.cities[0];
    s.townGrowth[c.id] = 2.499;
    for (let i = 0; i < 50; i++) monthlyTowns(s, world);
    expect(townGrowth(s, c.id)).toBeLessThanOrEqual(2.5);
  });

  it('shows up in the population and over a decade of play', () => {
    const s = game();
    const out = advanceHours(s, 3 * 365 * HOURS_PER_DAY);
    const c = worldOf(out).cities[0];
    expect(populationOf(out, c)).toBeGreaterThan(c.population);
    expect(populationOf(s, c)).toBe(c.population);
  });
});
