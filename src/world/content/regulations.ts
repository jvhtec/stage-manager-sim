/**
 * Low-emission zones. From a given year, certain cities charge (or fine)
 * vehicles that don't meet an emission class — the world's Euro norms, London's
 * LEZ and ULEZ, Germany's Umweltzonen, Madrid Central… Years and fines are
 * approximate and for flavour; edit freely. Cities are the in-game names.
 */
import type { CountryCode } from './countries';

/** Emission class a vehicle bought in `year` meets (a Euro 0-6 style ladder). */
export function emissionClassIn(year: number): number {
  return year >= 2014 ? 6 : year >= 2009 ? 5 : year >= 2005 ? 4 : year >= 2000 ? 3 : year >= 1996 ? 2 : year >= 1992 ? 1 : 0;
}

export interface ZonePhase {
  /** First year it's enforced. */
  from: number;
  /** Cities it covers. */
  cities: string[];
  /** Vehicles below this class pay. */
  minClass: number;
  /** Daily charge or fine, in home-currency units, per vehicle on site. */
  charge: number;
  /** What the scheme is called. */
  name: string;
}

export const ZONES: Record<CountryCode, ZonePhase[]> = {
  GB: [
    { from: 2008, cities: ['London'], minClass: 3, charge: 200, name: 'London Low Emission Zone' },
    { from: 2019, cities: ['London'], minClass: 5, charge: 100, name: 'London ULEZ' },
    { from: 2021, cities: ['Birmingham'], minClass: 5, charge: 50, name: 'Birmingham Clean Air Zone' },
    { from: 2022, cities: ['Bristol', 'Manchester'], minClass: 5, charge: 50, name: 'Clean Air Zones' },
    { from: 2023, cities: ['Glasgow'], minClass: 5, charge: 60, name: 'Glasgow LEZ' },
  ],
  DE: [
    { from: 2008, cities: ['Berlin', 'Köln', 'Hamburg', 'München'], minClass: 4, charge: 100, name: 'Umweltzone' },
    { from: 2012, cities: ['Berlin', 'Köln', 'Hamburg', 'München'], minClass: 5, charge: 100, name: 'Umweltzone (green sticker)' },
  ],
  FR: [
    { from: 2015, cities: ['Paris'], minClass: 2, charge: 90, name: 'Paris Crit’Air zone' },
    { from: 2019, cities: ['Paris', 'Lyon'], minClass: 3, charge: 90, name: 'ZFE' },
    { from: 2022, cities: ['Paris', 'Lyon', 'Marseille'], minClass: 4, charge: 135, name: 'ZFE-m' },
  ],
  IT: [
    { from: 2008, cities: ['Milano'], minClass: 3, charge: 100, name: 'Ecopass' },
    { from: 2012, cities: ['Milano', 'Roma'], minClass: 4, charge: 100, name: 'Area C / ZTL' },
  ],
  ES: [
    { from: 2018, cities: ['Madrid'], minClass: 4, charge: 90, name: 'Madrid Central' },
    { from: 2020, cities: ['Barcelona'], minClass: 4, charge: 90, name: 'ZBE Rondes' },
    { from: 2022, cities: ['Madrid', 'Valencia', 'Sevilla'], minClass: 5, charge: 90, name: 'Zonas de Bajas Emisiones' },
  ],
  US: [{ from: 2010, cities: ['Los Angeles'], minClass: 4, charge: 150, name: 'CARB truck & bus rule' }],
};

/** The strictest rule in force at `cityName` in `year`, if any. */
export function zoneIn(country: CountryCode, cityName: string, year: number): ZonePhase | undefined {
  return (ZONES[country] ?? [])
    .filter(p => year >= p.from && p.cities.includes(cityName))
    .sort((a, b) => b.minClass - a.minClass || b.charge - a.charge)[0];
}

/** Rules that start in `year` for the country, for the New Year news. */
export const zonesStarting = (country: CountryCode, year: number): ZonePhase[] => (ZONES[country] ?? []).filter(p => p.from === year);
