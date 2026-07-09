import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const sequenceA = Array.from({ length: 20 }, () => a.next());
    const sequenceB = Array.from({ length: 20 }, () => b.next());
    expect(sequenceA).toEqual(sequenceB);
  });

  it('produces different sequences for different seeds', () => {
    const a = createRng(1);
    const b = createRng(2);
    const sequenceA = Array.from({ length: 10 }, () => a.next());
    const sequenceB = Array.from({ length: 10 }, () => b.next());
    expect(sequenceA).not.toEqual(sequenceB);
  });

  it('always returns values in [0, 1)', () => {
    const rng = createRng(42);
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('resuming from a saved state continues the same sequence rather than restarting', () => {
    const rng = createRng(999);
    rng.next();
    rng.next();
    const savedState = rng.getState();
    const expectedNext = rng.next();

    const resumed = createRng(savedState);
    expect(resumed.next()).toBe(expectedNext);
  });

  it('nextInt stays within [0, maxExclusive)', () => {
    const rng = createRng(7);
    for (let i = 0; i < 500; i++) {
      const value = rng.nextInt(6);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(6);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('nextRange stays within [min, maxExclusive)', () => {
    const rng = createRng(8);
    for (let i = 0; i < 500; i++) {
      const value = rng.nextRange(3, 9);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThan(9);
    }
  });

  it('chance approximates the requested probability over many rolls', () => {
    const rng = createRng(2024);
    let trueCount = 0;
    const rolls = 5000;
    for (let i = 0; i < rolls; i++) {
      if (rng.chance(0.3)) trueCount++;
    }
    const ratio = trueCount / rolls;
    expect(ratio).toBeGreaterThan(0.25);
    expect(ratio).toBeLessThan(0.35);
  });

  it('pick only returns items from the given array', () => {
    const rng = createRng(3);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 100; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });
});
