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

  it('keeps advancing while merely bankrupt — bills still land and the streak counts up', () => {
    // Bankruptcy alone must not freeze time: the player can still take a
    // loan or finish an in-progress show to recover, but only if the clock
    // keeps moving.
    const state = { ...createNewGameState(), isBankrupt: true, bankruptStreak: 1 };
    const nextState = advanceDay(state);

    expect(nextState).not.toBe(state);
    const expectedDate = new Date(state.currentDate);
    expectedDate.setDate(expectedDate.getDate() + 1);
    expect(nextState.currentDate.getTime()).toBe(expectedDate.getTime());
  });

  it('is a genuine no-op once the game is over', () => {
    const state = { ...createNewGameState(), isGameOver: true };
    const nextState = advanceDay(state);

    expect(nextState).toBe(state);
  });

  it('triggers game over after enough consecutive bankrupt days, with a run summary', () => {
    let state = {
      ...createNewGameState(),
      company: { ...createNewGameState().company, balance: -100000 },
      finances: { ...createNewGameState().finances, creditLimit: -1000 },
      isBankrupt: true,
    };

    for (let i = 0; i < 10 && !state.isGameOver; i++) {
      state = advanceDay(state);
    }

    expect(state.isGameOver).toBe(true);
    expect(state.runSummary).toBeDefined();
    expect(state.runSummary?.daysSurvived).toBe(state.daysElapsed);
    expect(state.runSummary?.reason).toMatch(/consecutive days bankrupt/i);

    // And now it truly is frozen.
    const frozen = advanceDay(state);
    expect(frozen).toBe(state);
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

  it('charges weekly payroll on day 7 but not on other days', () => {
    let state = createNewGameState();
    const txnCountBefore = state.finances.transactions.length;

    for (let i = 0; i < 6; i++) {
      state = advanceDay(state);
      expect(
        state.finances.transactions.some(t => t.description === 'Weekly crew retainer'),
      ).toBe(false);
    }

    state = advanceDay(state); // day 7
    expect(state.daysElapsed).toBe(7);
    const payrollTxns = state.finances.transactions.filter(
      t => t.description === 'Weekly crew retainer',
    );
    expect(payrollTxns).toHaveLength(1);
    expect(state.finances.transactions.length).toBeGreaterThan(txnCountBefore);
  });

  it('rotates the hiring-market candidate pool on the same weekly cadence as payroll', () => {
    let state = createNewGameState();
    const initialCandidateIds = state.crewCandidates.map(c => c.id);

    for (let i = 0; i < 6; i++) {
      state = advanceDay(state);
      expect(state.crewCandidates.map(c => c.id)).toEqual(initialCandidateIds);
    }

    state = advanceDay(state); // day 7 — pool rotates
    expect(state.crewCandidates).toHaveLength(initialCandidateIds.length);
    expect(state.crewCandidates.map(c => c.id)).not.toEqual(initialCandidateIds);
  });

  it('accrues loan interest daily once a loan is outstanding', () => {
    const state = { ...createNewGameState(), finances: { ...createNewGameState().finances, loanBalance: 1000 } };
    const nextState = advanceDay(state);

    expect(nextState.finances.loanBalance).toBeGreaterThan(1000);
    expect(
      nextState.finances.transactions.some(t => t.description === 'Loan interest accrued'),
    ).toBe(true);
  });

  it('does not charge loan interest when there is no outstanding loan', () => {
    const state = createNewGameState();
    const nextState = advanceDay(state);

    expect(nextState.finances.loanBalance).toBe(0);
    expect(
      nextState.finances.transactions.some(t => t.description === 'Loan interest accrued'),
    ).toBe(false);
  });
});
