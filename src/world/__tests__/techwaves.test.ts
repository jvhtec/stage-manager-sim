import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { TECH_WAVES, techQualityFactor, techResaleFactor, waveProgress } from '../content/techWaves';
import { evaluateGear } from '../loading';
import { companyValue } from '../queries';
import { resaleValue } from '../wear';
import type { Gig } from '../types';

const gigOf = (tier: number): Gig => ({ tier, needs: { audio: 2, console: 0, lighting: 0, video: 0, stage: 0 } } as unknown as Gig);

describe('technology waves', () => {
  it('ramp from nothing to the full effect', () => {
    const w = TECH_WAVES.find(x => x.id === 'line-arrays')!;
    expect(waveProgress(w, w.year - 1)).toBe(0);
    expect(waveProgress(w, w.year + w.ramp / 2)).toBeCloseTo(0.5);
    expect(waveProgress(w, w.year + 50)).toBe(1);
  });

  it('obsolete kit loses quality on big shows only, and resale value everywhere', () => {
    const w = TECH_WAVES.find(x => x.id === 'line-arrays')!;
    const late = w.year + w.ramp;
    expect(techQualityFactor('point-source', 3, late)).toBeCloseTo(1 - w.penalty);
    expect(techQualityFactor('point-source', 1, late)).toBe(1);
    expect(techQualityFactor('line-array', 3, late)).toBe(1);
    expect(techResaleFactor('point-source', late)).toBeCloseTo(1 - w.resale);
    expect(techResaleFactor('point-source', w.year - 3)).toBe(1);
  });

  it('shows the difference in how a rig is judged, on a tier-3 show', () => {
    const before = evaluateGear({ 'meyer-upa1': 2 }, gigOf(3), 1990);
    const after = evaluateGear({ 'meyer-upa1': 2 }, gigOf(3), 2005);
    expect(after.avgQuality.audio).toBeLessThan(before.avgQuality.audio);
    const pub = evaluateGear({ 'meyer-upa1': 2 }, gigOf(1), 2005);
    expect(pub.avgQuality.audio).toBe(before.avgQuality.audio);
  });

  it('a sliding second-hand price shows up in what a unit and the company are worth', () => {
    const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 8, country: 'GB', startYear: 1990 });
    s.depots[0].gear['meyer-upa1'] = 10;
    const id = 'meyer-upa1';
    const early = resaleValue(s, id);
    const value = companyValue(s);
    s.hour = 24 * 365 * 15;
    expect(resaleValue(s, id)).toBeLessThan(early);
    expect(companyValue(s)).toBeLessThan(value);
  });

  it('rumours first, then arrival news, once each', () => {
    const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 8, country: 'GB', startYear: 1992 });
    s.company.cash = 5_000_000;
    expect(s.announcedWaves).not.toContain('line-arrays:rumour');
    const rumoured = advanceHours(s, 24 * 365 * 2 + 24 * 3);
    expect(rumoured.announcedWaves).toContain('line-arrays:rumour');
    expect(rumoured.announcedWaves).not.toContain('line-arrays:arrival');
    expect(rumoured.news.some(n => /Line-array PA is the talk/.test(n.text))).toBe(true);
    const arrived = advanceHours(rumoured, 24 * 365 * 2);
    expect(arrived.announcedWaves).toContain('line-arrays:arrival');
    expect(arrived.announcedWaves.filter(x => x === 'line-arrays:arrival').length).toBe(1);
  });

  it('a new game starting after a wave does not replay old news', () => {
    const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 8, country: 'GB', startYear: 2010 });
    expect(s.announcedWaves).toContain('line-arrays:arrival');
    const later = advanceHours(s, 24 * 5);
    expect(later.news.some(n => /Line arrays take over/.test(n.text))).toBe(false);
  });
});
