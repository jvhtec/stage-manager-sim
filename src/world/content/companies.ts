/**
 * Real-world production / rental houses that compete with you. Founding
 * years and renames are approximate, for flavour. Companies whose
 * `enters` year is after the game start arrive as new rivals mid-game.
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
}

export const RIVAL_COMPANIES: RivalTemplate[] = [
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
