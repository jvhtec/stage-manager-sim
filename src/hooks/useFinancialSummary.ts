import { useMemo } from 'react';
import { useGame } from '@/contexts/GameContext';
import {
  MAX_OVERDRAFT_DAYS,
  calculateBalanceToLimit,
  calculateTotals,
  getBalanceTrend,
  getThirtyDaySummary,
  summarizeByCategory,
} from '@/lib/finance';

export function useFinancialSummary() {
  const { gameState } = useGame();
  const { finances, company, currentDate, isBankrupt } = gameState;

  return useMemo(() => {
    const sortedTransactions = [...finances.transactions].sort(
      (a, b) => b.date.getTime() - a.date.getTime(),
    );

    const totals = calculateTotals(finances.transactions);
    const net = totals.income - totals.expenses;
    const thirtyDay = getThirtyDaySummary(finances.transactions, currentDate);
    const categorySummary = summarizeByCategory(finances.transactions);
    const balanceToLimit = calculateBalanceToLimit(company.balance, finances.creditLimit);
    const balanceTrend = getBalanceTrend(finances.transactions, currentDate);

    const negativeNetDays = balanceTrend.filter(point => point.net < 0).length;

    const alerts: {
      key: string;
      title: string;
      description: string;
      variant: 'default' | 'destructive';
    }[] = [];

    if (isBankrupt) {
      alerts.push({
        key: 'bankrupt',
        title: 'Bankruptcy in Effect',
        description:
          'Operations are frozen until you restore solvency in the Finances panel.',
        variant: 'destructive',
      });
    } else {
      if (company.balance < 0) {
        alerts.push({
          key: 'negative-balance',
          title: 'Negative Cash Balance',
          description: 'Cash reserves are negative. Secure income or cut expenses soon.',
          variant: 'destructive',
        });
      }

      if (balanceToLimit < 2000) {
        alerts.push({
          key: 'limit-warning',
          title: 'Approaching Credit Limit',
          description: 'Your balance is within $2,000 of the credit line. Additional expenses risk bankruptcy.',
          variant: 'default',
        });
      }

      if (finances.overdraftDays >= MAX_OVERDRAFT_DAYS - 1 && company.balance < 0) {
        alerts.push({
          key: 'overdraft-warning',
          title: 'Overdraft Penalties Imminent',
          description: `Negative cash has persisted for ${finances.overdraftDays} days. Bankruptcy will trigger after ${MAX_OVERDRAFT_DAYS} days in overdraft.`,
          variant: 'default',
        });
      }

      if (thirtyDay.net < 0) {
        alerts.push({
          key: 'cash-burn',
          title: 'Negative Cash Flow Trend',
          description: 'Expenses have outpaced income over the last 30 days. Review budgets or secure higher-paying gigs.',
          variant: 'default',
        });
      }

      if (negativeNetDays >= Math.ceil(balanceTrend.length * 0.6) && balanceTrend.length > 0) {
        alerts.push({
          key: 'sustained-burn',
          title: 'Sustained Daily Losses',
          description: 'Most recent days finished negative. Consider pausing equipment rentals or renegotiating rates.',
          variant: 'default',
        });
      }
    }

    return {
      sortedTransactions,
      totals: {
        ...totals,
        net,
      },
      thirtyDay,
      categorySummary,
      balanceToLimit,
      balanceTrend,
      alerts,
    };
  }, [finances, company.balance, currentDate, isBankrupt]);
}
