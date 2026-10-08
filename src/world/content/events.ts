/**
 * Special events: the nights the whole industry talks about. One-off moments
 * (Live Aid, The Wall in Berlin, Barcelona '92, the Bicentenaire…) and the
 * big recurring dates (Super Bowl halftime, the BRITs, Sanremo, Primo
 * Maggio…).
 *
 * Dates, venues and scale are approximate — for flavour, edit freely. Each
 * event is tendered department by department (see events.ts), so a company
 * can win the audio and lose the lighting. `near` lists towns on our map,
 * closest first.
 *
 * `kind: 'citywide'` events don't tender a production: they flood the
 * calendar with small shows on the day (Fête de la Musique, the Love Parade).
 */
import type { Dept } from '../types';
import type { CountryCode } from './countries';

export type EventKind = 'charity' | 'ceremony' | 'broadcast' | 'concert' | 'citywide';

export interface SpecialEvent {
  id: string;
  name: string;
  country: CountryCode;
  kind: EventKind;
  /** One-offs: the year it happened. Recurring: the first year. */
  year: number;
  /** Recurring events run every year from `year` to `until` (inclusive). */
  recurring?: { until?: number; skip?: number[] };
  month: number;
  day: number;
  days?: number;
  near: string[];
  /** 3 = arena-scale, 4 = stadium-scale, 5 = beyond anything else that year. */
  scale: 3 | 4 | 5;
  /** Departments tendered as separate contracts. */
  lots: Dept[];
  /** Live on television around the world: nothing may be late or fail. */
  broadcast?: boolean;
  /** Who's on the bill, for the news. */
  bill?: string;
  /** For citywide events: how many small shows it spawns. */
  shows?: number;
}

const E = (e: SpecialEvent) => e;
const AV: Dept[] = ['audio', 'lighting', 'video'];
const ALL: Dept[] = ['audio', 'lighting', 'video', 'stage'];

