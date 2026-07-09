import { FinancialCategory, GameState } from '@/types/game';
import { createTransaction, evaluateFinancialState } from '@/lib/finance';

export function updateBalance(
  state: GameState,
  amount: number,
  options?: { description?: string; category?: FinancialCategory; eventId?: string },
): GameState {
  if (amount === 0) return state;
  if (state.isBankrupt && amount < 0) return state;

  const newBalance = state.company.balance + amount;
  const transaction = createTransaction(
    state.currentDate,
    amount >= 0 ? 'income' : 'expense',
    Math.abs(amount),
    options?.description || 'Balance adjustment',
    options?.category || 'misc',
    options?.eventId,
  );

  const { overdraftDays, isBankrupt } = evaluateFinancialState(state.finances, newBalance);

  return {
    ...state,
    company: {
      ...state.company,
      balance: newBalance,
    },
    finances: {
      ...state.finances,
      transactions: [...state.finances.transactions, transaction],
      overdraftDays,
    },
    isBankrupt,
  };
}
