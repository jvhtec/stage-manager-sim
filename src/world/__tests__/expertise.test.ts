import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { EVEN_EXPERTISE, EXPERTISE_FEE, EXPERTISE_POOL, evenMix, expertise, expertiseBonus, knownFor, knownForLabel, learnMix, mixOf, needShares } from '../expertise';
import type { Gig, TycoonState } from '../types';

const game = (): TycoonState => createTycoonGame({ companyName: 'A', color: '#f00', seed: 81, country: 'GB', startYear: 1995 });
const audioShow = { tier: 2, needs: { audio: 6, console: 2, lighting: 1, video: 0, stage: 1 } } as Gig;
const lightShow = { tier: 2, needs: { audio: 1, console: 0, lighting: 6, video: 3, stage: 1 } } as Gig;

describe('what you are known for', () => {
  it('starts as an even mix with no bonus either way', () => {
    const s = game();
    expect(mixOf(s)).toEqual(evenMix());
    expect(EVEN_EXPERTISE).toBeCloseTo(EXPERTISE_POOL / 5 / 100);
    expect(Math.abs(expertiseBonus(s, audioShow))).toBeLessThan(0.0001);
    expect(knownFor(s)).toEqual([]);
    expect(knownForLabel(s)).toBe('All-rounders');
  });

  it('shares sum to one', () => {
    const sh = needShares(audioShow.needs);
    expect(Object.values(sh).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  it('a run of sound shows makes you the sound house, paying more on sound shows and less on lighting ones', () => {
    const s = game();
    for (let i = 0; i < 80; i++) learnMix(s, audioShow);
    expect(expertise(s, 'audio')).toBeGreaterThan(expertise(s, 'video'));
    expect(knownFor(s)).toContain('audio');
    expect(knownForLabel(s)).toMatch(/PA|Sound|Audio/i);
    const bonus = expertiseBonus(s, audioShow);
    expect(bonus).toBeGreaterThan(0.03);
    expect(bonus).toBeLessThanOrEqual(EXPERTISE_FEE);
    expect(expertiseBonus(s, lightShow)).toBeLessThan(0);
    expect(expertiseBonus(s, lightShow)).toBeGreaterThan(-0.06);
  });

  it('the pool is shared: nobody is great at everything', () => {
    const s = game();
    for (let i = 0; i < 60; i++) learnMix(s, audioShow);
    for (let i = 0; i < 60; i++) learnMix(s, lightShow);
    const total = (['audio', 'console', 'lighting', 'video', 'stage'] as const).reduce((a, d) => a + expertise(s, d), 0);
    expect(total).toBeLessThanOrEqual(EXPERTISE_POOL + 0.01);
  });

  it('a change of direction takes a while to show', () => {
    const s = game();
    for (let i = 0; i < 80; i++) learnMix(s, audioShow);
    const before = expertise(s, 'lighting');
    for (let i = 0; i < 5; i++) learnMix(s, lightShow);
    expect(expertise(s, 'lighting')).toBeGreaterThan(before);
    expect(expertise(s, 'lighting')).toBeLessThan(expertise(s, 'audio'));
  });
});
