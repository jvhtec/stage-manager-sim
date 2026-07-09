import { FinancialTransaction, GameState, MarketNewsItem } from '@/types/game';

export interface DaySummary {
  date: Date;
  balanceDelta: number;
  reputationDelta: number;
  newTransactions: FinancialTransaction[];
  newNews: MarketNewsItem[];
  moraleShiftsCount: number;
  becameBankrupt: boolean;
  isGameOver: boolean;
}

/**
 * Diffs the state before/after an advanceDay call into a human-readable
 * "while you slept" summary. Pure and diff-based rather than a return value
 * threaded through the engine — advanceDay's own output shape stays
 * unchanged, and every field here is derivable from state the caller
 * already has on both sides of the call.
 */
export function computeDaySummary(prev: GameState, next: GameState): DaySummary {
  const newTransactions = next.finances.transactions.slice(prev.finances.transactions.length);

  const prevNewsIds = new Set(prev.marketNews.map(item => item.id));
  const newNews = next.marketNews.filter(item => !prevNewsIds.has(item.id));

  const moraleShiftsCount = next.crew.filter(
    crew => crew.recentMoraleShift && crew.recentMoraleShift.date.getTime() === next.currentDate.getTime(),
  ).length;

  return {
    date: next.currentDate,
    balanceDelta: next.company.balance - prev.company.balance,
    reputationDelta: next.company.reputation - prev.company.reputation,
    newTransactions,
    newNews,
    moraleShiftsCount,
    becameBankrupt: next.isBankrupt && !prev.isBankrupt,
    isGameOver: next.isGameOver,
  };
}
