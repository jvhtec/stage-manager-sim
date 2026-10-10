import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { BRAND_FAULT_DAMAGE, brandShares, monthlyBrandFaults, standardisationFactor, supportOf } from '../ecosystem';
import { dailyWorkshop, refurbishCost } from '../wear';
import type { TycoonState } from '../types';

const game = (year: number): TycoonState => createTycoonGame({ companyName: 'E', color: '#f00', seed: 7, country: 'GB', startYear: year });

describe('equipment ecosystems', () => {
  it('kit ages from supported to legacy to end of life', () => {
    expect(supportOf('lacoustics-k1', 2008)).toBe('current');
    expect(supportOf('lacoustics-k1', 2018)).toBe('legacy');
    expect(supportOf('lacoustics-k1', 2026)).toBe('eol');
  });

  it('old kit repairs slower and costs more to refurbish', () => {
    const s = game(2010);
    s.policies.workshop = 'full';
    s.gearCondition = { 'meyer-upa1': 50, 'lacoustics-k1': 50 };
    s.depots[0].gear = { ...s.depots[0].gear, 'meyer-upa1': 2, 'lacoustics-k1': 2 };
    dailyWorkshop(s);
    expect(s.gearCondition['lacoustics-k1']).toBeGreaterThan(s.gearCondition['meyer-upa1']);
    const oldPerPrice = refurbishCost(s, 'meyer-upa1') / 2500;
    const newPerPrice = refurbishCost(s, 'lacoustics-k1') / 6400;
    expect(oldPerPrice).toBeGreaterThan(newPerPrice);
  });

  it('standardising a department cuts workshop costs', () => {
    const mixed = { 'lacoustics-k1': 4, 'dnb-j': 4, 'meyer-milo': 4 };
    const single = { 'lacoustics-k1': 12 };
    expect(brandShares(single).audio.share).toBe(1);
    expect(standardisationFactor(single)).toBeLessThan(standardisationFactor(mixed));
    expect(standardisationFactor(mixed)).toBe(1);
  });

  it("a maker's bad day hits every unit you own of its newest line", () => {
    const s = game(2010);
    const stock = { 'lacoustics-k1': 12 };
    s.gearCondition = { 'lacoustics-k1': 90 };
    const always = { chance: () => true, pick: <T,>(a: T[]) => a[0] } as never;
    monthlyBrandFaults(s, stock, always);
    expect(s.gearCondition['lacoustics-k1']).toBe(90 - BRAND_FAULT_DAMAGE);
    expect(s.incidents?.some(i => i.causes.some(c => c.id === 'standardised'))).toBe(true);
    // A small holding of a brand isn't worth logging.
    const t = game(2010);
    t.gearCondition = { 'dnb-j': 90 };
    monthlyBrandFaults(t, { 'dnb-j': 2 }, always);
    expect(t.gearCondition['dnb-j']).toBe(90);
  });
});
