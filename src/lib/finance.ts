import { FinancesState, FinancialCategory, FinancialTransaction } from '@/types/game';

export const MAX_OVERDRAFT_DAYS = 5;

export function createTransaction(
  gameDate: Date,
  type: FinancialTransaction['type'],
  amount: number,
  description: string,
  category: FinancialCategory,
  eventId?: string,
): FinancialTransaction {
  return {
    id: `txn-${Date.now()}-${Math.random()}`,
    date: new Date(gameDate),
    type,
    amount,
    description,
    category,
    eventId,
  };
}

export function evaluateFinancialState(
  finances: FinancesState,
  newBalance: number,
): { overdraftDays: number; isBankrupt: boolean } {
  const overdraftDays = newBalance < 0 ? finances.overdraftDays + 1 : 0;
  const isBankrupt = newBalance < finances.creditLimit || overdraftDays >= MAX_OVERDRAFT_DAYS;

  return { overdraftDays, isBankrupt };
}

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

export interface BalanceTrendPoint {
  date: Date;
  balance: number;
  income: number;
  expenses: number;
  net: number;
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

export function getBalanceTrend(
  transactions: FinancialTransaction[],
  referenceDate: Date,
  days = 30,
): BalanceTrendPoint[] {
  if (transactions.length === 0 || days <= 0) {
    return [];
  }

  const sorted = [...transactions].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  const startDate = new Date(referenceDate);
  startDate.setHours(0, 0, 0, 0);
  startDate.setDate(startDate.getDate() - (days - 1));

  const startKey = startDate.getTime();
  const dailyTotals = new Map<number, { income: number; expenses: number }>();

  let runningBalanceBeforeWindow = 0;

  sorted.forEach(txn => {
    const normalized = new Date(txn.date);
    normalized.setHours(0, 0, 0, 0);
    const key = normalized.getTime();

    const delta = txn.type === 'income' ? txn.amount : -txn.amount;

    if (key < startKey) {
      runningBalanceBeforeWindow += delta;
      return;
    }

    const totals = dailyTotals.get(key) ?? { income: 0, expenses: 0 };
    if (txn.type === 'income') {
      totals.income += txn.amount;
    } else {
      totals.expenses += txn.amount;
    }
    dailyTotals.set(key, totals);
  });

  const points: BalanceTrendPoint[] = [];
  let balance = runningBalanceBeforeWindow;

  for (let i = 0; i < days; i++) {
    const day = new Date(startDate);
    day.setDate(startDate.getDate() + i);
    const key = day.getTime();
    const totals = dailyTotals.get(key) ?? { income: 0, expenses: 0 };
    balance += totals.income - totals.expenses;

    points.push({
      date: day,
      balance,
      income: totals.income,
      expenses: totals.expenses,
      net: totals.income - totals.expenses,
    });
  }

  return points;
}

export function calculateBalanceToLimit(balance: number, creditLimit: number) {
  return balance - creditLimit;
}
