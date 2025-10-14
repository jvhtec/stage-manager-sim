import { FinancialCategory, FinancialTransaction } from '@/types/game';

export const MAX_OVERDRAFT_DAYS = 5;

export interface CategorySummary {
  category: FinancialCategory;
  income: number;
  expenses: number;
  net: number;
  count: number;
}

export interface ThirtyDaySummary {
  transactions: FinancialTransaction[];
  net: number;
  incomeCount: number;
  expenseCount: number;
}

export function calculateTotals(transactions: FinancialTransaction[]) {
  return transactions.reduce(
    (acc, txn) => {
      if (txn.type === 'income') {
        acc.income += txn.amount;
        acc.incomeCount += 1;
      } else {
        acc.expenses += txn.amount;
        acc.expenseCount += 1;
      }
      return acc;
    },
    { income: 0, expenses: 0, incomeCount: 0, expenseCount: 0 },
  );
}

export function summarizeByCategory(
  transactions: FinancialTransaction[],
): CategorySummary[] {
  const summaryMap = new Map<FinancialCategory, CategorySummary>();

  transactions.forEach(txn => {
    const existing = summaryMap.get(txn.category) ?? {
      category: txn.category,
      income: 0,
      expenses: 0,
      net: 0,
      count: 0,
    };

    if (txn.type === 'income') {
      existing.income += txn.amount;
      existing.net += txn.amount;
    } else {
      existing.expenses += txn.amount;
      existing.net -= txn.amount;
    }

    existing.count += 1;
    summaryMap.set(txn.category, existing);
  });

  return Array.from(summaryMap.values()).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

export function getThirtyDaySummary(
  transactions: FinancialTransaction[],
  referenceDate: Date,
): ThirtyDaySummary {
  const thirtyDaysAgo = new Date(referenceDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const windowTransactions = transactions.filter(txn => txn.date >= thirtyDaysAgo);
  const counts = calculateTotals(windowTransactions);
  const net = windowTransactions.reduce(
    (sum, txn) => sum + (txn.type === 'income' ? txn.amount : -txn.amount),
    0,
  );

  return {
    transactions: windowTransactions,
    net,
    incomeCount: counts.incomeCount,
    expenseCount: counts.expenseCount,
  };
}

export function calculateBalanceToLimit(balance: number, creditLimit: number) {
  return balance - creditLimit;
}
