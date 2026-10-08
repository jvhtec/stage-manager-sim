import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createTycoonGame } from '../state';
import { setPolicy } from '../actions';
import { dailyIncidents, monthlyInsurance, monthlyPremium, rollWeather } from '../incidents';
import { stockSize } from '../loading';
import type { Gig, TycoonState } from '../types';

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'I', color: '#f00', seed: 12, country: 'GB', startYear: 1995 });
  return { ...s, company: { ...s.company, cash: 1_000_000 } };
};

describe('incidents and insurance', () => {
  it('premiums scale with cover', () => {
    const s = game();
    expect(monthlyPremium(s, 'none')).toBe(0);
    expect(monthlyPremium(s, 'full')).toBeGreaterThan(monthlyPremium(s, 'basic'));
    const insured = setPolicy(s, 'insurance', 'full').state;
    const before = insured.company.cash;
    monthlyInsurance(insured);
    expect(before - insured.company.cash).toBe(monthlyPremium(insured, 'full'));
  });

  it('break-ins take kit, and insurance pays some of it back', () => {
    const rng = createRng(3);
    const bare = game();
    const covered = setPolicy(game(), 'insurance', 'basic').state;
    const before = stockSize(bare.depots[0].gear);
    // Roll a lot of days so a break-in surely happens.
    for (let i = 0; i < 4000 && stockSize(bare.depots[0].gear) === before; i++) dailyIncidents(bare, rng);
    expect(stockSize(bare.depots[0].gear)).toBeLessThan(before);
    expect(bare.news[0].text).toMatch(/Uninsured/);
    const rng2 = createRng(3);
    for (let i = 0; i < 4000 && stockSize(covered.depots[0].gear) === before; i++) dailyIncidents(covered, rng2);
    expect(covered.news[0].text).toMatch(/Insurance paid/);
  });

  it('storms only hit outdoor festival stages, and only full cover pays for weather', () => {
    const s = setPolicy(game(), 'insurance', 'full').state;
    const club = { fee: 3000, days: 1 } as Gig;
    const fest = { fee: 300000, days: 4, festival: { id: 'reading', year: 1995, stage: 'Main Stage', main: true } } as Gig;
    const rng = createRng(5);
    expect(rollWeather(s, club, rng)).toBeNull();
    let storm = null;
    for (let i = 0; i < 50 && !storm; i++) storm = rollWeather(s, fest, rng);
    expect(storm!.penalty).toBeGreaterThan(0);
    expect(storm!.note).toMatch(/Insurance paid/);
  });
});
