/**
 * When the famous rooms were actually there. A landmark venue only takes
 * bookings in the years it stood: the O2 opens in 2007, Wembley's twin towers
 * are gone between 2001 and 2006, Roig Arena is a 2025 building. Rooms not
 * listed here (and every procedural room) have always been there.
 *
 * Keyed by the venue's in-game (current) name. `opens` is the first year it
 * can host; `shut` lists [from, to) year ranges it was closed.
 */
export interface VenueYears {
  opens?: number;
  shut?: [number, number][];
  /** What to say when it opens. */
  note?: string;
}

export const VENUE_YEARS: Record<string, VenueYears> = {
  // United Kingdom
  'The O2': { opens: 2007, note: 'a 20,000-seat arena inside the old Millennium Dome' },
  'Wembley Stadium': { shut: [[2001, 2007]], note: 'rebuilt, with its arch' },
  'Manchester Arena': { opens: 1995, note: 'then the biggest indoor arena in Europe' },
  'OVO Hydro': { opens: 2013, note: 'Glasgow’s "Armadillo" arena' },
  'NEC Arena': { opens: 1980 },
  'Birmingham Symphony Hall': { opens: 1991 },
  // Spain
  'Palau Sant Jordi': { opens: 1990, note: 'built for the 1992 Olympics' },
  'Estadio de La Cartuja': { opens: 1999 },
  'Bizkaia Arena (BEC)': { opens: 2004 },
  'Roig Arena': { opens: 2025 },
  // Germany
  'Uber Arena': { opens: 2008, note: 'by the Spree, next to the old Wall' },
  'Barclays Arena': { opens: 2002 },
  'Lanxess Arena': { opens: 1998 },
  // France
  'Accor Arena (Bercy)': { opens: 1984, note: 'the grass-roofed pyramid at Bercy' },
  'Stade de France': { opens: 1998, note: 'built for the World Cup' },
  'LDLC Arena': { opens: 2023 },
  // Italy
  'Unipol Forum': { opens: 1990 },
};

/** Whether a venue called `name` is standing in `year`. */
export function venueOpenIn(name: string, year: number): boolean {
  const v = VENUE_YEARS[name];
  if (!v) return true;
  if (v.opens !== undefined && year < v.opens) return false;
  return !v.shut?.some(([from, to]) => year >= from && year < to);
}

/** The landmarks (by name) that open their doors in `year`. */
export const openingsIn = (year: number): string[] => Object.keys(VENUE_YEARS).filter(n => VENUE_YEARS[n].opens === year);
/** The landmarks that close at the start of `year`. */
export const closuresIn = (year: number): string[] => Object.keys(VENUE_YEARS).filter(n => VENUE_YEARS[n].shut?.some(([from]) => from === year));
/** The landmarks that reopen in `year` after a closure. */
export const reopeningsIn = (year: number): string[] => Object.keys(VENUE_YEARS).filter(n => VENUE_YEARS[n].shut?.some(([, to]) => to === year));
