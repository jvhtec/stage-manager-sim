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
  /** Home city (a name from the country's town list); they set up there when it's on the map. */
  hq?: string;
}

const T = (t: RivalTemplate) => t;

export const RIVAL_COMPANIES: RivalTemplate[] = [
  // --- International — compete in every country ------------------------------
  T({
    id: 'clair', name: 'Clair Brothers', hq: 'Philadelphia', color: '#0e7490', specialty: 'audio', countries: ['*'],
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
  T({
    id: 'britrow', name: 'Britannia Row', hq: 'London', color: '#7f1d1d', specialty: 'audio', countries: ['GB'], minTier: 2, maxTier: 4, startingReputation: 58, enters: 1975,
    renames: [{ year: 2017, name: 'Britannia Row Productions', news: 'Clair Global acquires Britannia Row Productions.' }],
  }),
  T({ id: 'wigwam', name: 'Wigwam Acoustics', hq: 'Manchester', color: '#4d7c0f', specialty: 'audio', countries: ['GB'], minTier: 1, maxTier: 3, startingReputation: 36, enters: 1976 }),
  T({ id: 'negearth', name: 'Neg Earth Lights', hq: 'London', color: '#854d0e', specialty: 'lighting', countries: ['GB'], minTier: 1, maxTier: 3, startingReputation: 42, enters: 1979 }),
  T({ id: 'sse', name: 'SSE Audio', hq: 'Birmingham', color: '#1e3a5f', specialty: 'audio', countries: ['GB'], minTier: 1, maxTier: 3, startingReputation: 44, enters: 1977 }), // verify year
  T({ id: 'adlib', name: 'Adlib', hq: 'Liverpool', color: '#713f12', specialty: 'audio', countries: ['GB'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1985 }), // verify year
  T({ id: 'capital', name: 'Capital Sound', hq: 'London', color: '#365314', specialty: 'audio', countries: ['GB'], minTier: 2, maxTier: 3, startingReputation: 40, enters: 1985 }), // verify year
  T({
    id: 'xlvideo', name: 'XL Video', hq: 'London', color: '#831843', specialty: 'video', countries: ['GB'], minTier: 2, maxTier: 4, startingReputation: 48, enters: 1993,
    exits: { year: 2011, news: 'XL Video is absorbed into PRG — its screens now tour under the PRG banner.' },
  }),
  T({ id: 'ct', name: 'Creative Technology', hq: 'London', color: '#155e75', specialty: 'video', countries: ['GB'], minTier: 3, maxTier: 4, startingReputation: 52, enters: 1996 }),
  T({
    // Dave Martin's PA hire in the '70s (Pink Floyd, The Who, Supertramp) before the name meant loudspeakers.
    id: 'martinaudio', name: 'Martin Audio', hq: 'London', color: '#1c1917', specialty: 'audio', countries: ['GB'], minTier: 2, maxTier: 4, startingReputation: 58, enters: 1971,
    exits: { year: 1988, news: 'Martin Audio winds down its hire fleet to concentrate on building loudspeakers.' }, // verify year
  }),
  T({
    // Newbury, Berkshire (not on the town list, so they set up wherever there's room).
    id: 'skan', name: 'Skan PA Hire', color: '#4a044e', specialty: 'audio', countries: ['GB'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1976, // verify year
    exits: { year: 2024, news: 'Skan PA Hire is acquired by Britannia Row Productions.' },
  }),
  T({
    // Founded by Paul Keating and Mark Bonner.
    id: 'delta', name: 'Delta Sound', hq: 'London', color: '#3f6212', specialty: 'audio', countries: ['GB'], minTier: 2, maxTier: 4, startingReputation: 42, enters: 1988,
    renames: [{ year: 2016, name: 'DeltaLive', news: 'Delta Sound rebrands as DeltaLive.' }], // verify year
  }),
  T({ id: 'ess', name: 'ESS PA', color: '#0c4a6e', specialty: 'audio', countries: ['GB'], minTier: 1, maxTier: 3, startingReputation: 34, enters: 1995 }), // verify year/city
  T({ id: '22live', name: '22live', hq: 'Birmingham', color: '#7c2d12', specialty: 'audio', countries: ['GB'], minTier: 2, maxTier: 4, startingReputation: 44, enters: 2022 }), // Redditch, ex-SSE directors

  // --- United States ----------------------------------------------------------
  T({
    // Southern California PA pioneers (California Jam '74); later became Innovative Audio.
    id: 'tycobrahe', name: 'Tycobrahe Sound', hq: 'Los Angeles', color: '#134e4a', specialty: 'audio', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 60, enters: 1968,
    exits: { year: 1981, news: 'Tycobrahe Sound winds down — its systems live on under Innovative Audio.' },
  }),
  T({
    id: 'soundimage', name: 'Silverfish Audio', hq: 'Los Angeles', color: '#1e3a5f', specialty: 'audio', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 56, enters: 1974,
    renames: [{ year: 1984, name: 'Sound Image', news: 'Silverfish Audio becomes Southern California Sound Image.' }],
  }),
  T({ id: 'showco', name: 'Showco', hq: 'Dallas', color: '#7c2d12', specialty: 'audio', countries: ['US'], minTier: 3, maxTier: 4, startingReputation: 62, enters: 1970 }), // verify
  T({ id: 'thunder', name: 'Thunder Audio', hq: 'Detroit', color: '#78350f', specialty: 'audio', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 48, enters: 1977 }), // verify year
  T({ id: 'eighthday', name: 'Eighth Day Sound', hq: 'Detroit', color: '#4c1d95', specialty: 'audio', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 50, enters: 1980 }), // verify year (Cleveland)
  T({ id: 'bandit', name: 'Bandit Lites', hq: 'Nashville', color: '#365314', specialty: 'lighting', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 50, enters: 1968 }),
  T({ id: 'upstaging', name: 'Upstaging', hq: 'Chicago', color: '#1e293b', specialty: 'lighting', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 46, enters: 1977 }),
  T({ id: 'firehouse', name: 'Firehouse Productions', hq: 'New York', color: '#9f1239', specialty: 'audio', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 44, enters: 1993 }), // verify year
  T({ id: 'christie', name: 'Christie Lites', color: '#713f12', specialty: 'lighting', countries: ['US'], minTier: 1, maxTier: 3, startingReputation: 44, enters: 1994 }),

  // --- España -------------------------------------------------------------------
  // The big Spanish sound houses of the '80s and '90s.
  T({
    // Started as LIL Service in 1979; first Meyer Sound importer in Spain, later L-Acoustics.
    id: 'twincam', name: 'LIL Service', hq: 'Barcelona', color: '#0e7490', specialty: 'audio', countries: ['ES'], minTier: 2, maxTier: 4, startingReputation: 50, enters: 1979,
    renames: [{ year: 1990, name: 'Twin Cam Audio', news: 'LIL Service relaunches as Twin Cam Audio.' }], // verify rename year
  }),
  T({ id: 'milan', name: 'Milán Acústica', hq: 'Madrid', color: '#7f1d1d', specialty: 'audio', countries: ['ES'], minTier: 1, maxTier: 4, startingReputation: 48, enters: 1981 }),
  T({ id: 'berenice', name: 'Berenice', hq: 'Madrid', color: '#4c1d95', specialty: 'audio', countries: ['ES'], minTier: 2, maxTier: 4, startingReputation: 50, enters: 1982 }), // verify year/city
  T({ id: 'sorter', name: 'Sorter', hq: 'Madrid', color: '#854d0e', specialty: 'audio', countries: ['ES'], minTier: 2, maxTier: 4, startingReputation: 46, enters: 1984 }), // '80s, founded by musicians; EAW then L-Acoustics — verify year/city
  T({ id: 'apogee', name: 'Apogee', hq: 'Sevilla', color: '#365314', specialty: 'audio', countries: ['ES'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1985 }), // verify year
  T({ id: 'fluge', name: 'Fluge Audiovisuales', hq: 'Madrid', color: '#0f766e', specialty: 'audio', countries: ['ES'], minTier: 2, maxTier: 4, startingReputation: 44, enters: 1991 }),
  T({ id: 'pronorte', name: 'Pronorte Sonido', hq: 'Oviedo', color: '#78350f', specialty: 'audio', countries: ['ES'], minTier: 1, maxTier: 3, startingReputation: 34, enters: 1992 }), // verify year
  T({ id: 'tole', name: 'Sonido Tole', hq: 'Málaga', color: '#713f12', specialty: 'audio', countries: ['ES'], minTier: 1, maxTier: 3, startingReputation: 32, enters: 1995 }), // verify year

  // --- France -------------------------------------------------------------------
  T({ id: 'dushow', name: 'Dushow', hq: 'Paris', color: '#1e3a5f', specialty: 'lighting', countries: ['FR'], minTier: 2, maxTier: 4, startingReputation: 54, enters: 1980 }), // verify year
  T({ id: 'melpomen', name: 'Melpomen', hq: 'Nantes', color: '#7f1d1d', specialty: 'audio', countries: ['FR'], minTier: 1, maxTier: 4, startingReputation: 46, enters: 1985 }), // verify year
  T({ id: 'mes', name: 'MES', hq: 'Nantes', color: '#4d7c0f', specialty: 'lighting', countries: ['FR'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1985 }), // verify year
  T({ id: 'novelty', name: 'Novelty', hq: 'Paris', color: '#713f12', specialty: 'video', countries: ['FR'], minTier: 1, maxTier: 3, startingReputation: 40, enters: 1985 }), // verify

  // --- Deutschland --------------------------------------------------------------
  T({ id: 'blackbox', name: 'Black Box Music', hq: 'Berlin', color: '#1e293b', specialty: 'audio', countries: ['DE'], minTier: 2, maxTier: 4, startingReputation: 50, enters: 1985 }), // verify
  T({ id: 'nmueller', name: 'Neumann&Müller', hq: 'Dresden', color: '#155e75', specialty: 'video', countries: ['DE'], minTier: 2, maxTier: 4, startingReputation: 48, enters: 1990 }), // verify
  T({ id: 'satisfy', name: 'Satis&fy', hq: 'Frankfurt', color: '#831843', specialty: 'stage', countries: ['DE'], minTier: 2, maxTier: 4, startingReputation: 46, enters: 1990 }), // verify
  T({ id: 'feedback', name: 'Feedback Show Systems', color: '#4d7c0f', specialty: 'audio', countries: ['DE'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1990 }), // verify
  T({ id: 'crystal', name: 'Crystal Sound', color: '#854d0e', specialty: 'audio', countries: ['DE'], minTier: 1, maxTier: 3, startingReputation: 36, enters: 1990 }), // verify
  T({ id: 'niclen', name: 'NicLen', hq: 'Dortmund', color: '#78350f', specialty: 'lighting', countries: ['DE'], minTier: 1, maxTier: 3, startingReputation: 36, enters: 1990 }), // verify

  // --- Italia -------------------------------------------------------------------
  T({ id: 'agora', name: 'Agorà', hq: 'Pescara', color: '#0f766e', specialty: 'audio', countries: ['IT'], minTier: 2, maxTier: 4, startingReputation: 46, enters: 1990 }), // L'Aquila
  T({ id: 'mastervoice', name: 'Mastervoice', color: '#7f1d1d', specialty: 'audio', countries: ['IT'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1990 }), // verify
  T({ id: 'limelite', name: 'Limelite', hq: 'Roma', color: '#854d0e', specialty: 'lighting', countries: ['IT'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1990 }), // verify
];

export function rivalsFor(country: CountryCode): RivalTemplate[] {
  return RIVAL_COMPANIES.filter(t => t.countries.includes('*') || t.countries.includes(country));
}
