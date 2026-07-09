import { GameState } from '@/types/game';
import { createTransaction, evaluateFinancialState } from '@/lib/finance';
import { calculateMaxLoanAmount } from '@/lib/economy';
import type { ActionResult } from './types';

export function takeLoan(
  state: GameState,
  amount: number,
): { state: GameState; result: ActionResult } {
  if (amount <= 0) {
    return { state, result: { success: false, reason: 'Loan amount must be positive.' } };
  }

  const maxLoan = calculateMaxLoanAmount(state.company.reputation);
  const availableCredit = maxLoan - state.finances.loanBalance;
  if (amount > availableCredit) {
    return {
      state,
      result: {
        success: false,
        reason: `Lenders will only extend ${Math.max(0, availableCredit).toLocaleString()} more at your current reputation.`,
      },
    };
  }

  const newBalance = state.company.balance + amount;
  const transaction = createTransaction(
    state.currentDate,
    'income',
    amount,
    'Bank loan disbursement',
    'misc',
  );

  const { overdraftDays, isBankrupt } = evaluateFinancialState(state.finances, newBalance);

  return {
    state: {
      ...state,
      company: { ...state.company, balance: newBalance },
      finances: {
        ...state.finances,
        transactions: [...state.finances.transactions, transaction],
        loanBalance: state.finances.loanBalance + amount,
        overdraftDays,
      },
      isBankrupt,
    },
    result: { success: true },
  };
}

export function repayLoan(
  state: GameState,
  amount: number,
): { state: GameState; result: ActionResult } {
  if (amount <= 0) {
    return { state, result: { success: false, reason: 'Repayment amount must be positive.' } };
  }
  if (state.finances.loanBalance <= 0) {
    return { state, result: { success: false, reason: 'There is no outstanding loan to repay.' } };
  }
  if (amount > state.company.balance) {
    return { state, result: { success: false, reason: 'Not enough cash on hand to repay that much.' } };
  }

  const payment = Math.min(amount, state.finances.loanBalance);
  const newBalance = state.company.balance - payment;
  const transaction = createTransaction(
    state.currentDate,
    'expense',
    payment,
    'Loan repayment',
    'misc',
  );

  const { overdraftDays, isBankrupt } = evaluateFinancialState(state.finances, newBalance);

  return {
    state: {
      ...state,
      company: { ...state.company, balance: newBalance },
      finances: {
        ...state.finances,
        transactions: [...state.finances.transactions, transaction],
        loanBalance: state.finances.loanBalance - payment,
        overdraftDays,
      },
      isBankrupt,
    },
    result: { success: true },
  };
}
