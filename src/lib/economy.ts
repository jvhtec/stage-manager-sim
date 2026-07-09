import { CrewMember, EquipmentItem, FinancialTransaction } from '@/types/game';
import { createTransaction } from './finance';

/**
 * Tunable constants for the standing costs and bankruptcy-recovery lever
 * that give an idle company something to lose. All are deliberately modest
 * starting points — see docs/tycoon-game-plan.md's balancing notes.
 */

// Weekly payroll: crew in this industry are freelance, not salaried, but
// keeping a reliable roster on-call costs a modest retainer regardless of
// whether they worked a show — NOT a full 40h/week wage (that would bankrupt
// a fresh company in under two weeks against the $15k starting balance).
export const PAYROLL_INTERVAL_DAYS = 7;
export const WEEKLY_RETAINER_HOURS_PER_CREW_MEMBER = 6;

// Monthly warehouse/operations overhead, scaled to how much owned gear
// there is to store and insure.
export const RENT_INTERVAL_DAYS = 30;
export const WAREHOUSE_BASE_RENT = 300;
export const WAREHOUSE_RENT_PER_OWNED_ITEM = 40;

// Bank loan lever: a deliberate way out of a cash crunch, at a cost.
export const LOAN_DAILY_INTEREST_RATE = 0.01;
export const LOAN_BASE_LIMIT = 3000;
export const LOAN_LIMIT_PER_REPUTATION_POINT = 100;

// How many consecutive days a company can stay bankrupt before the run ends.
export const GAME_OVER_BANKRUPT_STREAK_DAYS = 5;

export function calculateMaxLoanAmount(reputation: number): number {
  return Math.round(LOAN_BASE_LIMIT + reputation * LOAN_LIMIT_PER_REPUTATION_POINT);
}

export interface StandingCostsResult {
  transactions: FinancialTransaction[];
  loanInterestAccrued: number;
}

/**
 * The bills that land regardless of whether a show happened: weekly crew
 * retainer, monthly warehouse overhead, and daily interest on any
 * outstanding loan. `daysElapsed` is the day being processed (1-indexed —
 * day 7 is the first payday), so an idle company still bleeds cash.
 */
export function calculateStandingCosts(
  crew: CrewMember[],
  equipment: EquipmentItem[],
  loanBalance: number,
  daysElapsed: number,
  currentDate: Date,
): StandingCostsResult {
  const transactions: FinancialTransaction[] = [];
  let loanInterestAccrued = 0;

  if (daysElapsed > 0 && daysElapsed % PAYROLL_INTERVAL_DAYS === 0) {
    const payroll = Math.round(
      crew.reduce((sum, member) => sum + member.hourlyRate * WEEKLY_RETAINER_HOURS_PER_CREW_MEMBER, 0),
    );
    if (payroll > 0) {
      transactions.push(
        createTransaction(currentDate, 'expense', payroll, 'Weekly crew retainer', 'payroll'),
      );
    }
  }

  if (daysElapsed > 0 && daysElapsed % RENT_INTERVAL_DAYS === 0) {
    const ownedCount = equipment.filter(item => item.owned).length;
    const rent = WAREHOUSE_BASE_RENT + ownedCount * WAREHOUSE_RENT_PER_OWNED_ITEM;
    transactions.push(
      createTransaction(currentDate, 'expense', rent, 'Warehouse & operations overhead', 'operations'),
    );
  }

  if (loanBalance > 0) {
    const interest = Math.max(1, Math.round(loanBalance * LOAN_DAILY_INTEREST_RATE));
    transactions.push(
      createTransaction(currentDate, 'expense', interest, 'Loan interest accrued', 'misc'),
    );
    loanInterestAccrued = interest;
  }

  return { transactions, loanInterestAccrued };
}
