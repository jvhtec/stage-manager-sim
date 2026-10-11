import { describe, expect, it } from 'vitest';
import { HANDLING_WINDOW, LOADERS, handlingHours, handlingOverrun, loadWeight, payloadOf } from '../cargo';
import { pickGear } from '../loading';
import { loadInProblem } from '../production';
import type { Gig } from '../types';

describe('physical loading', () => {
  it('a truck stops loading at its payload, even with room to spare', () => {
    const stock = { 'lacoustics-k1': 30 };
    const picked = pickGear({ ...stock }, { audio: 30, console: 0, lighting: 0, video: 0, stage: 0 }, 28, undefined, undefined, payloadOf('artic-40'));
    expect(loadWeight(picked)).toBeLessThanOrEqual(payloadOf('artic-40'));
    expect(picked['lacoustics-k1']).toBeLessThan(28);
    // Without a payload limit it fills by space.
    expect(pickGear({ ...stock }, { audio: 30, console: 0, lighting: 0, video: 0, stage: 0 }, 28)['lacoustics-k1']).toBe(28);
  });

  it('load-ins take longer from the street and up stairs, and quicker with more hands', () => {
    const kit = { 'lacoustics-k1': 8, 'midas-xl4': 2 };
    expect(handlingHours(kit, 8, 'stairs')).toBeGreaterThan(handlingHours(kit, 8, 'street'));
    expect(handlingHours(kit, 8, 'street')).toBeGreaterThan(handlingHours(kit, 8, 'dock'));
    expect(handlingHours(kit, 8 + LOADERS, 'dock')).toBeLessThan(handlingHours(kit, 8, 'dock'));
  });

  it('a load-in past the window is late, and local loaders are offered', () => {
    const kit = { 'lacoustics-k1': 16 };
    const hours = handlingHours(kit, 3, 'stairs');
    expect(hours).toBeGreaterThan(HANDLING_WINDOW);
    expect(handlingOverrun(hours)).toBeGreaterThan(0);
    const gig = { id: 'g', days: 1 } as Gig;
    const p = loadInProblem(gig, hours, 3, 'stairs')!;
    expect(p.id).toBe('loaders');
    expect(p.fixCost).toBeGreaterThan(0);
    expect(loadInProblem({ ...gig, fixes: { loaders: true } }, hours, 3, 'stairs')).toBeUndefined();
    expect(loadInProblem(gig, 3, 10, 'dock')).toBeUndefined();
  });
});
