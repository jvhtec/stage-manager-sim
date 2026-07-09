import { describe, expect, it } from 'vitest';
import { createNewGameState } from '@/engine/state';
import { advanceDay } from '@/engine/dayActions';
import { computeDaySummary } from '../daySummary';

describe('computeDaySummary', () => {
  it('reports balance/reputation deltas and the date of the day just advanced', () => {
    const prev = createNewGameState();
    const next = advanceDay(prev);

    const summary = computeDaySummary(prev, next);

    expect(summary.date.getTime()).toBe(next.currentDate.getTime());
    expect(summary.balanceDelta).toBe(next.company.balance - prev.company.balance);
    expect(summary.reputationDelta).toBe(next.company.reputation - prev.company.reputation);
    expect(summary.isGameOver).toBe(false);
    expect(summary.becameBankrupt).toBe(false);
  });

  it('only lists transactions and news that are new since the previous state', () => {
    let state = createNewGameState();
    // Fast-forward to day 7 so a payroll transaction is guaranteed to land.
    for (let i = 0; i < 6; i++) state = advanceDay(state);
    const prev = state;
    const next = advanceDay(prev);

    const summary = computeDaySummary(prev, next);

    expect(summary.newTransactions.length).toBe(
      next.finances.transactions.length - prev.finances.transactions.length,
    );
    expect(summary.newTransactions.some(t => t.description === 'Weekly crew retainer')).toBe(true);
    // None of the "new" transactions should already have existed in prev.
    const prevIds = new Set(prev.finances.transactions.map(t => t.id));
    expect(summary.newTransactions.every(t => !prevIds.has(t.id))).toBe(true);
  });

  it('detects a fresh transition into bankruptcy', () => {
    const prev = {
      ...createNewGameState(),
      company: { ...createNewGameState().company, balance: -100000 },
      finances: { ...createNewGameState().finances, creditLimit: -1000 },
      isBankrupt: false,
    };
    const next = advanceDay(prev);

    const summary = computeDaySummary(prev, next);

    expect(next.isBankrupt).toBe(true);
    expect(summary.becameBankrupt).toBe(true);
  });
});
