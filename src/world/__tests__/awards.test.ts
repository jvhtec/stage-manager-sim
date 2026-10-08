import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { HOURS_PER_DAY } from '../catalog';
import { awardsName, awardsNight, companyRating, recordShow, recordTour } from '../awards';
import type { TycoonState } from '../types';

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 13, country: 'GB', startYear: 2005 });
  return { ...s, company: { ...s.company, cash: 1_000_000 } };
};

describe('rating and awards', () => {
  it('rates a good year far above a bad one', () => {
    const good = game();
    for (let i = 0; i < 80; i++) recordShow(good, 2005, 0.92, false, i < 3);
    recordTour(good, 2005, false);
    good.company.reputation = 70;
    good.ledger[2005] = { shows: 400_000, wages: -100_000 };
    const bad = game();
    for (let i = 0; i < 20; i++) recordShow(bad, 2005, 0.55, i % 4 === 0, false);
    expect(companyRating(good, 2005).total).toBeGreaterThan(companyRating(bad, 2005).total + 300);
    expect(companyRating(good, 2005).total).toBeLessThanOrEqual(1000);
  });

  it('hands out awards in January, with a reputation bump', () => {
    const s = game();
    for (let i = 0; i < 80; i++) recordShow(s, 2005, 0.93, false, i < 3);
    recordTour(s, 2005, false);
    recordTour(s, 2005, true);
    s.company.reputation = 95;
    s.ledger[2005] = { shows: 2_000_000 };
    s.rivals.forEach(r => (r.reputation = 10));
    const rep = s.company.reputation;
    awardsNight(s, 2005);
    const titles = s.awards.map(a => a.title);
    expect(titles).toContain('Production Company of the Year');
    expect(titles).toContain('Festival Supplier of the Year');
    expect(titles).toContain('Touring Company of the Year');
    expect(s.company.reputation).toBeGreaterThanOrEqual(Math.min(100, rep));
    expect(s.news[0].text).toMatch(/TPi Awards 2005/);
  });

  it('runs on New Year without fuss, and names the right awards body', () => {
    let s = game();
    recordShow(s, 2005, 0.7, false, false);
    s = advanceHours(s, 366 * HOURS_PER_DAY);
    expect(s.news.some(n => /Awards 2005/.test(n.text))).toBe(true);
    expect(awardsName('US', 1995)).toBe('Live Production Awards');
    expect(awardsName('US', 2005)).toBe('Parnelli Awards');
  });
});
