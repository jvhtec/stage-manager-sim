import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { FACTOR_DISCOUNT, INSURE_PREMIUM, collectOrInvoice, dailyReceivables, defaultRisk, owed, paymentDays } from '../receivables';
import { companyValue } from '../queries';
import { dayOf } from '../core';
import type { Gig, TycoonState } from '../types';

const yes = { next: () => 0, chance: () => true, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;
const no = { ...(yes as object), chance: () => false } as never;

const game = (): TycoonState => createTycoonGame({ companyName: 'A', color: '#f00', seed: 71, country: 'GB', startYear: 1995 });
const gig = (tier: number, extra: Partial<Gig> = {}) => ({ id: 'g', act: 'Act', tier, ...extra }) as Gig;
const shows = (s: TycoonState) => Object.values(s.ledger).reduce((a, y) => a + (y.shows ?? 0), 0);

describe('getting paid', () => {
  it('small venues pay on the night; bigger ones take longer, festivals longer still', () => {
    expect(paymentDays(gig(1))).toBe(0);
    expect(paymentDays(gig(2))).toBeGreaterThan(0);
    expect(paymentDays(gig(3))).toBeGreaterThan(paymentDays(gig(2)));
    expect(paymentDays(gig(4))).toBeGreaterThan(paymentDays(gig(3)));
    expect(paymentDays(gig(3, { festival: {} as never }))).toBeGreaterThan(paymentDays(gig(3)));
  });

  it('a tier-1 show pays immediately; a tier-3 show becomes an invoice paid when due', () => {
    const s = game();
    collectOrInvoice(s, gig(1), 1000);
    expect(shows(s)).toBe(1000);
    expect(s.receivables.length).toBe(0);
    const cash = s.company.cash;
    collectOrInvoice(s, gig(3), 5000);
    expect(s.company.cash).toBe(cash);
    expect(owed(s)).toBe(5000);
    expect(companyValue(s)).toBeGreaterThan(companyValue({ ...s, receivables: [] }));
    s.hour += 24 * 31;
    dailyReceivables(s, no);
    expect(s.company.cash).toBe(cash + 5000);
    expect(owed(s)).toBe(0);
  });

  it('a factor pays now at a discount; insurance costs a premium and covers a default', () => {
    const f = game();
    f.policies.invoicing = 'factor';
    const cash = f.company.cash;
    collectOrInvoice(f, gig(3), 10000);
    expect(f.company.cash).toBe(cash + Math.round(10000 * (1 - FACTOR_DISCOUNT)));
    expect(f.receivables.length).toBe(0);

    const i = game();
    i.policies.invoicing = 'insure';
    const c2 = i.company.cash;
    collectOrInvoice(i, gig(3), 10000);
    expect(i.company.cash).toBe(c2 - Math.round(10000 * INSURE_PREMIUM));
    i.hour += 24 * 31;
    dailyReceivables(i, yes); // everyone defaults
    expect(i.company.cash).toBe(c2 - Math.round(10000 * INSURE_PREMIUM) + 10000);

    const h = game();
    const c3 = h.company.cash;
    collectOrInvoice(h, gig(3), 10000);
    h.hour += 24 * 31;
    dailyReceivables(h, yes); // a promoter who is late first…
    h.hour += 24 * 40;
    dailyReceivables(h, yes); // …and then never pays
    expect(h.company.cash).toBe(c3);
    expect(h.news.some(n => /gone under owing you/.test(n.text))).toBe(true);
  });

  it('defaults are likelier in a downturn and for bigger promoters', () => {
    const s = game();
    expect(defaultRisk(s, 4)).toBeGreaterThan(defaultRisk(s, 2));
    const slump = createTycoonGame({ companyName: 'A', color: '#f00', seed: 71, country: 'GB', startYear: 2008 });
    slump.hour = 24 * (365 * 1 + 270);
    expect(defaultRisk(slump, 3)).toBeGreaterThanOrEqual(defaultRisk(s, 3));
  });

  it('runs through the clock without trouble', () => {
    const s = game();
    collectOrInvoice(s, gig(2), 3000);
    const later = advanceHours(s, 24 * 20);
    expect(later.receivables.length).toBe(0);
    expect(dayOf(later.hour)).toBeGreaterThan(14);
  });
});
