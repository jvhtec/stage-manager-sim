import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { haggleGig, bookGig } from '../actions';
import { HAGGLE_RAISE, haggle, haggleBlocker, haggleChance } from '../negotiate';
import type { Gig, TycoonState } from '../types';

const game = (): { s: TycoonState; gig: Gig } => {
  const s0 = createTycoonGame({ companyName: 'N', color: '#f00', seed: 12, country: 'GB', startYear: 1995 });
  const s = { ...s0, company: { ...s0.company, reputation: 50 } };
  const gig = s.gigs.find(g => g.status === 'offer' && !g.tourId && !g.festival && !g.event)!;
  return { s, gig };
};
const rng = (yes: boolean, walk = false) => {
  let n = 0;
  return { next: () => 0.5, chance: () => (n++ === 0 ? yes : walk), pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;
};

describe('haggling', () => {
  it('raises the fee when the promoter folds, once only', () => {
    const { s, gig } = game();
    const fee = gig.fee;
    expect(haggle(s, gig, rng(true))).toBe('won');
    expect(gig.fee).toBeCloseTo(fee * (1 + HAGGLE_RAISE), -1);
    expect(gig.negotiated).toBe(true);
    expect(haggleBlocker(s, gig)).toMatch(/already/);
  });

  it('a refusal leaves the fee, or the promoter walks away', () => {
    const a = game();
    const fee = a.gig.fee;
    expect(haggle(a.s, a.gig, rng(false, false))).toBe('refused');
    expect(a.gig.fee).toBe(fee);
    expect(a.gig.status).toBe('offer');
    const b = game();
    expect(haggle(b.s, b.gig, rng(false, true))).toBe('walked');
    expect(b.gig.status).toBe('expired');
  });

  it('the odds follow how much they need you, within 15-85%', () => {
    const { s, gig } = game();
    s.company.reputation = 30;
    const base = haggleChance(s, gig);
    s.company.reputation = 100;
    s.cityRatings[gig.cityId] = 100;
    expect(haggleChance(s, gig)).toBeGreaterThan(base);
    s.company.reputation = 0;
    s.cityRatings[gig.cityId] = 0;
    expect(haggleChance(s, gig)).toBeGreaterThanOrEqual(0.15);
    s.company.reputation = 100;
    s.artistRelations[gig.act] = 50;
    expect(haggleChance(s, gig)).toBeLessThanOrEqual(0.85);
  });

  it('works through the action, persists the haggle flag, and a booked show cannot be haggled', () => {
    const { s, gig } = game();
    const out = haggleGig(s, gig.id);
    const after = out.state.gigs.find(g => g.id === gig.id)!;
    expect(after.negotiated).toBe(true);
    expect(haggleGig(out.state, gig.id).result.ok).toBe(false);
    const booked = bookGig({ ...s, company: { ...s.company, reputation: 100 } }, gig.id).state;
    expect(haggleGig(booked, gig.id).result.ok).toBe(false);
  });

  it('tenders are fixed price', () => {
    const { s, gig } = game();
    gig.festival = { id: 'f', year: 1995, stage: 'Main', main: true };
    expect(haggleBlocker(s, gig)).toMatch(/fixed-price/);
  });
});
