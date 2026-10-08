/**
 * The business climate, year by year: how much work is out there, what it
 * pays, and what the bank charges. Approximate history for flavour — edit
 * freely. Periods are [from, to] inclusive, by year (and optionally month).
 */
import type { CountryCode } from './countries';

export interface ClimatePeriod {
  id: string;
  /** First month in effect, as year + month (1-12). */
  from: [number, number];
  /** Last month in effect. */
  to: [number, number];
  /** Multiplier on how many shows get offered. */
  demand: number;
  /** Multiplier on what they pay. */
  fees: number;
  label: string;
  /** Announced when the period starts. */
  news: string;
  /** Limited to these home countries; unset = everywhere. */
  countries?: CountryCode[];
  /** Live events are shut down: booked shows are cancelled and wages are partly covered. */
  shutdown?: boolean;
}

export const CLIMATE: ClimatePeriod[] = [
  { id: 'oil', from: [1974, 1], to: [1975, 12], demand: 0.85, fees: 0.9, label: 'Oil crisis', news: 'Fuel prices and a slump: promoters are cautious.' },
  { id: 'recession80', from: [1980, 1], to: [1982, 12], demand: 0.85, fees: 0.9, label: 'Recession', news: 'Recession bites — fewer shows, tighter budgets.', countries: ['GB', 'US', 'DE', 'FR', 'IT'] },
  { id: 'transicion', from: [1977, 1], to: [1982, 12], demand: 1.1, fees: 0.95, label: 'La Transición', news: 'New freedoms, new scene: live music is everywhere.', countries: ['ES'] },
  { id: 'movida', from: [1983, 1], to: [1989, 12], demand: 1.15, fees: 1.05, label: 'La Movida', news: 'La Movida is in full swing — town halls are booking concerts for every fiesta.', countries: ['ES'] },
  { id: 'boom80', from: [1983, 1], to: [1989, 12], demand: 1.1, fees: 1.1, label: 'Stadium boom', news: 'Big rock, big money: stadium tours are booming.', countries: ['GB', 'US', 'DE', 'FR', 'IT'] },
  { id: 'reunification', from: [1990, 1], to: [1991, 12], demand: 1.12, fees: 1.05, label: 'Reunification', news: 'The Wall is down: a whole new circuit opens up in the East.', countries: ['DE'] },
  { id: 'recession90', from: [1990, 7], to: [1993, 6], demand: 0.88, fees: 0.92, label: 'Recession', news: 'Recession: tours are cut short and budgets slashed.', countries: ['GB', 'US', 'FR', 'IT'] },
  { id: 'expo92', from: [1992, 1], to: [1992, 12], demand: 1.2, fees: 1.1, label: 'Olympics & Expo', news: "Barcelona '92 and Expo Sevilla: Spain's biggest year for events ever.", countries: ['ES'] },
  { id: 'crisis93', from: [1993, 1], to: [1994, 12], demand: 0.85, fees: 0.9, label: 'Post-’92 crisis', news: 'The party is over: after 1992, budgets collapse.', countries: ['ES'] },
  { id: 'growth90s', from: [1995, 1], to: [2000, 12], demand: 1.05, fees: 1.05, label: 'Growth', news: 'Good times: festivals and tours multiply.' },
  { id: 'slump01', from: [2001, 9], to: [2002, 12], demand: 0.9, fees: 0.92, label: 'Touring slump', news: 'After September 11, tours are cancelled and insurance costs soar.' },
  { id: 'liveboom', from: [2003, 1], to: [2008, 6], demand: 1.12, fees: 1.1, label: 'Live boom', news: 'Records stop selling — so artists tour harder than ever. Live is king.' },
  { id: 'crash08', from: [2008, 9], to: [2010, 12], demand: 0.85, fees: 0.88, label: 'Financial crisis', news: 'Banks are failing: sponsors pull out and budgets shrink.' },
  { id: 'crisis-es', from: [2011, 1], to: [2014, 12], demand: 0.8, fees: 0.85, label: 'Debt crisis', news: 'Austerity: town-hall fiestas cut back, and live music VAT jumps to 21% (2012).', countries: ['ES', 'IT'] },
  { id: 'liveboom2', from: [2011, 1], to: [2020, 2], demand: 1.12, fees: 1.12, label: 'Festival boom', news: 'Festival season never ends: live music is the industry’s engine.', countries: ['GB', 'US', 'DE', 'FR'] },
  { id: 'recovery-es', from: [2015, 1], to: [2020, 2], demand: 1.1, fees: 1.05, label: 'Recovery', news: 'The festival circuit comes back stronger than before.', countries: ['ES', 'IT'] },
  { id: 'covid', from: [2020, 3], to: [2021, 5], demand: 0.03, fees: 0.8, label: 'Pandemic shutdown', news: 'Pandemic: all live events are cancelled. Government schemes cover part of crew wages.', shutdown: true },
  { id: 'reopening', from: [2021, 6], to: [2021, 12], demand: 0.6, fees: 0.9, label: 'Reopening', news: 'Live events return — socially distanced and half-full.' },
  { id: 'rebound', from: [2022, 1], to: [2024, 12], demand: 1.25, fees: 1.15, label: 'Post-pandemic rebound', news: 'Every act is back on the road at once — and there are not enough crews to go round.' },
];

