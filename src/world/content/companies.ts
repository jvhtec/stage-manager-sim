/**
 * Real-world production / rental houses that compete with you.
 *
 * Founding years, specialties, renames and mergers are approximate and for
 * flavour — entries marked `// verify` are best guesses. Edit freely: the
 * game only reads what's here.
 *
 * Liveries are deliberately muted so they never clash with the player's
 * new-company palette.
 */
import type { Dept } from '../types';

export interface RivalTemplate {
  id: string;
  name: string;
  color: string;
  specialty: Dept;
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

export const RIVAL_COMPANIES: RivalTemplate[] = [
  // --- Trading from day one -------------------------------------------------
  {
    id: 'clair',
    name: 'Clair Brothers',
    color: '#0e7490',
    specialty: 'audio',
    minTier: 3,
    maxTier: 4,
    startingReputation: 78,
    enters: 1966,
    renames: [{ year: 2010, name: 'Clair Global', news: 'Clair Brothers rebrands worldwide as Clair Global.' }],
  },
  {
    id: 'soundimage',
    name: 'Sound Image',
    color: '#1e3a5f',
    specialty: 'audio',
    minTier: 2,
    maxTier: 4,
    startingReputation: 56,
    enters: 1971,
  },
  {
    id: 'britrow',
    name: 'Britannia Row',
    color: '#7f1d1d',
    specialty: 'audio',
    minTier: 2,
    maxTier: 4,
    startingReputation: 58,
    enters: 1975,
  },
  {
    id: 'wigwam',
    name: 'Wigwam Acoustics',
    color: '#4d7c0f',
    specialty: 'audio',
    minTier: 1,
    maxTier: 3,
    startingReputation: 36,
    enters: 1976,
  },
  {
    id: 'thunder',
    name: 'Thunder Audio',
    color: '#78350f',
    specialty: 'audio',
    minTier: 2,
    maxTier: 3,
    startingReputation: 46,
    enters: 1977, // verify
  },
  {
    id: 'lsd',
    name: 'Light & Sound Design',
    color: '#57534e',
    specialty: 'lighting',
    minTier: 3,
    maxTier: 4,
    startingReputation: 60,
    enters: 1979,
    renames: [{ year: 2001, name: 'PRG', news: 'Light & Sound Design is folded into Production Resource Group — say hello to PRG.' }],
  },
  {
    id: 'negearth',
    name: 'Neg Earth Lights',
    color: '#854d0e',
    specialty: 'lighting',
    minTier: 1,
    maxTier: 3,
    startingReputation: 42,
    enters: 1979,
  },
  {
    id: 'eighthday',
    name: 'Eighth Day Sound',
    color: '#4c1d95',
    specialty: 'audio',
    minTier: 2,
    maxTier: 4,
    startingReputation: 50,
    enters: 1980, // verify
  },
  {
    id: 'tycho',
    name: 'Tycho Brahe',
    color: '#134e4a',
    specialty: 'lighting', // verify
    minTier: 1,
    maxTier: 3,
    startingReputation: 40,
    enters: 1985, // verify
  },
  {
    id: 'delta',
    name: 'Delta',
    color: '#365314',
    specialty: 'audio', // verify
    minTier: 1,
    maxTier: 3,
    startingReputation: 34,
    enters: 1988, // verify
  },
  {
    id: 'silverfish',
    name: 'Silverfish',
    color: '#64748b',
    specialty: 'video', // verify
    minTier: 1,
    maxTier: 3,
    startingReputation: 32,
    enters: 1990, // verify
  },

  // --- Arriving later -------------------------------------------------------
  {
    id: 'xlvideo',
    name: 'XL Video',
    color: '#831843',
    specialty: 'video',
    minTier: 2,
    maxTier: 4,
    startingReputation: 48,
    enters: 1993,
    exits: { year: 2011, news: 'XL Video is absorbed into PRG — its screens now tour under the PRG banner.' },
  },
  {
    id: 'christie',
    name: 'Christie Lites',
    color: '#713f12',
    specialty: 'lighting',
    minTier: 1,
    maxTier: 3,
    startingReputation: 44,
    enters: 1994,
  },
  {
    id: 'ct',
    name: 'Creative Technology',
    color: '#155e75',
    specialty: 'video',
    minTier: 3,
    maxTier: 4,
    startingReputation: 52,
    enters: 1996,
  },
  {
    id: 'solotech',
    name: 'Solotech',
    color: '#3f6212',
    specialty: 'video',
    minTier: 2,
    maxTier: 4,
    startingReputation: 50,
    enters: 2005,
  },
];
