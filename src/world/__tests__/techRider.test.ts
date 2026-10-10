import { describe, expect, it } from 'vitest';
import { checkSpec, consoleInputs, crossHireOptions, inputsNeeded, rollTechSpec, breachPenalty } from '../techRider';
import { getProduct } from '../content/gear';
import { pickGear } from '../loading';
import { createTycoonGame } from '../state';
import { crossHireKit } from '../actions';
import type { Gig, TechSpec } from '../types';

const needs = { audio: 4, console: 2, lighting: 4, video: 0, stage: 1 };

describe('technical riders', () => {
  it('bigger shows and later years need more inputs; small shows have no hard rider', () => {
    expect(inputsNeeded(4, 2010)).toBeGreaterThan(inputsNeeded(4, 1990));
    expect(inputsNeeded(3, 1995)).toBeGreaterThan(inputsNeeded(2, 1995));
    expect(rollTechSpec(1, { id: 'g', tier: 1, needs }, 1995, true)).toBeUndefined();
    const spec = rollTechSpec(1, { id: 'g', tier: 3, needs }, 1995, true)!;
    expect(spec.inputs).toBeGreaterThanOrEqual(inputsNeeded(3, 1995));
    // The same show always rolls the same rider.
    expect(rollTechSpec(1, { id: 'g', tier: 3, needs }, 1995, true)).toEqual(spec);
  });

  it('a desk short of inputs, the wrong show-file family or an unapproved PA each break the rider', () => {
    const spec: TechSpec = { inputs: 56, consoleFamily: 'DiGiCo', paBrands: ['L-Acoustics', 'd&b audiotechnik'] };
    const bad = checkSpec(spec, { 'midas-xl4': 1, 'martin-f2': 4 });
    expect(bad.map(b => b.id).sort()).toEqual(['inputs', 'pa', 'showfile']);
    expect(bad.find(b => b.id === 'inputs')!.detail).toMatch(/48 inputs/);
    expect(checkSpec(spec, { 'digico-sd7': 1, 'lacoustics-k1': 3, 'martin-f2': 1 })).toEqual([]);
    expect(consoleInputs(getProduct('digico-sd7'))).toBeGreaterThan(56);
    const p = breachPenalty(bad);
    expect(p.withhold).toBeGreaterThan(0.25);
    expect(p.quality).toBeGreaterThan(0.2);
  });

  it('loading picks the compliant desk and PA before the preferred brand', () => {
    const spec: TechSpec = { inputs: 96, consoleFamily: 'Yamaha', paBrands: ['d&b audiotechnik'] };
    const stock = { 'midas-xl8': 1, 'yamaha-pm1d': 1, 'yamaha-pm5d': 1, 'lacoustics-vdosc': 2, 'dnb-c4': 2 };
    const picked = pickGear({ ...stock }, { audio: 2, console: 1, lighting: 0, video: 0, stage: 0 }, 10, { dept: 'audio', brand: 'L-Acoustics' }, spec);
    expect(picked['yamaha-pm1d']).toBe(1);
    expect(picked['dnb-c4']).toBe(2);
    expect(checkSpec(spec, picked)).toEqual([]);
  });

  it('cross-hire offers kit that fixes the breach, and books it to the show', () => {
    const spec: TechSpec = { inputs: 96, consoleFamily: 'DiGiCo' };
    const opts = crossHireOptions(spec, 'showfile', 2010);
    expect(opts.length).toBeGreaterThan(0);
    opts.forEach(p => {
      expect(p.brand).toBe('DiGiCo');
      expect(consoleInputs(p)).toBeGreaterThanOrEqual(96);
    });
    let s = createTycoonGame({ companyName: 'R', color: '#f00', seed: 7, country: 'GB', startYear: 2010 });
    const gig = s.gigs.find(g => g.status === 'offer')! as Gig;
    gig.status = 'booked';
    const cash = s.company.cash;
    s = crossHireKit(s, gig.id, opts[0].id, 1).state;
    expect(s.gigs.find(g => g.id === gig.id)!.crossHire).toEqual({ [opts[0].id]: 1 });
    expect(s.company.cash).toBeLessThan(cash);
  });
});