/** Support schemes during a shutdown, by country. */
export const WAGE_SCHEMES: Record<CountryCode, string> = {
  GB: 'furlough',
  US: 'PPP loans',
  ES: 'ERTE',
  DE: 'Kurzarbeit',
  FR: 'chômage partiel',
  IT: 'cassa integrazione',
};

/** Approximate central-bank rate (%) from the given year on; banks lend at this plus a margin. */
const BASE_RATES: Record<CountryCode | 'ECB', [number, number][]> = {
  GB: [[1970, 7], [1974, 11.5], [1977, 7], [1979, 14], [1980, 16], [1982, 10], [1985, 12], [1987, 9], [1989, 14], [1990, 15], [1992, 7], [1994, 5.5], [1998, 7], [2001, 5], [2003, 3.75], [2007, 5.5], [2009, 0.5], [2022, 3], [2023, 5]],
  US: [[1970, 6], [1974, 9], [1976, 5], [1979, 11], [1980, 13], [1981, 16], [1982, 12], [1983, 9], [1987, 7], [1989, 9], [1991, 5.5], [1993, 3], [1995, 5.75], [2001, 3.75], [2002, 1.75], [2004, 1.25], [2006, 5], [2008, 2], [2009, 0.25], [2018, 1.75], [2020, 0.25], [2022, 1.75], [2023, 5]],
  ES: [[1970, 7], [1977, 12], [1980, 15], [1985, 12], [1990, 14.5], [1993, 11], [1995, 9], [1997, 5.5]],
  DE: [[1970, 6], [1975, 4.5], [1980, 7.5], [1983, 4], [1989, 6], [1992, 8.75], [1995, 3.5]],
  FR: [[1970, 7], [1974, 11], [1980, 12], [1985, 10], [1990, 10], [1993, 7], [1996, 4]],
  IT: [[1970, 6], [1974, 12], [1980, 16.5], [1984, 15.5], [1988, 12.5], [1992, 13], [1995, 9], [1997, 5.5]],
  ECB: [[1999, 3], [2001, 4.5], [2003, 2], [2006, 3.5], [2008, 4], [2009, 1], [2012, 0.75], [2016, 0], [2022, 2], [2023, 4.5]],
};
const EURO_FROM = 1999;
const EUROZONE: CountryCode[] = ['ES', 'DE', 'FR', 'IT'];

const lookup = (table: [number, number][], year: number) => table.reduce((rate, [from, r]) => (year >= from ? r : rate), table[0][1]);

export function baseRate(country: CountryCode, year: number): number {
  if (EUROZONE.includes(country) && year >= EURO_FROM) return lookup(BASE_RATES.ECB, year);
  return lookup(BASE_RATES[country], year);
}

const monthIndex = ([y, m]: [number, number]) => y * 12 + (m - 1);

export function climateAt(country: CountryCode, year: number, month: number): ClimatePeriod[] {
  const at = year * 12 + (month - 1);
  return CLIMATE.filter(p => (!p.countries || p.countries.includes(country)) && monthIndex(p.from) <= at && at <= monthIndex(p.to));
}

/** Busy summers, dead Januaries: share of a normal month's offers. */
export const SEASON = [0.6, 0.75, 0.95, 1, 1.1, 1.25, 1.3, 1.2, 1.05, 1.05, 1, 0.95];
