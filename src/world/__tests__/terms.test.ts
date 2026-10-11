import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { negotiateTerms } from '../actions';
import { clientTemper } from '../changes';
import { askForTerms, BETTER_TERMS, cancelByClient, dailyTerms, defaultTerms, depositOf, balanceDue } from '../terms';
import type { Gig, TycoonState } from '../types';

const game = (): TycoonState => createTycoonGame({ companyName: 'T', color: '#f00', seed: 7, country: 'GB', startYear: 1995 });
const yes = { chance: () => true } as never;
const no = { chance: () => false } as never;

describe('contract terms', () => {
  it('terms follow the client: easy-going clients pay deposits, pushy ones offer nothing', () => {
    const acts = ['Oasis', 'Blur', 'Pulp', 'Suede', 'Elastica', 'Supergrass', 'Ash', 'Muse', 'Coldplay', 'Travis', 'Embrace', 'Doves'];
    const easy = acts.find(a => clientTemper(a) === 'easy')!;
    const pushy = acts.find(a => clientTemper(a) === 'pushy')!;
    expect(defaultTerms({ act: easy, tier: 2 })!.deposit).toBeGreaterThan(0);
    expect(defaultTerms({ act: pushy, tier: 2 })!.deposit).toBe(0);
    expect(defaultTerms({ act: easy, tier: 1 })).toBeUndefined();
    expect(defaultTerms({ act: easy, tier: 3, festival: { id: 'f', year: 1995, stage: 's', main: true } })).toBeUndefined();
  });

  it('asking for better terms: they agree, refuse, or walk', () => {
    const s = game();
    const g = { id: 'g', act: 'Blur', tier: 2, fee: 10000, status: 'offer', terms: { deposit: 0, cancel: 0 } } as unknown as Gig;
    expect(askForTerms(s, { ...g }, yes)).toBe('agreed');
    const a = { ...g };
    askForTerms(s, a, yes);
    expect(a.terms).toEqual(BETTER_TERMS);
    const walked = { ...g };
    expect(askForTerms(s, walked, { chance: (() => { let n = 0; return () => n++ > 0; })() } as never)).toBe('walked');
    expect(walked.status).toBe('expired');
    expect(askForTerms(s, { ...g }, no)).toBe('refused');
  });

  it('the deposit lands after booking and comes off the balance', () => {
    const s = game();
    const offer = s.gigs.find(g => g.status === 'offer' && g.terms && g.terms.deposit > 0) ?? s.gigs.find(g => g.status === 'offer' && g.terms)!;
    offer.terms = { deposit: 0.25, cancel: 0.5 };
    offer.status = 'booked';
    const cash = s.company.cash;
    dailyTerms(s, no);
    const gig = s.gigs.find(g => g.id === offer.id)!;
    expect(gig.depositPaid).toBe(depositOf(gig));
    expect(s.company.cash).toBe(cash + gig.depositPaid!);
    expect(balanceDue(gig, gig.fee)).toBe(gig.fee - gig.depositPaid!);
  });

  it('a cancellation pays out the clause; with no clause there is nothing to claim', () => {
    const s = game();
    const g = { id: 'g', act: 'Blur', tier: 2, fee: 10000, day: 40, status: 'booked', terms: { deposit: 0.25, cancel: 0.5 }, depositPaid: 2500, cityId: 'c' } as unknown as Gig;
    s.gigs.push(g);
    const cash = s.company.cash;
    cancelByClient(s, g);
    expect(g.status).toBe('expired');
    expect(s.company.cash).toBe(cash + 2500);
    const bare = { ...g, id: 'h', terms: { deposit: 0, cancel: 0 }, depositPaid: undefined, status: 'booked' } as Gig;
    s.gigs.push(bare);
    const c2 = s.company.cash;
    cancelByClient(s, bare);
    expect(s.company.cash).toBe(c2);
    expect(s.incidents?.some(i => i.causes.some(c => c.id === 'no-terms'))).toBe(true);
  });

  it('negotiateTerms only works once, on an offer', () => {
    const s = game();
    const offer = s.gigs.find(g => g.status === 'offer' && g.terms)!;
    const r = negotiateTerms(s, offer.id);
    const again = negotiateTerms(r.state, offer.id);
    expect(again.result.ok).toBe(false);
  });
});