export const SPECIAL_EVENTS: SpecialEvent[] = [
  // ---- United Kingdom --------------------------------------------------------
  E({ id: 'liveaid-uk', name: 'Live Aid', country: 'GB', kind: 'charity', year: 1985, month: 7, day: 13, near: ['London'], scale: 5, lots: ALL, broadcast: true, bill: 'Queen, U2, David Bowie, Elton John, Paul McCartney' }),
  E({ id: 'mandela88', name: 'Nelson Mandela 70th Birthday Tribute', country: 'GB', kind: 'charity', year: 1988, month: 6, day: 11, near: ['London'], scale: 4, lots: AV, broadcast: true, bill: 'Dire Straits, Simple Minds, Whitney Houston, Stevie Wonder' }),
  E({ id: 'knebworth90', name: 'Knebworth ’90', country: 'GB', kind: 'charity', year: 1990, month: 6, day: 30, near: ['London'], scale: 4, lots: AV, bill: 'Pink Floyd, Paul McCartney, Genesis, Eric Clapton' }),
  E({ id: 'freddie92', name: 'The Freddie Mercury Tribute Concert', country: 'GB', kind: 'charity', year: 1992, month: 4, day: 20, near: ['London'], scale: 4, lots: AV, broadcast: true, bill: 'Queen, David Bowie, George Michael, Elton John, Metallica' }),
  E({ id: 'knebworth96', name: 'Oasis at Knebworth', country: 'GB', kind: 'concert', year: 1996, month: 8, day: 10, days: 2, near: ['London'], scale: 5, lots: ALL, bill: 'Oasis — 250,000 people over two nights' }),
  E({ id: 'jubilee02', name: 'Party at the Palace', country: 'GB', kind: 'ceremony', year: 2002, month: 6, day: 3, near: ['London'], scale: 4, lots: AV, broadcast: true, bill: 'Brian May on the roof of Buckingham Palace' }),
  E({ id: 'commonwealth02', name: 'Commonwealth Games opening ceremony', country: 'GB', kind: 'ceremony', year: 2002, month: 7, day: 25, near: ['Manchester'], scale: 4, lots: ALL, broadcast: true }),
  E({ id: 'live8-uk', name: 'Live 8 London', country: 'GB', kind: 'charity', year: 2005, month: 7, day: 2, near: ['London'], scale: 5, lots: ALL, broadcast: true, bill: 'Pink Floyd reunited, U2, Paul McCartney, Coldplay' }),
  E({ id: 'diana07', name: 'Concert for Diana', country: 'GB', kind: 'charity', year: 2007, month: 7, day: 1, near: ['London'], scale: 4, lots: AV, broadcast: true, bill: 'Elton John, Duran Duran, Kanye West' }),
  E({ id: 'london2012', name: 'London 2012 opening ceremony', country: 'GB', kind: 'ceremony', year: 2012, month: 7, day: 27, near: ['London'], scale: 5, lots: ALL, broadcast: true, bill: 'Isles of Wonder' }),
  E({ id: 'onelove17', name: 'One Love Manchester', country: 'GB', kind: 'charity', year: 2017, month: 6, day: 4, near: ['Manchester'], scale: 4, lots: AV, broadcast: true, bill: 'Ariana Grande, Coldplay, Take That' }),
  E({ id: 'eurovision-uk77', name: 'Eurovision Song Contest', country: 'GB', kind: 'broadcast', year: 1977, month: 5, day: 7, near: ['London'], scale: 3, lots: AV, broadcast: true }),
  E({ id: 'eurovision-uk82', name: 'Eurovision Song Contest', country: 'GB', kind: 'broadcast', year: 1982, month: 4, day: 24, near: ['Leeds'], scale: 3, lots: AV, broadcast: true }),
  E({ id: 'eurovision-uk98', name: 'Eurovision Song Contest', country: 'GB', kind: 'broadcast', year: 1998, month: 5, day: 9, near: ['Birmingham'], scale: 4, lots: AV, broadcast: true }),
  E({ id: 'eurovision-uk23', name: 'Eurovision Song Contest', country: 'GB', kind: 'broadcast', year: 2023, month: 5, day: 13, near: ['Liverpool'], scale: 4, lots: ALL, broadcast: true }),
  E({ id: 'brits', name: 'The BRIT Awards', country: 'GB', kind: 'broadcast', year: 1982, recurring: {}, month: 2, day: 18, near: ['London'], scale: 3, lots: AV, broadcast: true }),

  // ---- United States -----------------------------------------------------------
  E({ id: 'la84', name: 'Los Angeles 1984 Olympics opening ceremony', country: 'US', kind: 'ceremony', year: 1984, month: 7, day: 28, near: ['Los Angeles'], scale: 5, lots: ALL, broadcast: true }),
  E({ id: 'liveaid-us', name: 'Live Aid Philadelphia', country: 'US', kind: 'charity', year: 1985, month: 7, day: 13, near: ['Philadelphia'], scale: 5, lots: ALL, broadcast: true, bill: 'Led Zeppelin, Madonna, Bob Dylan, Tina Turner' }),
  E({ id: 'farmaid', name: 'Farm Aid', country: 'US', kind: 'charity', year: 1985, recurring: { skip: [1988, 1989, 1991] }, month: 9, day: 22, near: ['Chicago', 'Nashville', 'Dallas', 'Minneapolis', 'Philadelphia'], scale: 4, lots: AV, bill: 'Willie Nelson, Neil Young, John Mellencamp' }),
  E({ id: 'houston86', name: 'Jean-Michel Jarre: Rendez-vous Houston', country: 'US', kind: 'concert', year: 1986, month: 4, day: 5, near: ['Houston'], scale: 5, lots: ['audio', 'lighting', 'video'], bill: 'Lasers and projections across the downtown skyline' }),
  E({ id: 'superbowl', name: 'Super Bowl halftime show', country: 'US', kind: 'broadcast', year: 1991, recurring: {}, month: 2, day: 1, near: ['Miami', 'New Orleans', 'Atlanta', 'Houston', 'Los Angeles', 'Dallas', 'Minneapolis', 'Detroit'], scale: 4, lots: ALL, broadcast: true }),
  E({ id: 'wc94', name: 'World Cup ’94 opening ceremony', country: 'US', kind: 'ceremony', year: 1994, month: 6, day: 17, near: ['Chicago'], scale: 4, lots: AV, broadcast: true, bill: 'Diana Ross' }),
  E({ id: 'woodstock94', name: 'Woodstock ’94', country: 'US', kind: 'concert', year: 1994, month: 8, day: 12, days: 3, near: ['New York'], scale: 5, lots: ALL, bill: 'Green Day, Nine Inch Nails, Metallica, Aerosmith' }),
  E({ id: 'atlanta96', name: 'Atlanta 1996 Olympics opening ceremony', country: 'US', kind: 'ceremony', year: 1996, month: 7, day: 19, near: ['Atlanta'], scale: 5, lots: ALL, broadcast: true }),
  E({ id: 'woodstock99', name: 'Woodstock ’99', country: 'US', kind: 'concert', year: 1999, month: 7, day: 23, days: 3, near: ['New York', 'Boston'], scale: 5, lots: ALL, bill: 'Red Hot Chili Peppers, Metallica, Korn' }),
  E({ id: 'nyc01', name: 'The Concert for New York City', country: 'US', kind: 'charity', year: 2001, month: 10, day: 20, near: ['New York'], scale: 4, lots: AV, broadcast: true, bill: 'Paul McCartney, The Who, David Bowie, Bon Jovi' }),
  E({ id: 'live8-us', name: 'Live 8 Philadelphia', country: 'US', kind: 'charity', year: 2005, month: 7, day: 2, near: ['Philadelphia'], scale: 5, lots: ALL, broadcast: true, bill: 'Stevie Wonder, Jay-Z, Linkin Park' }),

  // ---- Spain ----------------------------------------------------------------------
  E({ id: 'mundial82', name: 'Mundial ’82 opening ceremony', country: 'ES', kind: 'ceremony', year: 1982, month: 6, day: 13, near: ['Barcelona'], scale: 4, lots: AV, broadcast: true }),
  E({ id: 'papa82', name: 'Misa del Papa en la Castellana', country: 'ES', kind: 'ceremony', year: 1982, month: 11, day: 2, near: ['Madrid'], scale: 5, lots: ['audio', 'stage'], bill: 'A million people on the Paseo de la Castellana' }),
  E({ id: 'amnesty88', name: 'Human Rights Now! (Amnistía Internacional)', country: 'ES', kind: 'charity', year: 1988, month: 9, day: 10, near: ['Barcelona'], scale: 4, lots: AV, bill: 'Bruce Springsteen, Sting, Peter Gabriel, Tracy Chapman' }), // verify date
  E({ id: 'expo92', name: 'Expo ’92 opening', country: 'ES', kind: 'ceremony', year: 1992, month: 4, day: 20, near: ['Sevilla'], scale: 4, lots: ALL, broadcast: true }),
  E({ id: 'bcn92', name: 'Barcelona ’92 opening ceremony', country: 'ES', kind: 'ceremony', year: 1992, month: 7, day: 25, near: ['Barcelona'], scale: 5, lots: ALL, broadcast: true, bill: 'Montserrat Caballé, Plácido Domingo, Josep Carreras' }),
  E({ id: 'ema02', name: 'MTV Europe Music Awards', country: 'ES', kind: 'broadcast', year: 2002, month: 11, day: 14, near: ['Barcelona'], scale: 4, lots: AV, broadcast: true }),
  E({ id: 'expo08', name: 'Expo Zaragoza 2008 opening', country: 'ES', kind: 'ceremony', year: 2008, month: 6, day: 14, near: ['Zaragoza'], scale: 4, lots: ALL, broadcast: true }),
  E({ id: 'ema10', name: 'MTV Europe Music Awards', country: 'ES', kind: 'broadcast', year: 2010, month: 11, day: 7, near: ['Madrid'], scale: 4, lots: AV, broadcast: true }),
  E({ id: 'jmj11', name: 'JMJ Madrid — Cuatro Vientos', country: 'ES', kind: 'ceremony', year: 2011, month: 8, day: 20, days: 2, near: ['Madrid'], scale: 5, lots: ['audio', 'video', 'stage'], bill: 'Over a million pilgrims on an airfield' }),
  E({ id: 'ema19', name: 'MTV Europe Music Awards', country: 'ES', kind: 'broadcast', year: 2019, month: 11, day: 3, near: ['Sevilla'], scale: 4, lots: AV, broadcast: true }),
  E({ id: 'goya', name: 'Premios Goya', country: 'ES', kind: 'broadcast', year: 1987, recurring: {}, month: 2, day: 6, near: ['Madrid'], scale: 3, lots: AV, broadcast: true }),

  // ---- Germany --------------------------------------------------------------------
  E({ id: 'eurovision-de83', name: 'Eurovision Song Contest', country: 'DE', kind: 'broadcast', year: 1983, month: 4, day: 23, near: ['München'], scale: 3, lots: AV, broadcast: true }),
  E({ id: 'lovep', name: 'Love Parade', country: 'DE', kind: 'citywide', year: 1989, recurring: { until: 2006, skip: [2004, 2005] }, month: 7, day: 8, near: ['Berlin'], scale: 3, lots: ['audio'], shows: 8, bill: 'Floats and sound systems down the Straße des 17. Juni' }),
  E({ id: 'wall90', name: 'Roger Waters: The Wall — Live in Berlin', country: 'DE', kind: 'concert', year: 1990, month: 7, day: 21, near: ['Berlin'], scale: 5, lots: ALL, broadcast: true, bill: 'Potsdamer Platz, a 170-metre wall built and torn down' }),
  E({ id: 'ema94', name: 'MTV Europe Music Awards at the Brandenburg Gate', country: 'DE', kind: 'broadcast', year: 1994, month: 11, day: 24, near: ['Berlin'], scale: 4, lots: AV, broadcast: true }),
  E({ id: 'live8-de', name: 'Live 8 Berlin', country: 'DE', kind: 'charity', year: 2005, month: 7, day: 2, near: ['Berlin'], scale: 4, lots: AV, broadcast: true }),
  E({ id: 'wm06', name: 'World Cup 2006 opening ceremony', country: 'DE', kind: 'ceremony', year: 2006, month: 6, day: 9, near: ['München'], scale: 5, lots: ALL, broadcast: true }),
  E({ id: 'eurovision-de11', name: 'Eurovision Song Contest', country: 'DE', kind: 'broadcast', year: 2011, month: 5, day: 14, near: ['Düsseldorf'], scale: 5, lots: ALL, broadcast: true }),

  // ---- France ---------------------------------------------------------------------
  E({ id: 'eurovision-fr78', name: 'Eurovision Song Contest', country: 'FR', kind: 'broadcast', year: 1978, month: 4, day: 22, near: ['Paris'], scale: 3, lots: AV, broadcast: true }),
  E({ id: 'fete', name: 'Fête de la Musique', country: 'FR', kind: 'citywide', year: 1982, recurring: {}, month: 6, day: 21, near: ['Paris'], scale: 3, lots: ['audio'], shows: 10, bill: 'Music on every street corner, in every town' }),
  E({ id: 'lyon86', name: 'Jean-Michel Jarre: Rendez-vous Lyon', country: 'FR', kind: 'concert', year: 1986, month: 10, day: 5, near: ['Lyon'], scale: 4, lots: ['audio', 'lighting', 'video'] }),
  E({ id: 'bicentenaire', name: 'Bicentenaire de la Révolution', country: 'FR', kind: 'ceremony', year: 1989, month: 7, day: 14, near: ['Paris'], scale: 5, lots: ALL, broadcast: true, bill: 'Jean-Paul Goude’s parade down the Champs-Élysées' }),
  E({ id: 'ladefense90', name: 'Jean-Michel Jarre: Paris La Défense', country: 'FR', kind: 'concert', year: 1990, month: 7, day: 14, near: ['Paris'], scale: 5, lots: ['audio', 'lighting', 'video'], bill: 'Two and a half million people — a world record' }),
  E({ id: 'tolerance95', name: 'Jean-Michel Jarre: Concert pour la Tolérance', country: 'FR', kind: 'concert', year: 1995, month: 7, day: 14, near: ['Paris'], scale: 5, lots: ['audio', 'lighting', 'video'], bill: 'At the foot of the Eiffel Tower' }),
  E({ id: 'wc98', name: 'France ’98 opening parade', country: 'FR', kind: 'ceremony', year: 1998, month: 6, day: 9, near: ['Paris'], scale: 4, lots: ALL, broadcast: true }),
  E({ id: 'live8-fr', name: 'Live 8 Versailles', country: 'FR', kind: 'charity', year: 2005, month: 7, day: 2, near: ['Paris'], scale: 4, lots: AV, broadcast: true }),
  E({ id: 'paris24', name: 'Paris 2024 opening ceremony on the Seine', country: 'FR', kind: 'ceremony', year: 2024, month: 7, day: 26, near: ['Paris'], scale: 5, lots: ALL, broadcast: true }),

  // ---- Italy ----------------------------------------------------------------------
  E({ id: 'sanremo', name: 'Festival di Sanremo', country: 'IT', kind: 'broadcast', year: 1975, recurring: {}, month: 2, day: 8, days: 5, near: ['Genova'], scale: 3, lots: AV, broadcast: true }),
  E({ id: 'venice89', name: 'Pink Floyd in Venice', country: 'IT', kind: 'concert', year: 1989, month: 7, day: 15, near: ['Venezia'], scale: 4, lots: ['audio', 'lighting', 'stage'], bill: 'A floating stage in St Mark’s Basin' }),
  E({ id: 'primomaggio', name: 'Concerto del Primo Maggio', country: 'IT', kind: 'broadcast', year: 1990, recurring: { skip: [2020] }, month: 5, day: 1, near: ['Roma'], scale: 4, lots: AV, broadcast: true }),
  E({ id: 'italia90', name: 'Italia ’90 opening ceremony', country: 'IT', kind: 'ceremony', year: 1990, month: 6, day: 8, near: ['Milano'], scale: 4, lots: AV, broadcast: true }),
  E({ id: 'eurovision-it91', name: 'Eurovision Song Contest', country: 'IT', kind: 'broadcast', year: 1991, month: 5, day: 4, near: ['Roma'], scale: 3, lots: AV, broadcast: true }),
  E({ id: 'pavarotti', name: 'Pavarotti & Friends', country: 'IT', kind: 'charity', year: 1992, recurring: { until: 2003 }, month: 5, day: 27, near: ['Bologna', 'Parma'], scale: 4, lots: AV, broadcast: true }),
  E({ id: 'torvergata', name: 'Giubileo 2000 — Tor Vergata', country: 'IT', kind: 'ceremony', year: 2000, month: 8, day: 19, days: 2, near: ['Roma'], scale: 5, lots: ['audio', 'video', 'stage'], bill: 'Two million young pilgrims' }),
  E({ id: 'live8-it', name: 'Live 8 Rome', country: 'IT', kind: 'charity', year: 2005, month: 7, day: 2, near: ['Roma'], scale: 4, lots: AV, broadcast: true }),
  E({ id: 'torino06', name: 'Torino 2006 Winter Olympics opening', country: 'IT', kind: 'ceremony', year: 2006, month: 2, day: 10, near: ['Torino'], scale: 5, lots: ALL, broadcast: true }),
  E({ id: 'eurovision-it22', name: 'Eurovision Song Contest', country: 'IT', kind: 'broadcast', year: 2022, month: 5, day: 14, near: ['Torino'], scale: 4, lots: ALL, broadcast: true }),
];

/** Whether an event runs in a given year. */
export function eventRunsIn(e: SpecialEvent, year: number): boolean {
  if (!e.recurring) return e.year === year;
  if (year < e.year) return false;
  if (e.recurring.until !== undefined && year > e.recurring.until) return false;
  return !e.recurring.skip?.includes(year);
}

export const eventsFor = (country: CountryCode) => SPECIAL_EVENTS.filter(e => e.country === country);

export const getEvent = (id: string) => SPECIAL_EVENTS.find(e => e.id === id);

/** Days of notice before the tender closes, by scale. */
export const EVENT_NOTICE_DAYS: Record<3 | 4 | 5, number> = { 3: 50, 4: 75, 5: 110 };
