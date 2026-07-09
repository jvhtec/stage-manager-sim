/**
 * Seeded PRNG (mulberry32) for the deterministic parts of the simulation:
 * contract generation, crew generation, competitor bidding, and daily
 * morale/schedule rolls. Given the same seed and the same sequence of
 * calls, these always produce the same outputs — that's what makes a
 * fixed-seed playthrough reproducible for balance tuning and tests.
 *
 * Deliberately NOT used for: entity id suffixes (uniqueness only, not a
 * gameplay outcome) or the manual "roll a hire candidate" action in
 * Crew.tsx (a one-off UI action, not part of the automatic sim loop).
 */
export interface Rng {
  /** Next float in [0, 1). */
  next(): number;
  /** Next integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
  /** Next integer in [min, maxExclusive). */
  nextRange(min: number, maxExclusive: number): number;
  /** True with the given probability (0-1). */
  chance(probability: number): boolean;
  /** A uniformly random element of a non-empty array. */
  pick<T>(items: readonly T[]): T;
  /** Current internal state, for persisting into GameState. */
  getState(): number;
}

export function createRng(seed: number): Rng {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    nextInt: maxExclusive => Math.floor(next() * maxExclusive),
    nextRange: (min, maxExclusive) => min + Math.floor(next() * (maxExclusive - min)),
    chance: probability => next() < probability,
    pick: items => items[Math.floor(next() * items.length)],
    getState: () => state,
  };
}

/**
 * Mints a fresh, non-reproducible seed for a brand-new game. This is the
 * one legitimate place real randomness enters the simulation — everything
 * downstream of the seed being stored in GameState is deterministic.
 */
export function createRandomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff);
}
