/**
 * Real festivals by country. Each summer they put their stages out to
 * tender: the main stage and a second stage, each a multi-day contract that
 * ties up a big rig and pays like a run of arena dates.
 *
 * Founding years, dates and sizes are approximate (flavour, not a
 * reference) — edit freely. `near` lists towns on our map, closest first;
 * the festival is staged at the first one that's on the map.
 */
import type { CountryCode } from './countries';

export interface Festival {
  id: string;
  name: string;
  country: CountryCode;
  /** Venue tier of the main stage over the years, like an artist's career: [fromYear, tier]. 0 = not held. */
  size: [number, number][];
  /** Years it didn't happen (fallow years, one-offs). */
  skip?: number[];
  /** Usual start date (month 1-12, day). */
  month: number;
  day: number;
  days: number;
  near: string[];
  stages: [string, string];
}

const F = (f: Festival) => f;

export const FESTIVALS: Festival[] = [
  // United Kingdom
  F({ id: 'glastonbury', name: 'Glastonbury Festival', country: 'GB', size: [[1979, 3], [1985, 4]], skip: [1980, 1988, 1991, 1996, 2001, 2006, 2012, 2018], month: 6, day: 24, days: 3, near: ['Bristol', 'Cardiff'], stages: ['Pyramid Stage', 'Other Stage'] }),
  F({ id: 'reading', name: 'Reading Festival', country: 'GB', size: [[1971, 3], [1990, 4]], month: 8, day: 25, days: 3, near: ['London', 'Southampton'], stages: ['Main Stage', 'Second Stage'] }),
  F({ id: 'monsters', name: 'Monsters of Rock', country: 'GB', size: [[1980, 4], [1997, 0]], skip: [1989, 1993], month: 8, day: 18, days: 1, near: ['Nottingham', 'Leicester', 'Birmingham'], stages: ['Main Stage', 'Second Stage'] }),
  F({ id: 'download', name: 'Download Festival', country: 'GB', size: [[2003, 4]], month: 6, day: 10, days: 3, near: ['Nottingham', 'Leicester', 'Birmingham'], stages: ['Main Stage', 'Second Stage'] }),
  F({ id: 'tinthepark', name: 'T in the Park', country: 'GB', size: [[1994, 3], [1997, 4], [2017, 0]], month: 7, day: 8, days: 3, near: ['Glasgow', 'Edinburgh'], stages: ['Main Stage', 'King Tut’s Tent'] }),
  F({ id: 'vfest', name: 'V Festival', country: 'GB', size: [[1996, 4], [2018, 0]], month: 8, day: 19, days: 2, near: ['Birmingham', 'London'], stages: ['V Stage', 'Arena'] }),
  F({ id: 'leeds', name: 'Leeds Festival', country: 'GB', size: [[1999, 4]], month: 8, day: 25, days: 3, near: ['Leeds', 'Sheffield'], stages: ['Main Stage', 'Second Stage'] }),
  F({ id: 'iow', name: 'Isle of Wight Festival', country: 'GB', size: [[2002, 3], [2004, 4]], month: 6, day: 12, days: 3, near: ['Southampton', 'Brighton'], stages: ['Main Stage', 'Big Top'] }),
  F({ id: 'bst', name: 'BST Hyde Park', country: 'GB', size: [[2013, 4]], month: 7, day: 5, days: 2, near: ['London'], stages: ['Great Oak Stage', 'Second Stage'] }),

  // United States
  F({ id: 'jazzfest', name: 'New Orleans Jazz & Heritage Festival', country: 'US', size: [[1972, 2], [1980, 3]], month: 4, day: 27, days: 3, near: ['New Orleans'], stages: ['Acura Stage', 'Gentilly Stage'] }),
  F({ id: 'usfest', name: 'US Festival', country: 'US', size: [[1982, 4], [1984, 0]], month: 5, day: 28, days: 3, near: ['Los Angeles'], stages: ['Main Stage', 'Second Stage'] }),
  F({ id: 'coachella', name: 'Coachella', country: 'US', size: [[1999, 3], [2004, 4]], skip: [2000], month: 4, day: 12, days: 3, near: ['Los Angeles', 'Las Vegas'], stages: ['Coachella Stage', 'Outdoor Theatre'] }),
  F({ id: 'bonnaroo', name: 'Bonnaroo', country: 'US', size: [[2002, 4]], month: 6, day: 13, days: 4, near: ['Nashville', 'Atlanta'], stages: ['What Stage', 'Which Stage'] }),
  F({ id: 'acl', name: 'Austin City Limits', country: 'US', size: [[2002, 3], [2006, 4]], month: 10, day: 4, days: 3, near: ['Austin', 'Houston', 'Dallas'], stages: ['Main Stage', 'Second Stage'] }),
  F({ id: 'lollapalooza', name: 'Lollapalooza', country: 'US', size: [[2005, 4]], month: 8, day: 1, days: 3, near: ['Chicago'], stages: ['Main Stage', 'Bud Light Stage'] }),

  // Spain
  F({ id: 'esparrago', name: 'Espárrago Rock', country: 'ES', size: [[1989, 2], [1995, 3], [2006, 0]], month: 7, day: 10, days: 2, near: ['Granada', 'Córdoba', 'Málaga'], stages: ['Escenario Principal', 'Segundo Escenario'] }),
  F({ id: 'sonar', name: 'Sónar', country: 'ES', size: [[1994, 2], [2000, 3]], month: 6, day: 15, days: 3, near: ['Barcelona'], stages: ['SonarClub', 'SonarVillage'] }),
  F({ id: 'festimad', name: 'Festimad', country: 'ES', size: [[1994, 3], [2007, 0]], month: 5, day: 28, days: 2, near: ['Madrid'], stages: ['Escenario Principal', 'Segundo Escenario'] }),
  F({ id: 'fib', name: 'FIB Benicàssim', country: 'ES', size: [[1995, 3], [2000, 4]], month: 7, day: 15, days: 4, near: ['Valencia', 'Alicante'], stages: ['Escenario Verde', 'Escenario FIBClub'] }),
  F({ id: 'vinarock', name: 'Viña Rock', country: 'ES', size: [[1996, 3]], month: 4, day: 30, days: 3, near: ['Madrid', 'Valencia', 'Murcia'], stages: ['Escenario Principal', 'Segundo Escenario'] }),
  F({ id: 'doctormusic', name: 'Doctor Music Festival', country: 'ES', size: [[1996, 4], [2001, 0]], month: 7, day: 12, days: 3, near: ['Barcelona', 'Zaragoza'], stages: ['Escenario Principal', 'Segundo Escenario'] }),
  F({ id: 'primavera', name: 'Primavera Sound', country: 'ES', size: [[2001, 2], [2005, 3], [2010, 4]], month: 5, day: 30, days: 3, near: ['Barcelona'], stages: ['Escenario Estrella Damm', 'Escenario Ray-Ban'] }),
  F({ id: 'bbk', name: 'BBK Live', country: 'ES', size: [[2006, 4]], month: 7, day: 10, days: 3, near: ['Bilbao', 'Santander'], stages: ['Escenario Principal', 'Escenario Heineken'] }),
  F({ id: 'resurrection', name: 'Resurrection Fest', country: 'ES', size: [[2006, 2], [2012, 3]], month: 7, day: 1, days: 3, near: ['Vigo', 'Oviedo', 'Gijón'], stages: ['Main Stage', 'Ritual Stage'] }),
  F({ id: 'rockinrio', name: 'Rock in Rio Madrid', country: 'ES', size: [[2008, 4], [2013, 0]], skip: [2009, 2011], month: 6, day: 27, days: 2, near: ['Madrid'], stages: ['Palco Mundo', 'Escenario Sunset'] }),
  F({ id: 'arenal', name: 'Arenal Sound', country: 'ES', size: [[2010, 3]], month: 8, day: 1, days: 4, near: ['Valencia', 'Alicante'], stages: ['Escenario Principal', 'Escenario Playa'] }),
  F({ id: 'madcool', name: 'Mad Cool', country: 'ES', size: [[2016, 4]], month: 7, day: 10, days: 3, near: ['Madrid'], stages: ['Escenario Mad Cool', 'Escenario Region of Madrid'] }),

  // Germany
  F({ id: 'rockamring', name: 'Rock am Ring', country: 'DE', size: [[1985, 4]], skip: [1989, 1990], month: 6, day: 5, days: 3, near: ['Köln', 'Bonn', 'Düsseldorf'], stages: ['Volcano Stage', 'Crater Stage'] }),
  F({ id: 'wacken', name: 'Wacken Open Air', country: 'DE', size: [[1990, 1], [1995, 2], [2000, 3], [2005, 4]], month: 8, day: 1, days: 3, near: ['Hamburg', 'Kiel'], stages: ['Faster Stage', 'Harder Stage'] }),
  F({ id: 'rockimpark', name: 'Rock im Park', country: 'DE', size: [[1997, 4]], month: 6, day: 5, days: 3, near: ['Nürnberg', 'München'], stages: ['Utopia Stage', 'Mandora Stage'] }),
  F({ id: 'hurricane', name: 'Hurricane Festival', country: 'DE', size: [[1997, 3], [2003, 4]], month: 6, day: 20, days: 3, near: ['Bremen', 'Hamburg', 'Hannover'], stages: ['Green Stage', 'Red Stage'] }),
  F({ id: 'southside', name: 'Southside Festival', country: 'DE', size: [[1999, 3], [2005, 4]], month: 6, day: 20, days: 3, near: ['Stuttgart', 'Freiburg'], stages: ['Green Stage', 'Blue Stage'] }),
  F({ id: 'melt', name: 'Melt!', country: 'DE', size: [[1997, 2], [2003, 3]], month: 7, day: 15, days: 3, near: ['Leipzig', 'Dresden', 'Berlin'], stages: ['Big Wheel Stage', 'Gemini Stage'] }),
  F({ id: 'lollaberlin', name: 'Lollapalooza Berlin', country: 'DE', size: [[2015, 4]], month: 9, day: 10, days: 2, near: ['Berlin'], stages: ['Main Stage', 'Alternative Stage'] }),

  // France
  F({ id: 'bourges', name: 'Printemps de Bourges', country: 'FR', size: [[1977, 2], [1985, 3]], month: 4, day: 20, days: 5, near: ['Dijon', 'Paris'], stages: ['W', 'Palais d’Auron'] }),
  F({ id: 'francofolies', name: 'Les Francofolies', country: 'FR', size: [[1985, 3]], month: 7, day: 12, days: 5, near: ['Nantes', 'Bordeaux'], stages: ['Grande Scène', 'Scène Jean-Louis Foulquier'] }),
  F({ id: 'eurockeennes', name: 'Les Eurockéennes', country: 'FR', size: [[1989, 3], [1995, 4]], month: 7, day: 3, days: 3, near: ['Strasbourg', 'Dijon'], stages: ['Grande Scène', 'La Plage'] }),
  F({ id: 'charrues', name: 'Les Vieilles Charrues', country: 'FR', size: [[1992, 2], [1996, 3], [2000, 4]], month: 7, day: 15, days: 4, near: ['Brest', 'Rennes'], stages: ['Scène Glenmor', 'Scène Kerouac'] }),
  F({ id: 'solidays', name: 'Solidays', country: 'FR', size: [[1999, 3]], month: 6, day: 25, days: 3, near: ['Paris'], stages: ['Paris', 'Bagatelle'] }),
  F({ id: 'rockenseine', name: 'Rock en Seine', country: 'FR', size: [[2003, 3], [2006, 4]], month: 8, day: 25, days: 3, near: ['Paris'], stages: ['Grande Scène', 'Scène de la Cascade'] }),
  F({ id: 'mainsquare', name: 'Main Square Festival', country: 'FR', size: [[2004, 3]], month: 7, day: 1, days: 3, near: ['Lille'], stages: ['Main Stage', 'Green Room'] }),
  F({ id: 'hellfest', name: 'Hellfest', country: 'FR', size: [[2006, 3], [2010, 4]], month: 6, day: 18, days: 3, near: ['Nantes', 'Angers'], stages: ['Mainstage 1', 'Mainstage 2'] }),

  // Italy
  F({ id: 'umbriajazz', name: 'Umbria Jazz', country: 'IT', size: [[1973, 2], [1985, 3]], month: 7, day: 10, days: 4, near: ['Firenze', 'Ancona', 'Roma'], stages: ['Arena Santa Giuliana', 'Teatro Morlacchi'] }),
  F({ id: 'pistoia', name: 'Pistoia Blues', country: 'IT', size: [[1980, 3]], month: 7, day: 5, days: 3, near: ['Firenze'], stages: ['Piazza del Duomo', 'Second Stage'] }),
  F({ id: 'arezzowave', name: 'Arezzo Wave', country: 'IT', size: [[1987, 2], [1995, 3], [2007, 0]], month: 7, day: 1, days: 3, near: ['Firenze'], stages: ['Main Stage', 'Second Stage'] }),
  F({ id: 'godsofmetal', name: 'Gods of Metal', country: 'IT', size: [[1997, 3], [2013, 0]], month: 6, day: 25, days: 2, near: ['Milano', 'Bologna'], stages: ['Main Stage', 'Second Stage'] }),
  F({ id: 'heineken', name: 'Heineken Jammin’ Festival', country: 'IT', size: [[1998, 4], [2013, 0]], month: 6, day: 15, days: 3, near: ['Bologna', 'Venezia', 'Milano'], stages: ['Main Stage', 'Second Stage'] }),
  F({ id: 'lucca', name: 'Lucca Summer Festival', country: 'IT', size: [[1998, 3], [2005, 4]], month: 7, day: 10, days: 2, near: ['Firenze', 'Genova'], stages: ['Piazza Napoleone', 'Mura Storiche'] }),
  F({ id: 'idays', name: 'I-Days Milano', country: 'IT', size: [[2015, 4]], month: 6, day: 15, days: 3, near: ['Milano'], stages: ['Main Stage', 'Second Stage'] }),
  F({ id: 'firenzerocks', name: 'Firenze Rocks', country: 'IT', size: [[2017, 4]], month: 6, day: 13, days: 3, near: ['Firenze'], stages: ['Main Stage', 'Second Stage'] }),
];

export function festivalSize(f: Festival, year: number): number {
  if (f.skip?.includes(year)) return 0;
  return f.size.reduce((tier, [from, t]) => (year >= from ? t : tier), 0);
}

export const festivalsFor = (country: CountryCode) => FESTIVALS.filter(f => f.country === country);

export const getFestival = (id: string) => FESTIVALS.find(f => f.id === id);
