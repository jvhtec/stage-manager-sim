/**
 * Real-world touring gear by era. Each product is one "gear unit" of its
 * department — a flight-cased system package. `quality` (1-10) is what it
 * contributes to a show; audiences and riders expect more every year, so
 * yesterday's flagship becomes today's pub rig — the gear equivalent of
 * Transport Tycoon's ageing engines.
 *
 * Launch years are approximate, for flavour. Edit freely.
 */
import type { Dept } from '../types';

export interface GearProduct {
  id: string;
  brand: string;
  name: string;
  dept: Dept;
  introYear: number;
  price: number;
  quality: number;
}

export const GEAR_PRODUCTS: GearProduct[] = [
  // Audio — PA systems
  { id: 'martin-f2', brand: 'Martin Audio', name: 'F2 PA', dept: 'audio', introYear: 1984, price: 2200, quality: 4 },
  { id: 'meyer-msl3', brand: 'Meyer Sound', name: 'MSL-3', dept: 'audio', introYear: 1987, price: 2700, quality: 5 },
  { id: 'eaw-kf850', brand: 'EAW', name: 'KF850', dept: 'audio', introYear: 1990, price: 2900, quality: 5 },
  { id: 'dnb-c4', brand: 'd&b audiotechnik', name: 'C4', dept: 'audio', introYear: 1992, price: 3300, quality: 6 },
  { id: 'lacoustics-vdosc', brand: 'L-Acoustics', name: 'V-DOSC', dept: 'audio', introYear: 1993, price: 4200, quality: 7 },
  { id: 'meyer-milo', brand: 'Meyer Sound', name: 'MILO', dept: 'audio', introYear: 2002, price: 5000, quality: 8 },
  { id: 'dnb-j', brand: 'd&b audiotechnik', name: 'J-Series', dept: 'audio', introYear: 2005, price: 5800, quality: 9 },
  { id: 'lacoustics-k1', brand: 'L-Acoustics', name: 'K1', dept: 'audio', introYear: 2006, price: 6400, quality: 9 },
  { id: 'lacoustics-k2', brand: 'L-Acoustics', name: 'K2', dept: 'audio', introYear: 2013, price: 6800, quality: 10 },
  { id: 'dnb-gsl', brand: 'd&b audiotechnik', name: 'GSL', dept: 'audio', introYear: 2016, price: 7200, quality: 10 },

  // Lighting — fixtures & control
  { id: 'par64', brand: 'Thomas', name: 'PAR 64 can rig', dept: 'lighting', introYear: 1975, price: 1200, quality: 3 },
  { id: 'vari-lite-vl2', brand: 'Vari-Lite', name: 'VL2 spots', dept: 'lighting', introYear: 1986, price: 2600, quality: 5 },
  { id: 'avolites-pearl', brand: 'Avolites', name: 'Pearl desk + rig', dept: 'lighting', introYear: 1990, price: 2300, quality: 5 },
  { id: 'highend-cyberlight', brand: 'High End Systems', name: 'Cyberlight', dept: 'lighting', introYear: 1994, price: 3000, quality: 6 },
  { id: 'martin-mac500', brand: 'Martin', name: 'MAC 500', dept: 'lighting', introYear: 1995, price: 3200, quality: 6 },
  { id: 'martin-mac2000', brand: 'Martin', name: 'MAC 2000', dept: 'lighting', introYear: 1999, price: 3900, quality: 7 },
  { id: 'grandma2', brand: 'MA Lighting', name: 'grandMA2 + rig', dept: 'lighting', introYear: 2006, price: 4600, quality: 8 },
  { id: 'claypaky-sharpy', brand: 'Clay Paky', name: 'Sharpy', dept: 'lighting', introYear: 2010, price: 5000, quality: 9 },
  { id: 'robe-bmfl', brand: 'Robe', name: 'BMFL', dept: 'lighting', introYear: 2014, price: 5600, quality: 9 },
  { id: 'grandma3', brand: 'MA Lighting', name: 'grandMA3 + rig', dept: 'lighting', introYear: 2019, price: 6200, quality: 10 },

  // Video — screens & media servers
  { id: 'sony-jumbotron', brand: 'Sony', name: 'JumboTron', dept: 'video', introYear: 1985, price: 4000, quality: 3 },
  { id: 'barco-projector', brand: 'Barco', name: 'Projection kit', dept: 'video', introYear: 1990, price: 3600, quality: 4 },
  { id: 'lighthouse-led', brand: 'Lighthouse', name: 'LED screen', dept: 'video', introYear: 1998, price: 5200, quality: 6 },
  { id: 'barco-mitrix', brand: 'Barco', name: 'MiTrix LED', dept: 'video', introYear: 2004, price: 5800, quality: 7 },
  { id: 'roe-mc7', brand: 'ROE Visual', name: 'MC-7 LED', dept: 'video', introYear: 2008, price: 6200, quality: 8 },
  { id: 'disguise-d3', brand: 'disguise', name: 'd3 + LED', dept: 'video', introYear: 2012, price: 7000, quality: 9 },
  { id: 'roe-blackpearl', brand: 'ROE Visual', name: 'Black Pearl LED', dept: 'video', introYear: 2015, price: 7600, quality: 10 },

  // Staging — decks, truss, rigging, automation
  { id: 'steeldeck', brand: 'Steeldeck', name: 'Stage decks', dept: 'stage', introYear: 1980, price: 1300, quality: 4 },
  { id: 'prolyte-truss', brand: 'Prolyte', name: 'Truss & motors', dept: 'stage', introYear: 1990, price: 1700, quality: 5 },
  { id: 'cm-lodestar', brand: 'CM', name: 'Lodestar rigging', dept: 'stage', introYear: 1992, price: 2000, quality: 6 },
  { id: 'tomcat-truss', brand: 'Tomcat', name: 'Roof system', dept: 'stage', introYear: 1997, price: 2600, quality: 7 },
  { id: 'kinesys', brand: 'Kinesys', name: 'Automation', dept: 'stage', introYear: 2003, price: 3400, quality: 8 },
  { id: 'tait-set', brand: 'TAIT', name: 'Custom set', dept: 'stage', introYear: 2010, price: 4200, quality: 9 },
];

const byId = new Map(GEAR_PRODUCTS.map(p => [p.id, p]));

export function getProduct(id: string): GearProduct {
  const p = byId.get(id);
  if (!p) throw new Error(`Unknown gear product ${id}`);
  return p;
}

export function productsAvailableIn(year: number, dept?: Dept): GearProduct[] {
  return GEAR_PRODUCTS.filter(p => p.introYear <= year && (!dept || p.dept === dept));
}

/**
 * The gear quality a show at this tier expects in a given year: bigger
 * rooms want better kit, and the bar rises about one point every eight years.
 */
export function expectedQuality(tier: number, year: number): number {
  return Math.min(10, 2.5 + tier + Math.max(0, year - 1990) / 8);
}
