/**
 * Star techs: a few of the real big names behind the desk, per era — a
 * tribute, so they appear only in their professional roles. Career windows
 * are approximate. Hire one, put them on a truck, and every show that truck
 * plays gets better; shows for acts they're known for get better still.
 *
 * Edit freely (and add your own local legends — `countries` limits a tech to
 * those home markets; leave it unset for the international names).
 */
import type { Dept } from '../types';
import type { CountryCode } from './countries';

export interface StarTech {
  id: string;
  name: string;
  role: string;
  dept: Dept;
  /** Career window — available to hire from `from`, retires after `to`. */
  from: number;
  to: number;
  /** 1-3: how much they lift a show. */
  skill: number;
  /** Acts they're famous for — an extra lift on those shows. */
  knownFor: string[];
  fee: number;
  wagePerDay: number;
  countries?: CountryCode[];
}

export const STAR_TECHS: StarTech[] = [
  // FOH engineers
  { id: 'bruce-jackson', name: 'Bruce Jackson', role: 'FOH engineer', dept: 'console', from: 1970, to: 1995, skill: 3, knownFor: ['Bruce Springsteen'], fee: 9000, wagePerDay: 380 },
  { id: 'buford-jones', name: 'Buford Jones', role: 'FOH engineer', dept: 'console', from: 1975, to: 2005, skill: 2, knownFor: ['Pink Floyd', 'David Bowie'], fee: 7000, wagePerDay: 320 },
  { id: 'joe-oherlihy', name: "Joe O'Herlihy", role: 'Audio director', dept: 'console', from: 1978, to: 2025, skill: 3, knownFor: ['U2'], fee: 12000, wagePerDay: 450 },
  { id: 'dave-natale', name: 'Dave Natale', role: 'FOH engineer', dept: 'console', from: 1980, to: 2020, skill: 3, knownFor: ['The Rolling Stones', 'Tina Turner', 'Fleetwood Mac'], fee: 11000, wagePerDay: 420 },
  { id: 'big-mick', name: 'Big Mick Hughes', role: 'FOH engineer', dept: 'console', from: 1984, to: 2025, skill: 3, knownFor: ['Metallica'], fee: 10000, wagePerDay: 400 },
  { id: 'robert-scovill', name: 'Robert Scovill', role: 'FOH engineer', dept: 'console', from: 1985, to: 2020, skill: 2, knownFor: ['Tom Petty & the Heartbreakers'], fee: 8000, wagePerDay: 340 },

  // Lighting and show design
  { id: 'marc-brickman', name: 'Marc Brickman', role: 'Lighting designer', dept: 'lighting', from: 1975, to: 2010, skill: 3, knownFor: ['Pink Floyd', 'Bruce Springsteen'], fee: 9000, wagePerDay: 380 },
  { id: 'patrick-woodroffe', name: 'Patrick Woodroffe', role: 'Lighting designer', dept: 'lighting', from: 1980, to: 2025, skill: 3, knownFor: ['The Rolling Stones'], fee: 11000, wagePerDay: 420 },
  { id: 'willie-williams', name: 'Willie Williams', role: 'Show designer', dept: 'lighting', from: 1982, to: 2025, skill: 3, knownFor: ['U2'], fee: 11000, wagePerDay: 420 },
  { id: 'leroy-bennett', name: 'LeRoy Bennett', role: 'Lighting designer', dept: 'lighting', from: 1980, to: 2025, skill: 3, knownFor: ['Prince', 'Lady Gaga'], fee: 10000, wagePerDay: 400 },
  { id: 'peter-morse', name: 'Peter Morse', role: 'Lighting designer', dept: 'lighting', from: 1980, to: 2020, skill: 2, knownFor: ['Garth Brooks'], fee: 7500, wagePerDay: 330 },

  // Staging and production
  { id: 'mark-fisher', name: 'Mark Fisher', role: 'Stage architect', dept: 'stage', from: 1977, to: 2013, skill: 3, knownFor: ['Pink Floyd', 'The Rolling Stones', 'U2'], fee: 12000, wagePerDay: 440 },
  { id: 'jake-berry', name: 'Jake Berry', role: 'Production manager', dept: 'stage', from: 1980, to: 2025, skill: 3, knownFor: ['The Rolling Stones', 'U2'], fee: 10000, wagePerDay: 400 },
  { id: 'es-devlin', name: 'Es Devlin', role: 'Stage designer', dept: 'stage', from: 2005, to: 2030, skill: 3, knownFor: ['Beyoncé', 'U2', 'Adele'], fee: 12000, wagePerDay: 450 },
];

export function getTech(id: string): StarTech {
  const t = STAR_TECHS.find(x => x.id === id);
  if (!t) throw new Error(`Unknown tech ${id}`);
  return t;
}

export function techsActiveIn(year: number, country: string): StarTech[] {
  return STAR_TECHS.filter(t => t.from <= year && year <= t.to && (!t.countries || t.countries.includes(country as CountryCode)));
}

/** Show-quality lift from the star techs on site (capped so they can't carry a show alone). */
export function techBonus(techIds: string[], act: string): number {
  const lift = techIds.reduce((sum, id) => {
    const t = getTech(id);
    return sum + 0.025 * t.skill + (t.knownFor.includes(act) ? 0.05 : 0);
  }, 0);
  return Math.min(0.15, lift);
}
