import { CrisisPrompt, GameState } from '@/types/game';
import { createTransaction, evaluateFinancialState } from '@/lib/finance';
import type { ActionResult } from './types';

export function respondToCrisisPrompt(
  state: GameState,
  promptId: string,
  choiceId: string,
): { state: GameState; result: ActionResult } {
  const promptIndex = state.crises.findIndex(crisis => crisis.id === promptId);
  if (promptIndex === -1) {
    return { state, result: { success: false, reason: 'Crisis prompt not found' } };
  }

  const prompt = state.crises[promptIndex];
  const event = state.events.find(e => e.id === prompt.eventId);

  if (!event || (event.status !== 'planned' && event.status !== 'in-progress')) {
    return {
      state,
      result: { success: false, reason: 'This crisis can only be addressed for scheduled events.' },
    };
  }

  if (prompt.resolved) {
    return { state, result: { success: false, reason: 'This crisis has already been resolved.' } };
  }

  const choice = prompt.choices.find(option => option.id === choiceId);
  if (!choice) {
    return { state, result: { success: false, reason: 'Resolution option not found.' } };
  }

  let newBalance = state.company.balance;
  let transactions = state.finances.transactions;

  if (choice.cost && choice.cost !== 0) {
    const costAmount = Math.abs(choice.cost);
    const isExpense = choice.cost > 0;
    const transaction = createTransaction(
      state.currentDate,
      isExpense ? 'expense' : 'income',
      costAmount,
      `${prompt.title} – ${choice.label}`,
      choice.transactionCategory ?? 'operations',
      prompt.eventId,
    );

    transactions = [...transactions, transaction];
    newBalance += isExpense ? -costAmount : costAmount;
  }

  const { overdraftDays, isBankrupt } = evaluateFinancialState(state.finances, newBalance);

  const updatedPrompt: CrisisPrompt = {
    ...prompt,
    resolved: true,
    selectedChoiceId: choice.id,
  };

  return {
    state: {
      ...state,
      company: { ...state.company, balance: newBalance },
      finances: { ...state.finances, transactions, overdraftDays },
      crises: state.crises.map((crisis, index) => (index === promptIndex ? updatedPrompt : crisis)),
      isBankrupt,
    },
    result: { success: true },
  };
}
