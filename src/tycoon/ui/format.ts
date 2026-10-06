export const money = (n: number) => `${n < 0 ? '-' : ''}$${Math.abs(Math.round(n)).toLocaleString()}`;

export const kmoney = (n: number) =>
  Math.abs(n) >= 10000 ? `$${Math.round(n / 1000)}k` : `$${(n / 1000).toFixed(1)}k`;

const RATING_LABELS = ['Appalling', 'Very Poor', 'Poor', 'Mediocre', 'Good', 'Very Good', 'Excellent', 'Outstanding'];

/** TT-style local-authority rating words. */
export function ratingLabel(rating: number): string {
  return RATING_LABELS[Math.max(0, Math.min(7, Math.floor(rating / 12.5)))];
}
