/**
 * Real-world production / rental houses that compete with you — the
 * international giants everywhere, plus the local firms of your home country.
 *
 * Founding years, specialties, renames and mergers are approximate and for
 * flavour — entries marked `// verify` are best guesses. Edit freely: the
 * game only reads what's here.
 *
 * Liveries are deliberately muted so they never clash with the player's
 * new-company palette.
 */
import type { Dept } from '../types';
import type { CountryCode } from './countries';

export interface RivalTemplate {
  id: string;
  name: string;
  color: string;
  specialty: Dept;
  /** Where they trade: country codes, or '*' for the international giants who go everywhere. */
  countries: (CountryCode | '*')[];
  /** Venue tiers they chase. */
  minTier: number;
  maxTier: number;
  startingReputation: number;
  /** Year they appear on the map (≤ start year = there from day one). */
  enters: number;
  renames?: { year: number; name: string; news: string }[];
  /** Year they leave the market (merged, acquired, closed). */
  exits?: { year: number; news: string };
}

const T = (t: RivalTemplate) => t;

export const RIVAL_COMPANIES: RivalTemplate[] = [
  // --- International — compete in every country ------------------------------
  T({
    id: 'clair', name: 'Clair Brothers', color: '#0e7490', specialty: 'audio', countries: ['*'],
    minTier: 3, maxTier: 4, startingReputation: 78, enters: 1966,
    renames: [{ year: 2010, name: 'Clair Global', news: 'Clair Brothers rebrands worldwide as Clair Global.' }],
  }),
  T({
    id: 'lsd', name: 'Light & Sound Design', color: '#57534e', specialty: 'lighting', countries: ['*'],
    minTier: 3, maxTier: 4, startingReputation: 60, enters: 1979,
    renames: [{ year: 2001, name: 'PRG', news: 'Light & Sound Design is folded into Production Resource Group — say hello to PRG.' }],
  }),
  T({
    id: 'solotech', name: 'Solotech', color: '#3f6212', specialty: 'video', countries: ['*'],
    minTier: 3, maxTier: 4, startingReputation: 50, enters: 2005,
  }),

  // --- United Kingdom ---------------------------------------------------------
  T({ id: 'britrow', name: 'Britannia Row', color: '#7f1d1d', specialty: 'audio', countries: ['GB'], minTier: 2, maxTier: 4, startingReputation: 58, enters: 1975 }),
  T({ id: 'wigwam', name: 'Wigwam Acoustics', color: '#4d7c0f', specialty: 'audio', countries: ['GB'], minTier: 1, maxTier: 3, startingReputation: 36, enters: 1976 }),
  T({ id: 'negearth', name: 'Neg Earth Lights', color: '#854d0e', specialty: 'lighting', countries: ['GB'], minTier: 1, maxTier: 3, startingReputation: 42, enters: 1979 }),
  T({ id: 'sse', name: 'SSE Audio', color: '#1e3a5f', specialty: 'audio', countries: ['GB'], minTier: 1, maxTier: 3, startingReputation: 44, enters: 1977 }), // verify year
  T({ id: 'adlib', name: 'Adlib', color: '#713f12', specialty: 'audio', countries: ['GB'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1985 }), // verify year
  T({ id: 'capital', name: 'Capital Sound', color: '#365314', specialty: 'audio', countries: ['GB'], minTier: 2, maxTier: 3, startingReputation: 40, enters: 1985 }), // verify year
  T({
    id: 'xlvideo', name: 'XL Video', color: '#831843', specialty: 'video', countries: ['GB'], minTier: 2, maxTier: 4, startingReputation: 48, enters: 1993,
    exits: { year: 2011, news: 'XL Video is absorbed into PRG — its screens now tour under the PRG banner.' },
  }),
  T({ id: 'ct', name: 'Creative Technology', color: '#155e75', specialty: 'video', countries: ['GB'], minTier: 3, maxTier: 4, startingReputation: 52, enters: 1996 }),

  // --- United States ----------------------------------------------------------
  T({
    id: 'soundimage', name: 'Silverfish Audio', color: '#1e3a5f', specialty: 'audio', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 56, enters: 1974,
    renames: [{ year: 1984, name: 'Sound Image', news: 'Silverfish Audio becomes Southern California Sound Image.' }],
  }),
  T({ id: 'thunder', name: 'Thunder Audio', color: '#78350f', specialty: 'audio', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 48, enters: 1977 }), // verify year
  T({ id: 'eighthday', name: 'Eighth Day Sound', color: '#4c1d95', specialty: 'audio', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 50, enters: 1980 }), // verify year
  T({ id: 'showco', name: 'Showco', color: '#7c2d12', specialty: 'audio', countries: ['US'], minTier: 3, maxTier: 4, startingReputation: 62, enters: 1970 }), // verify
  T({ id: 'bandit', name: 'Bandit Lites', color: '#134e4a', specialty: 'lighting', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 50, enters: 1968 }),
  T({ id: 'upstaging', name: 'Upstaging', color: '#1e293b', specialty: 'lighting', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 46, enters: 1977 }),
  T({ id: 'firehouse', name: 'Firehouse Productions', color: '#9f1239', specialty: 'audio', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 44, enters: 1993 }), // verify year
  T({ id: 'christie', name: 'Christie Lites', color: '#713f12', specialty: 'lighting', countries: ['US'], minTier: 1, maxTier: 3, startingReputation: 44, enters: 1994 }),

  // --- España -------------------------------------------------------------------
  T({ id: 'fluge', name: 'Fluge Audiovisuales', color: '#0f766e', specialty: 'audio', countries: ['ES'], minTier: 2, maxTier: 4, startingReputation: 52, enters: 1990 }), // verify year
  T({ id: 'delta', name: 'Delta Sound', color: '#365314', specialty: 'audio', countries: ['ES'], minTier: 1, maxTier: 3, startingReputation: 40, enters: 1990 }), // verify year
  T({ id: 'tycho', name: 'Tycho Brahe', color: '#134e4a', specialty: 'lighting', countries: ['ES'], minTier: 1, maxTier: 3, startingReputation: 40, enters: 1990 }), // verify everything
  T({ id: 'pronorte', name: 'Pronorte Sonido', color: '#78350f', specialty: 'audio', countries: ['ES'], minTier: 1, maxTier: 3, startingReputation: 36, enters: 1990 }), // verify year
  T({ id: 'tole', name: 'Sonido Tole', color: '#854d0e', specialty: 'audio', countries: ['ES'], minTier: 1, maxTier: 3, startingReputation: 34, enters: 1990 }), // verify year

  // --- France (Dushow also runs a Barcelona base) -------------------------------
  T({ id: 'dushow', name: 'Dushow', color: '#1e3a5f', specialty: 'lighting', countries: ['FR', 'ES'], minTier: 2, maxTier: 4, startingReputation: 54, enters: 1980 }), // verify year
  T({ id: 'melpomen', name: 'Melpomen', color: '#7f1d1d', specialty: 'audio', countries: ['FR'], minTier: 1, maxTier: 4, startingReputation: 46, enters: 1985 }), // verify year
  T({ id: 'mes', name: 'MES', color: '#4d7c0f', specialty: 'lighting', countries: ['FR'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1985 }), // verify year
  T({ id: 'novelty', name: 'Novelty', color: '#713f12', specialty: 'video', countries: ['FR'], minTier: 1, maxTier: 3, startingReputation: 40, enters: 1985 }), // verify

  // --- Deutschland --------------------------------------------------------------
  T({ id: 'blackbox', name: 'Black Box Music', color: '#1e293b', specialty: 'audio', countries: ['DE'], minTier: 2, maxTier: 4, startingReputation: 50, enters: 1985 }), // verify
  T({ id: 'nmueller', name: 'Neumann&Müller', color: '#155e75', specialty: 'video', countries: ['DE'], minTier: 2, maxTier: 4, startingReputation: 48, enters: 1990 }), // verify
  T({ id: 'satisfy', name: 'Satis&fy', color: '#831843', specialty: 'stage', countries: ['DE'], minTier: 2, maxTier: 4, startingReputation: 46, enters: 1990 }), // verify
  T({ id: 'feedback', name: 'Feedback Show Systems', color: '#4d7c0f', specialty: 'audio', countries: ['DE'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1990 }), // verify
  T({ id: 'crystal', name: 'Crystal Sound', color: '#854d0e', specialty: 'audio', countries: ['DE'], minTier: 1, maxTier: 3, startingReputation: 36, enters: 1990 }), // verify
  T({ id: 'niclen', name: 'NicLen', color: '#78350f', specialty: 'lighting', countries: ['DE'], minTier: 1, maxTier: 3, startingReputation: 36, enters: 1990 }), // verify

  // --- Italia -------------------------------------------------------------------
  T({ id: 'agora', name: 'Agorà', color: '#0f766e', specialty: 'audio', countries: ['IT'], minTier: 2, maxTier: 4, startingReputation: 46, enters: 1990 }),
  T({ id: 'mastervoice', name: 'Mastervoice', color: '#7f1d1d', specialty: 'audio', countries: ['IT'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1990 }), // verify
  T({ id: 'limelite', name: 'Limelite', color: '#854d0e', specialty: 'lighting', countries: ['IT'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1990 }), // verify
];

export function rivalsFor(country: CountryCode): RivalTemplate[] {
  return RIVAL_COMPANIES.filter(t => t.countries.includes('*') || t.countries.includes(country));
}
