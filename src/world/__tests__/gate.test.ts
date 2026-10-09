import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { bookGate, bookGig } from '../actions';
import { GATE_MIN_TIER, baseHype, expectedPayout, flatPayout, gateBlocker, gatePayout, hypeLabel, rollGate, showPayout } from '../gate';
import { createRng } from '@/lib/rng';
import type { Gig, TycoonState } from '../types';

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'G', color: '#f00', seed: 14, country: 'GB', startYear: 1995 });
  return { ...s, company: { ...s.company, cash: 1_000_000, reputation: 70 } };
};
const offer = (s: TycoonState, minTier = GATE_MIN_TIER): Gig => {
  const g = s.gigs.find(x => x.status === 'offer' && !x.tourId && !x.festival && !x.event && !x.overseas && x.tier >= minTier);
  if (g) return g;
  // None generated at this reputation: dress one up.
  const base = s.gigs.find(x => x.status === 'offer' && !x.tourId && !x.festival && !x.event)!;
  base.tier = minTier;
  return base;
};

describe('fee or gate', () => {
  it('pays better than a flat fee only when the night and the tickets are good', () => {
    const fee = 10000;
    // Typical: a good show on a normal night beats the flat fee…
    expect(gatePayout(fee, 0.85, 1)).toBeGreaterThan(flatPayout(fee, 0.85));
    // …a sell-out is much better…
    expect(gatePayout(fee, 0.9, 1.4)).toBeGreaterThan(flatPayout(fee, 0.9) * 1.25);
    // …and slow tickets or a rough show leave you short.
    expect(gatePayout(fee, 0.9, 0.6)).toBeLessThan(flatPayout(fee, 0.9));
    expect(gatePayout(fee, 0.55, 1)).toBeLessThan(flatPayout(fee, 0.55));
  });

  it('is only offered on single shows of tier 2+', () => {
    const s = game();
    const g = offer(s);
    expect(gateBlocker(g)).toBeNull();
    expect(gateBlocker({ ...g, tier: 1 })).toMatch(/tier/);
    expect(gateBlocker({ ...g, tourId: 't' })).toMatch(/single/);
    expect(gateBlocker({ ...g, festival: { id: 'f', year: 1995, stage: 's', main: true } })).toMatch(/single/);
    expect(gateBlocker({ ...g, status: 'booked' })).toMatch(/no longer/);
  });

  it('hype follows the economy, the town and real acts, within bounds', () => {
    const s = game();
    const g = offer(s);
    const base = baseHype(s, g);
    s.cityRatings[g.cityId] = 100;
    expect(baseHype(s, g)).toBeGreaterThan(base);
    s.cityRatings[g.cityId] = 0;
    expect(baseHype(s, g)).toBeLessThan(base);
    const rng = createRng(3);
    for (let i = 0; i < 200; i++) {
      const { hype, forecast } = rollGate(s, g, rng);
      expect(hype).toBeGreaterThanOrEqual(0.5);
      expect(hype).toBeLessThanOrEqual(1.6);
      expect(Math.abs(forecast - hype)).toBeLessThanOrEqual(0.16);
    }
  });

  it('averages out close to a flat fee for a decent crew (so it is a gamble, not a free lunch)', () => {
    const s = game();
    const g = offer(s);
    const rng = createRng(11);
    let flat = 0;
    let gate = 0;
    const n = 600;
    for (let i = 0; i < n; i++) {
      const q = 0.72 + rng.next() * 0.16; // a decent night
      const { hype } = rollGate(s, g, rng);
      flat += flatPayout(10000, q);
      gate += gatePayout(10000, q, hype);
    }
    const ratio = gate / flat;
    expect(ratio).toBeGreaterThan(0.85);
    expect(ratio).toBeLessThan(1.2);
  });

  it('booking on the gate records the deal and a forecast; the sim pays by it', () => {
    const s = game();
    const g = offer(s);
    const out = bookGate(s, g.id);
    expect(out.result.ok).toBe(true);
    const booked = out.state.gigs.find(x => x.id === g.id)!;
    expect(booked.status).toBe('booked');
    expect(booked.gate).toBeDefined();
    expect(out.result.message).toContain(hypeLabel(booked.gate!.forecast));
    expect(showPayout(booked, 0.9)).toBe(Math.round(gatePayout(booked.fee, 0.9, booked.gate!.hype)));
    expect(expectedPayout(booked, 0.9)).toBe(Math.round(gatePayout(booked.fee, 0.9, booked.gate!.forecast)));
    // A flat booking has no gate and the old formula.
    const flat = bookGig(s, g.id).state.gigs.find(x => x.id === g.id)!;
    expect(flat.gate).toBeUndefined();
    expect(showPayout(flat, 0.9)).toBe(Math.round(flatPayout(flat.fee, 0.9)));
  });

  it('refuses when it cannot be booked, leaving the offer alone', () => {
    const s = game();
    const g = offer(s);
    s.company.reputation = 0;
    s.gigs.find(x => x.id === g.id)!.act = 'Zzz';
    const out = bookGate(s, g.id);
    if (!out.result.ok) expect(out.state.gigs.find(x => x.id === g.id)!.status).toBe('offer');
    expect(bookGate(s, 'nope').result.ok).toBe(false);
  });

  it('labels the hype', () => {
    expect([0.55, 0.8, 1, 1.2, 1.5].map(hypeLabel)).toEqual(['struggling', 'slow', 'steady', 'selling well', 'a sell-out']);
  });
});
