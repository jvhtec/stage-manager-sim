import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../state';
import { takeLoan, repayLoan } from '../loanActions';
import { calculateMaxLoanAmount } from '@/lib/economy';

describe('takeLoan', () => {
  it('adds cash and tracks the outstanding principal', () => {
    const state = createNewGameState();
    const { state: nextState, result } = takeLoan(state, 2000);

    expect(result.success).toBe(true);
    expect(nextState.company.balance).toBe(state.company.balance + 2000);
    expect(nextState.finances.loanBalance).toBe(2000);
  });

  it('rejects a non-positive amount', () => {
    const state = createNewGameState();
    const { result } = takeLoan(state, 0);

    expect(result.success).toBe(false);
  });

  it('caps borrowing at the reputation-scaled limit', () => {
    const state = createNewGameState();
    const maxLoan = calculateMaxLoanAmount(state.company.reputation);

    const { result: withinLimit } = takeLoan(state, maxLoan);
    expect(withinLimit.success).toBe(true);

    const { result: overLimit } = takeLoan(state, maxLoan + 1);
    expect(overLimit.success).toBe(false);
    expect(overLimit.reason).toMatch(/reputation/i);
  });

  it('accounts for an existing loan balance when checking the limit', () => {
    const state = createNewGameState();
    const maxLoan = calculateMaxLoanAmount(state.company.reputation);

    const { state: afterFirst } = takeLoan(state, maxLoan - 100);
    const { result } = takeLoan(afterFirst, 200);

    expect(result.success).toBe(false);
  });
});

describe('repayLoan', () => {
  it('reduces both cash and the outstanding balance', () => {
    const state = createNewGameState();
    const { state: withLoan } = takeLoan(state, 2000);

    const { state: repaid, result } = repayLoan(withLoan, 500);

    expect(result.success).toBe(true);
    expect(repaid.finances.loanBalance).toBe(1500);
    expect(repaid.company.balance).toBe(withLoan.company.balance - 500);
  });

  it('rejects repayment when there is no outstanding loan', () => {
    const state = createNewGameState();
    const { result } = repayLoan(state, 100);

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/no outstanding loan/i);
  });

  it('rejects repayment beyond available cash', () => {
    const state = createNewGameState();
    const { state: withLoan } = takeLoan(state, 2000);
    const cashPoor = { ...withLoan, company: { ...withLoan.company, balance: 10 } };

    const { result } = repayLoan(cashPoor, 500);

    expect(result.success).toBe(false);
  });

  it('never repays more than the outstanding balance even if more cash is offered', () => {
    const state = createNewGameState();
    const { state: withLoan } = takeLoan(state, 500);

    const { state: repaid } = repayLoan(withLoan, 10000);

    expect(repaid.finances.loanBalance).toBe(0);
    expect(repaid.company.balance).toBe(withLoan.company.balance - 500);
  });
});
