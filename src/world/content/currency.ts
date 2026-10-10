/**
 * Money, as it was spelt in the year. The euro only arrived in 2002 (accounts from 1999):
 * before that Spain paid in pesetas, Germany in marks, France in francs, Italy in lire.
 * The game keeps one set of numbers (roughly euros, pounds or dollars of the day) and
 * prints them at the irrevocable conversion rates, so a €3,000 fee reads as 499,158 pts.
 */
export interface Currency {
  symbol: string;
  /** Display units per game unit. */
  rate: number;
  /** Symbol after the number ("1,000 pts") rather than before ("£1,000"). */
  after: boolean;
}

const EURO_FROM = 2002;
const EURO: Currency = { symbol: '€', rate: 1, after: false };

const LEGACY: Record<string, Currency> = {
  ES: { symbol: 'pts', rate: 166.386, after: true },
  DE: { symbol: 'DM', rate: 1.95583, after: true },
  FR: { symbol: 'F', rate: 6.55957, after: true },
  IT: { symbol: 'L.', rate: 1936.27, after: false },
};

const ALWAYS: Record<string, Currency> = {
  GB: { symbol: '£', rate: 1, after: false },
  US: { symbol: '$', rate: 1, after: false },
};

export function currencyFor(country: string | undefined, year: number): Currency {
  const code = country ?? 'ES';
  if (ALWAYS[code]) return ALWAYS[code];
  return year < EURO_FROM && LEGACY[code] ? LEGACY[code] : EURO;
}

const wrap = (c: Currency, sign: string, body: string) => (c.after ? `${sign}${body} ${c.symbol}` : `${sign}${c.symbol}${body}`);

/** "£12,500" / "-12.500 pts" style, in full. */
export function formatAmount(c: Currency, amount: number): string {
  return wrap(c, amount < 0 ? '-' : '', Math.abs(Math.round(amount * c.rate)).toLocaleString('en-US'));
}

/** Compact: "£3.0k", "£12k", "£4.5M". */
export function formatCompact(c: Currency, amount: number): string {
  const x = Math.abs(amount * c.rate);
  const body = x >= 1e6 ? `${(x / 1e6).toFixed(x >= 1e7 ? 0 : 1)}M` : x >= 1e4 ? `${Math.round(x / 1000)}k` : `${(x / 1000).toFixed(1)}k`;
  return wrap(c, amount < 0 ? '-' : '', body);
}
