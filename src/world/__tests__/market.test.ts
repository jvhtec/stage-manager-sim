import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { marketOnDay } from '../market';
import { baseRate } from '../content/economy';
import { bookGig } from '../actions';
import { HOURS_PER_DAY } from '../catalog';
import { dayOf } from '../core';
import type { TycoonState } from '../types';

const dayOfDate = (s: TycoonState, y: number, m: number, d = 15) =>
  Math.round((Date.UTC(y, m - 1, d) - Date.UTC(s.startYear, 0, 1)) / 86400000);

describe('market calendar', () => {
  it('follows the seasons and the economy', () => {
    const s = createTycoonGame({ companyName: 'M', color: '#f00', seed: 4, country: 'GB', startYear: 1980 });
    const jan = marketOnDay(s, dayOfDate(s, 1985, 1));
    const jul = marketOnDay(s, dayOfDate(s, 1985, 7));
    expect(jul.demand).toBeGreaterThan(jan.demand * 1.8);
    expect(marketOnDay(s, dayOfDate(s, 1981, 7)).periods.map(p => p.id)).toContain('recession80');
    // Spain gets its own history.
    const es = { ...s, country: 'ES' as const };
    expect(marketOnDay(es, dayOfDate(s, 1992, 7)).periods.map(p => p.id)).toContain('expo92');
    expect(marketOnDay(es, dayOfDate(s, 1981, 7)).periods.map(p => p.id)).not.toContain('recession80');
  });

  it('charges period interest rates, euro rates after 1999', () => {
    expect(baseRate('GB', 1980)).toBeGreaterThan(baseRate('GB', 2010) + 10);
    expect(baseRate('ES', 2005)).toBe(baseRate('DE', 2005));
    expect(baseRate('ES', 1990)).not.toBe(baseRate('DE', 1990));
    const s = createTycoonGame({ companyName: 'M', color: '#f00', seed: 4, country: 'US', startYear: 1980 });
    expect(marketOnDay(s, dayOfDate(s, 1981, 6)).loanRate).toBeGreaterThan(0.15);
  });

  it('a shutdown cancels the calendar without penalties and the state helps with wages', () => {
    let s = createTycoonGame({ companyName: 'M', color: '#f00', seed: 4, country: 'ES', startYear: 2010 });
    s = { ...s, company: { ...s.company, cash: 5_000_000 } };
    // Jump to late February 2020 and book whatever's around.
    s = { ...s, hour: dayOfDate(s, 2020, 2, 20) * HOURS_PER_DAY };
    const offer = s.gigs.find(g => g.status === 'offer' && !g.tourId)!;
    offer.day = dayOf(s.hour) + 20;
    offer.acceptByDay = offer.day - 3;
    s = bookGig(s, offer.id).state;
    const failedBefore = s.stats.showsFailed;
    s = advanceHours(s, 30 * HOURS_PER_DAY);
    expect(s.gigs.find(g => g.id === offer.id)!.status).toBe('expired');
    expect(s.stats.showsFailed).toBe(failedBefore);
    expect(s.ledger[2020]?.support ?? 0).toBeGreaterThan(0);
    expect(s.news.some(n => /Pandemic/.test(n.text))).toBe(true);
  });
});
