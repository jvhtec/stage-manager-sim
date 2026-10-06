let symbol = '$';

/** Set once per render from the save's home country (€, £, $). */
export function setCurrency(next: string) {
  symbol = next;
}

export const currencySymbol = () => symbol;

export const money = (n: number) => `${n < 0 ? '-' : ''}${symbol}${Math.abs(Math.round(n)).toLocaleString('en-US')}`;

export const kmoney = (n: number) =>
  Math.abs(n) >= 10000 ? `${symbol}${Math.round(n / 1000)}k` : `${symbol}${(n / 1000).toFixed(1)}k`;

const RATING_LABELS = ['Appalling', 'Very Poor', 'Poor', 'Mediocre', 'Good', 'Very Good', 'Excellent', 'Outstanding'];

/** TT-style local-authority rating words. */
export function ratingLabel(rating: number): string {
  return RATING_LABELS[Math.max(0, Math.min(7, Math.floor(rating / 12.5)))];
}

/** 6.8M / 480k */
export function formatPopulation(n: number): string {
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M` : `${Math.round(n / 1000)}k`;
}

/** What the town's venue scene amounts to — the map's size classes, in plain words. */
export function marketLabel(size: string): string {
  return { metropolis: 'Major market', city: 'Large market', town: 'Mid-size market', village: 'Small market' }[size] ?? size;
}
