import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../state';
import { advanceDay } from '../dayActions';

describe('advanceDay', () => {
  it('advances the calendar by exactly one day and updates rngState', () => {
    const state = createNewGameState();
    const nextState = advanceDay(state);

    const expectedDate = new Date(state.currentDate);
    expectedDate.setDate(expectedDate.getDate() + 1);
    expect(nextState.currentDate.getTime()).toBe(expectedDate.getTime());
    expect(nextState.rngState).not.toBe(state.rngState);
  });

  it('is a no-op while bankrupt', () => {
    const state = { ...createNewGameState(), isBankrupt: true };
    const nextState = advanceDay(state);

    expect(nextState).toBe(state);
  });

  it('replays identically from the same starting state and seed', () => {
    // Two independently-created states sharing the same rngState/currentDate
    // must advance identically — this is the whole point of threading a
    // seeded rng through the day-advance cascade instead of Math.random().
    const base = createNewGameState();
    const seeded = { ...base, rngState: 12345 };

    const runA = advanceDay(seeded);
    const runB = advanceDay(seeded);

    expect(runA.rngState).toBe(runB.rngState);
    expect(runA.events.length).toBe(runB.events.length);
    expect(runA.company.reputation).toBe(runB.company.reputation);
    expect(runA.company.balance).toBe(runB.company.balance);
  });

  it('appends a reputation history snapshot for the new day', () => {
    const state = createNewGameState();
    const nextState = advanceDay(state);

    expect(nextState.reputationHistory.length).toBe(state.reputationHistory.length + 1);
    expect(nextState.reputationHistory.at(-1)?.date.getTime()).toBe(nextState.currentDate.getTime());
  });
});
