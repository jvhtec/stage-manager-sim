import { KM_PER_UNIT } from '@/world/pathfinding';
import { currencyFor, formatAmount, formatCompact, type Currency } from '@/world/content/currency';

let currency: Currency = currencyFor('GB', 2000);

/** Set once per render from the save's home country and year (the euro only arrives in 2002). */
export function setCurrency(country: string | undefined, year: number) {
  currency = currencyFor(country, year);
}

export const currencySymbol = () => currency.symbol;

let miles = false;

/** Britain and America measure roads in miles. */
export function setDistanceUnit(country: string | undefined) {
  miles = country === 'GB' || country === 'US';
}

/** A game distance (18 km per unit) in the player's own unit: "320 km" / "199 mi". */
export function distance(units: number): string {
  const km = units * KM_PER_UNIT;
  return miles ? `${Math.round(km * 0.621371).toLocaleString('en-US')} mi` : `${Math.round(km).toLocaleString('en-US')} km`;
}

export const money = (n: number) => formatAmount(currency, n);

export const kmoney = (n: number) => formatCompact(currency, n);

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
