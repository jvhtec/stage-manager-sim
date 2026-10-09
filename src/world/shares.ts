/**
 * Going public. A well-run company can float a slice of itself on the stock
 * market for a pile of cash — and then answer to shareholders, who want
 * profits, dividends and a quiet life. Keep them happy and the share price
 * holds; let confidence drain and activists arrive, then the board throws
 * you out.
 */
import { dayOf, formatMoney, newId, pushNews, book, yearOf } from './core';
import { companyValue } from './queries';
import type { DividendLevel, TycoonState } from './types';

/** What the market needs to see before it will list you. */
export const IPO_MIN_VALUE = 1_500_000;
export const IPO_MIN_REPUTATION = 55;
export const IPO_MIN_YEARS = 4;
/** Share of the company floated. */
export const IPO_FLOAT = 0.3;
/** Underwriters' cut. */
export const IPO_FEE = 0.07;
/** Taking it private again costs a premium on the market price. */
export const BUYBACK_PREMIUM = 1.2;
export const SHARES = 100_000;
/** Confidence at which the board loses patience. */
export const OUSTED_BELOW = 8;
export const OUSTED_MONTHS = 4;
export const ACTIVIST_BELOW = 30;

export const DIVIDENDS: Record<DividendLevel, { label: string; payout: number; confidence: number; blurb: string }> = {
  none: { label: 'None', payout: 0, confidence: -1, blurb: 'Keep every penny. Shareholders grumble when you are profitable.' },
  modest: { label: 'Modest', payout: 0.2, confidence: 0.5, blurb: 'A fifth of each profitable month goes to shareholders.' },
  generous: { label: 'Generous', payout: 0.4, confidence: 1.5, blurb: '40% of each profitable month — the market loves it.' },
};

/** The books excluding share dealings. */
export function tradingTotal(s: Pick<TycoonState, 'ledger'>): number {
  let total = 0;
  Object.values(s.ledger).forEach(row => {
    (Object.keys(row) as (keyof typeof row)[]).forEach(c => {
      if (c !== 'equity') total += row[c] ?? 0;
    });
  });
  return total;
}

/** Price per share: the company's worth, swung by how the market feels about you. */
export function sharePrice(s: TycoonState): number {
  const l = s.listing;
  if (!l) return 0;
  const mood = 0.7 + 0.6 * (l.confidence / 100);
  return Math.max(0.01, (Math.max(0, companyValue(s)) * mood) / SHARES);
}

export const marketCap = (s: TycoonState) => Math.round(sharePrice(s) * SHARES);

export function listingBlocker(s: TycoonState): string | null {
  if (s.listing) return 'Already listed.';
  const years = yearOf(s, s.hour) - s.startYear;
  if (years < IPO_MIN_YEARS) return `The market wants a ${IPO_MIN_YEARS}-year track record (${years} so far).`;
  if (s.company.reputation < IPO_MIN_REPUTATION) return `Reputation ${IPO_MIN_REPUTATION}+ needed to attract investors.`;
  const value = companyValue(s);
  if (value < IPO_MIN_VALUE) return `Worth ${formatMoney(s, IPO_MIN_VALUE)}+ to list (you are at ${formatMoney(s, Math.max(0, value))}).`;
  if (s.company.cash < 0 || s.negativeMonths > 0) return 'Investors will not touch a company in the red.';
  return null;
}

export const ipoProceeds = (s: TycoonState) => Math.round((companyValue(s) * IPO_FLOAT * (1 - IPO_FEE)) / 1000) * 1000;
export const buybackCost = (s: TycoonState) => Math.round((marketCap(s) * (s.listing?.float ?? 0) * BUYBACK_PREMIUM) / 1000) * 1000;

/** Monthly: profits, dividends, confidence, activists. */
export function monthlyShares(s: TycoonState, chance: (p: number) => boolean) {
  const l = s.listing;
  if (!l) return;
  const total = tradingTotal(s);
  const net = total - l.mark;
  l.mark = total;
  const level = DIVIDENDS[l.dividend];
  let move = net >= 0 ? 1.5 : -3;
  if (net > 0) {
    const pay = Math.round((net * level.payout) / 10) * 10;
    if (pay > 0) {
      book(s, 'equity', -pay);
      l.paid += pay;
    }
    move += level.confidence;
  }
  l.confidence = Math.max(0, Math.min(100, l.confidence + move));
  l.weakMonths = l.confidence < OUSTED_BELOW ? l.weakMonths + 1 : 0;

  if (l.weakMonths >= OUSTED_MONTHS) {
    s.gameOver = { hour: s.hour, reason: `Shareholders lost confidence in ${s.company.name} and the board voted the founder out.` };
    pushNews(s, s.gameOver.reason, 'big');
    return;
  }
  if (l.confidence < ACTIVIST_BELOW && !s.dilemmas.some(d => d.kind === 'shareholders') && chance(0.35)) {
    const sweetener = Math.round((marketCap(s) * l.float * 0.04) / 1000) * 1000;
    s.dilemmas.push({
      id: newId(s, 'dl'),
      kind: 'shareholders',
      title: 'Shareholders are restless',
      text: `An activist fund has built a stake in ${s.company.name} and is demanding action: the share price has sagged and patience is thin.`,
      options: [
        { id: 'appease', label: 'Special dividend', detail: `Pay out ${formatMoney(s, sweetener)} to calm them. Confidence +25.`, cost: sweetener },
        { id: 'stand', label: 'Stand firm', detail: 'Back your plan. Confidence −10 and the press notice (reputation −2).' },
      ],
      defaultOption: 'stand',
      createdHour: s.hour,
      expiresHour: s.hour + 24 * 10,
    });
    pushNews(s, `An activist fund builds a stake in ${s.company.name}.`, 'bad');
  }
}
