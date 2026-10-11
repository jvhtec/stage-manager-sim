/**
 * Real-world production / rental houses that compete with you — the local
 * firms of your home country, plus the international giants from the year they
 * actually set up a base there (touring acts brought them in earlier, but the
 * game models who had a warehouse and bid for local work).
 *
 * Founding years, bases, renames, takeovers and leaders come from trade-press
 * and company histories (docs/rival-history.md lists the sources and how sure
 * each one is). Entries marked `// verify` are still best guesses. A leader's
 * style is our reading of how the firm was run, not a claim about the person.
 *
 * Liveries are deliberately muted so they never clash with the player's
 * new-company palette.
 */
import type { Dept } from '../types';
import type { CountryCode } from './countries';

/** How a firm's boss runs it (see leaders.ts for what each does in play). */
export type LeaderStyle = 'pioneer' | 'perfectionist' | 'expansionist' | 'dealmaker' | 'prudent' | 'hustler';

export interface Leader {
  name: string;
  /** Year they took charge. */
  from: number;
  /** Last year in charge (open-ended if omitted; the next leader's `from` also ends it). */
  to?: number;
  style: LeaderStyle;
  /** A line of history for the League window and the news. */
  note?: string;
}

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
  /**
   * The international houses didn't open everywhere at once: the year they set up in a given
   * country, when it differs from `enters`. `null` = never set up a base there.
   */
  entersIn?: Partial<Record<CountryCode, number | null>>;
  /** Their base city in a given country, when it differs from `hq`. */
  hqIn?: Partial<Record<CountryCode, string>>;
  /** Their entry news in a given country (an acquisition, say), instead of the generic line. */
  entryNews?: Partial<Record<CountryCode, string>>;
  /** Who ran the firm, in order. */
  leaders?: Leader[];
  renames?: { year: number; name: string; news: string }[];
  /** Year they leave the market (merged, acquired, closed). */
  exits?: { year: number; news: string };
  /** Home city (a name from the country's town list); they set up there when it's on the map. */
  hq?: string;
}

const T = (t: RivalTemplate) => t;

export const RIVAL_COMPANIES: RivalTemplate[] = [
  // --- International — set up abroad over the years -----------------------------
  T({
    // Roy and Gene Clair, Lititz PA (nearest town on the map: Philadelphia).
    id: 'clair', name: 'Clair Brothers', hq: 'Philadelphia', color: '#0e7490', specialty: 'audio', countries: ['*'],
    minTier: 3, maxTier: 4, startingReputation: 78, enters: 1966,
    entersIn: { GB: 2008, DE: 2022, FR: null, IT: null, ES: null },
    hqIn: { GB: 'London', DE: 'Berlin' },
    entryNews: {
      GB: 'Clair buys London\'s Concert Sound — ConcertSound Clair opens for business in Britain.',
      DE: 'Clair Global takes over Black Box Music in Berlin: BBM | Clair is now bidding for German work.',
    },
    renames: [
      { year: 2000, name: 'ClairShowco', news: 'Clair Brothers buys Showco from Vari-Lite — the two biggest US sound houses are now ClairShowco.' },
      { year: 2008, name: 'Clair Global', news: 'ClairShowco drops the old names and becomes Clair Global.' },
    ],
    leaders: [
      { name: 'Roy and Gene Clair', from: 1966, to: 1994, style: 'pioneer', note: 'the brothers behind the first flown arena PA and the S4 cabinet' },
      { name: 'Troy Clair', from: 1995, style: 'dealmaker', note: 'Gene\'s son, who grows the firm by buying like-minded houses and keeping their names' },
    ],
  }),
  T({
    // Harris Production Services (New York, 1983), Production Resource Group from 1995. Light & Sound
    // Design joined it in 1998 (see 'lsd', its British side).
    id: 'prg', name: 'Harris Production Services', hq: 'New York', color: '#57534e', specialty: 'lighting', countries: ['*'],
    minTier: 3, maxTier: 4, startingReputation: 50, enters: 1983,
    entersIn: { GB: null, DE: null, FR: null, IT: null, ES: 2011 },
    hqIn: { ES: 'Madrid' },
    entryNews: { ES: 'PRG buys EML: PRG Spain opens for business in Madrid.' },
    renames: [{ year: 1995, name: 'PRG', news: 'Harris Production Services becomes Production Resource Group — PRG.' }],
    leaders: [{ name: 'Jere Harris', from: 1983, to: 2021, style: 'dealmaker', note: 'who builds PRG by buying one rental house after another' }],
  }),
  T({
    // Montreal, 1977; first US office in Las Vegas (2007), Britain through SSE (2018).
    id: 'solotech', name: 'Solotech', hq: 'Las Vegas', color: '#3f6212', specialty: 'video', countries: ['*'],
    minTier: 3, maxTier: 4, startingReputation: 50, enters: 2007,
    entersIn: { GB: 2018, DE: null, FR: null, IT: null, ES: null },
    hqIn: { GB: 'Birmingham' },
    entryNews: { GB: 'Solotech buys SSE Audio Group — the Canadians now own Britain\'s biggest sound house.' },
    leaders: [
      { name: 'Denis Lefrançois', from: 1977, to: 2016, style: 'pioneer', note: 'the Montreal Olympics sound man who founded it' }, // verify end year
      { name: 'Martin Tremblay', from: 2017, to: 2024, style: 'expansionist', note: 'ex-Ubisoft, buying his way into Britain and the US' },
    ],
  }),

  // --- United Kingdom ---------------------------------------------------------
  T({
    // Pink Floyd's touring rig, hired out between tours; bought from the band by its managers in 1984.
    id: 'britrow', name: 'Britannia Row', hq: 'London', color: '#7f1d1d', specialty: 'audio', countries: ['GB'], minTier: 2, maxTier: 4, startingReputation: 58, enters: 1975,
    renames: [{ year: 2017, name: 'Britannia Row Productions', news: 'Clair Global acquires Britannia Row Productions — the name stays.' }],
    leaders: [
      { name: 'Robbie Williams', from: 1975, to: 1983, style: 'pioneer', note: 'running Pink Floyd\'s own PA as a hire company' },
      { name: 'Bryan Grant and Robbie Williams', from: 1984, to: 1990, style: 'perfectionist', note: 'having bought the company from Pink Floyd' },
      { name: 'Bryan Grant and Mike Lowe', from: 1991, to: 2016, style: 'perfectionist', note: '"you\'re only as good as your last show"' },
      { name: 'Troy Clair', from: 2017, style: 'dealmaker', note: 'Clair Global now owns it' },
    ],
  }),
  T({
    // Heywood, near Rochdale; Mick Spratt with the Rev. Mike Huck. Year uncertain (early '70s to 1982).
    id: 'wigwam', name: 'Wigwam Acoustics', hq: 'Manchester', color: '#4d7c0f', specialty: 'audio', countries: ['GB'], minTier: 1, maxTier: 3, startingReputation: 36, enters: 1978, // verify year
    exits: { year: 2013, news: 'SSE Audio Group acquires Wigwam Acoustics.' },
  }),
  T({
    id: 'negearth', name: 'Neg Earth Lights', hq: 'London', color: '#854d0e', specialty: 'lighting', countries: ['GB'], minTier: 1, maxTier: 3, startingReputation: 42, enters: 1983,
    leaders: [{ name: 'Dave and Pip Ridgway', from: 1983, style: 'prudent', note: 'a family firm that stays independent' }],
  }),
  T({
    // A college disco at Trent Poly, Nottingham, in 1976; Birmingham from 1984, Redditch from 2003.
    id: 'sse', name: 'SSE Audio', hq: 'Nottingham', color: '#1e3a5f', specialty: 'audio', countries: ['GB'], minTier: 1, maxTier: 3, startingReputation: 44, enters: 1976,
    exits: { year: 2018, news: 'John Penn sells SSE Audio Group to Canada\'s Solotech.' },
    leaders: [{ name: 'John Penn', from: 1976, style: 'dealmaker', note: 'who builds Britain\'s biggest audio group by buying Wigwam, Capital and more' }],
  }),
  T({
    // Andy Dockerty, a small PA and a VW van on the Enterprise Allowance Scheme.
    id: 'adlib', name: 'Adlib', hq: 'Liverpool', color: '#713f12', specialty: 'audio', countries: ['GB'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1984,
    leaders: [{ name: 'Andy Dockerty', from: 1984, to: 2023, style: 'prudent', note: 'still mixing front of house and keeping Adlib independent' }],
  }),
  T({
    // Keith Davis, built on the Martin Audio F2.
    id: 'capital', name: 'Capital Sound', hq: 'London', color: '#365314', specialty: 'audio', countries: ['GB'], minTier: 2, maxTier: 3, startingReputation: 40, enters: 1989,
    exits: { year: 2018, news: 'SSE Audio Group buys Capital Sound; the name carries on inside the group.' },
  }),
  T({
    // Belgian, with a UK base.
    id: 'xlvideo', name: 'XL Video', hq: 'London', color: '#831843', specialty: 'video', countries: ['GB'], minTier: 2, maxTier: 4, startingReputation: 48, enters: 1995,
    exits: { year: 2015, news: 'XL Video is bought by PRG — its screens now tour under the PRG banner.' },
  }),
  T({
    // Sister company of Screenco; owned by Avesco, which NEP bought in 2017.
    id: 'ct', name: 'Creative Technology', hq: 'London', color: '#155e75', specialty: 'video', countries: ['GB', 'ES'], minTier: 3, maxTier: 4, startingReputation: 52, enters: 1986,
    entersIn: { ES: 2007 }, // CT Spain, L'Hospitalet
    hqIn: { ES: 'Barcelona' },
    entryNews: { ES: 'Creative Technology opens CT Spain in Barcelona.' },
    leaders: [{ name: 'Dave Crump', from: 1986, style: 'pioneer', note: 'a co-founder, early into LED screens' }], // verify
  }),
  T({
    // Dave Martin's company, which built horn-loaded PAs for the big '70s tours before it was only a
    // loudspeaker maker. Sold to TGI in 1990.
    id: 'martinaudio', name: 'Martin Audio', hq: 'London', color: '#1c1917', specialty: 'audio', countries: ['GB'], minTier: 2, maxTier: 4, startingReputation: 58, enters: 1971,
    exits: { year: 1990, news: 'Dave Martin sells Martin Audio to TGI; from now on it only builds loudspeakers.' },
    leaders: [{ name: 'Dave Martin', from: 1971, style: 'perfectionist', note: 'a brilliant horn designer, if "no businessman"' }],
  }),
  T({
    // Newbury, Berkshire (not on the town list, so they set up wherever there's room). Peter Howard's firm.
    id: 'skan', name: 'Skan PA Hire', color: '#4a044e', specialty: 'audio', countries: ['GB'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1976, // verify year
    exits: { year: 2022, news: 'Skan PA Hire is acquired by Britannia Row Productions.' },
    leaders: [{ name: 'Chris Fitch and Abby Llewellyn', from: 1996, style: 'perfectionist', note: 'who bought Skan and run it on service' }],
  }),
  T({
    // Mark Bonner and Paul Keating, Weybridge, Surrey; corporate work first (Duracell), then Dubai.
    id: 'delta', name: 'Delta Sound', hq: 'London', color: '#3f6212', specialty: 'audio', countries: ['GB'], minTier: 2, maxTier: 4, startingReputation: 42, enters: 1988,
    renames: [
      { year: 2019, name: 'DeltaLive', news: 'L-Acoustics takes a majority stake in Delta Sound, now DeltaLive.' },
      { year: 2026, name: 'Delta Live by Novelty', news: 'France\'s Groupe Novelty buys DeltaLive.' },
    ],
    leaders: [{ name: 'Mark Bonner and Paul Keating', from: 1988, to: 2019, style: 'expansionist', note: 'from corporate shows to a Dubai office' }],
  }),
  T({
    // Redditch; Paul Timmins and five other ex-SSE directors.
    id: '22live', name: '22live', hq: 'Birmingham', color: '#7c2d12', specialty: 'audio', countries: ['GB'], minTier: 2, maxTier: 4, startingReputation: 44, enters: 2022,
    leaders: [{ name: 'Spencer Beard', from: 2022, style: 'expansionist', note: 'a start-up of SSE veterans' }],
  }),
  T({
    // Birmingham, 1975: Nick Jackson, Terry Lee and Alan Whitaker. Joined PRG in 1998.
    id: 'lsd', name: 'Light & Sound Design', hq: 'Birmingham', color: '#44403c', specialty: 'lighting', countries: ['GB'], minTier: 2, maxTier: 4, startingReputation: 56, enters: 1975,
    renames: [{ year: 1998, name: 'PRG', news: 'Light & Sound Design joins Production Resource Group — say hello to PRG.' }],
    leaders: [
      { name: 'Nick Jackson', from: 1975, to: 1997, style: 'pioneer', note: 'whose R&D team builds the Icon moving light' },
      { name: 'Jere Harris', from: 1998, to: 2021, style: 'dealmaker', note: 'PRG\'s founder, buying up rental houses' },
    ],
  }),

  // --- United States ----------------------------------------------------------
  T({
    // Hermosa Beach, CA: Bob Bogdanovich, with Jim Gamble on engineering. Built the California Jam PA (1974).
    id: 'tycobrahe', name: 'Tycobrahe Sound', hq: 'Los Angeles', color: '#134e4a', specialty: 'audio', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 60, enters: 1969,
    exits: { year: 1981, news: 'Tycobrahe Sound goes out of business.' }, // verify year
    leaders: [{ name: 'Bob Bogdanovich', from: 1969, style: 'pioneer', note: 'designing his own consoles and amps' }],
  }),
  T({
    // Rochester, NY, then the San Diego area from about 1979 (Los Angeles is the nearest town on the map).
    id: 'soundimage', name: 'Silverfish Audio', hq: 'Los Angeles', color: '#1e3a5f', specialty: 'audio', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 56, enters: 1971,
    renames: [{ year: 1984, name: 'Sound Image', news: 'Silverfish Audio becomes Southern California Sound Image.' }], // 1981 in some sources
    leaders: [
      { name: 'Ross Ritto and Joel Silverman', from: 1971, to: 1980, style: 'pioneer' },
      { name: 'Dave Shadoan and Ross Ritto', from: 1981, to: 2009, style: 'perfectionist', note: '"never missed a truck, a load-in or a show"' },
      { name: 'Dave Shadoan', from: 2010, style: 'perfectionist' },
    ],
  }),
  T({
    // Jack Calmes, Rusty Brutsché and Jack Maxson, from Maxson's garage. Vari-Lite came out of it in 1981.
    id: 'showco', name: 'Showco', hq: 'Dallas', color: '#7c2d12', specialty: 'audio', countries: ['US'], minTier: 3, maxTier: 4, startingReputation: 62, enters: 1970,
    exits: { year: 2000, news: 'Vari-Lite sells Showco to Clair Brothers.' },
    leaders: [
      { name: 'Jack Calmes', from: 1970, to: 1980, style: 'perfectionist', note: 'building in-house desks and systems for Led Zeppelin and Genesis' },
      { name: 'Rusty Brutsché', from: 1981, to: 2000, style: 'pioneer', note: 'whose R&D turned into Vari-Lite' },
    ],
  }),
  T({
    // Tony Villarreal, a $1,500 tax refund and a garage; Willis, then Livonia, MI.
    id: 'thunder', name: 'Thunder Audio', hq: 'Detroit', color: '#78350f', specialty: 'audio', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 48, enters: 1978,
    leaders: [{ name: 'Tony Villarreal', from: 1978, style: 'prudent', note: 'a mix engineer growing the family business step by step' }],
  }),
  T({
    // Highland Heights, near Cleveland (not on the map).
    id: 'eighthday', name: 'Eighth Day Sound', hq: 'Detroit', color: '#4c1d95', specialty: 'audio', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 50, enters: 1980,
    exits: { year: 2020, news: 'Clair Global buys Eighth Day Sound; the name and the team carry on.' },
  }),
  T({
    // Michael Strickland, aged 12, with "borrowed" theatre lights in Kingsport, TN; Knoxville 1973, Nashville 1982.
    id: 'bandit', name: 'Bandit Lites', hq: 'Nashville', color: '#365314', specialty: 'lighting', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 50, enters: 1968,
    leaders: [
      { name: 'Michael Strickland', from: 1968, to: 2007, style: 'pioneer', note: 'early onto LED rigs, and "a rising tide floats all boats"' },
      { name: 'Peter Heffernan', from: 2008, style: 'prudent', note: 'the COO promoted to president' },
    ],
  }),
  T({
    // Robert and Don Carone with Robin Shaw, in the family garage in Des Plaines, IL.
    id: 'upstaging', name: 'Upstaging', hq: 'Chicago', color: '#1e293b', specialty: 'lighting', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 46, enters: 1972,
    leaders: [{ name: 'Robert and Don Carone', from: 1972, style: 'prudent', note: 'a family firm that promotes from within' }],
  }),
  T({
    // Red Hook, NY: a monitor specialist that grew into TV and awards shows.
    id: 'firehouse', name: 'Firehouse Productions', hq: 'New York', color: '#9f1239', specialty: 'audio', countries: ['US'], minTier: 2, maxTier: 4, startingReputation: 44, enters: 1994,
    leaders: [{ name: 'Bryan Olson', from: 1994, style: 'perfectionist', note: 'monitor engineer for The Cure and Peter Gabriel' }],
  }),
  T({
    // Toronto, 1985, in a garage; into the US from 1998 (Orlando, off the map).
    id: 'christie', name: 'Christie Lites', color: '#713f12', specialty: 'lighting', countries: ['US'], minTier: 1, maxTier: 3, startingReputation: 44, enters: 1998,
    leaders: [{ name: 'Huntly Christie', from: 1998, style: 'expansionist', note: 'the same kit list in every branch, and "we do lighting"' }],
  }),

  // --- España -------------------------------------------------------------------
  // The Spanish houses of the '80s and '90s. The international giants came late: EML (Belgium,
  // with Vari-Lite's rental arm) opened in Madrid in 1998 and became PRG Spain in 2011; Dushow
  // (France) came to Barcelona in 2005; CT in 2007. No Clair or Solotech base has been found.
  T({
    // Twin Cam Audio SL, Barcelona (registered 1990). The long-time Primavera Sound supplier.
    id: 'twincam', name: 'Twin Cam Audio', hq: 'Barcelona', color: '#0e7490', specialty: 'audio', countries: ['ES'], minTier: 2, maxTier: 4, startingReputation: 50, enters: 1990,
    leaders: [{ name: 'Rafael Campos', from: 2000, style: 'pioneer', note: 'first in Spain with each new L-Acoustics generation' }],
  }),
  T({
    // Registered in 1981; the company dates itself from 1976.
    id: 'milan', name: 'Milán Acústica', hq: 'Madrid', color: '#7f1d1d', specialty: 'audio', countries: ['ES'], minTier: 1, maxTier: 4, startingReputation: 48, enters: 1976,
  }),
  T({ id: 'berenice', name: 'Berenice', hq: 'Madrid', color: '#4c1d95', specialty: 'audio', countries: ['ES'], minTier: 2, maxTier: 4, startingReputation: 50, enters: 1982 }), // verify year/city (not in the registries)
  T({
    // Sorter SA, Madrid (now Alcorcón): L-Acoustics since 1997; Serrat & Sabina, Mad Cool, Noches del Botánico.
    id: 'sorter', name: 'Sorter', hq: 'Madrid', color: '#854d0e', specialty: 'audio', countries: ['ES'], minTier: 2, maxTier: 4, startingReputation: 46, enters: 1986,
  }),
  T({
    // Stage engineering and theatre lighting; bought by Quercus Equity with Portugal's Alfasom in 2007.
    id: 'stonex', name: 'Stonex', hq: 'Madrid', color: '#3f3f46', specialty: 'stage', countries: ['ES'], minTier: 1, maxTier: 3, startingReputation: 40, enters: 1980,
    leaders: [{ name: 'Domingo Latorre', from: 2007, style: 'dealmaker', note: 'into a private-equity Iberian group' }], // verify start
  }),
  T({
    // Lighting for TV, theatre and events; Fuenlabrada, later a Barcelona branch.
    id: 'cinelux', name: 'Cinelux', hq: 'Madrid', color: '#a16207', specialty: 'lighting', countries: ['ES'], minTier: 1, maxTier: 3, startingReputation: 36, enters: 1988,
  }),
  T({
    // Arganda del Rey: sound first, then lights, video, seven Spanish offices and five abroad.
    id: 'fluge', name: 'Fluge Audiovisuales', hq: 'Madrid', color: '#0f766e', specialty: 'audio', countries: ['ES'], minTier: 2, maxTier: 4, startingReputation: 44, enters: 1990,
    leaders: [{ name: 'Luis Berlanga', from: 2011, style: 'expansionist', note: 'Alejandro Sanz\'s whole tour, and offices from Doha to Shanghai' }], // verify start
  }),
  T({
    // Gijón; EAW from the start, Bilbao Live, Azkena Rock, Noroeste Pop Rock — and a music shop.
    id: 'pronorte', name: 'Pronorte Sonido', hq: 'Gijón', color: '#78350f', specialty: 'audio', countries: ['ES'], minTier: 1, maxTier: 3, startingReputation: 34, enters: 1987,
    leaders: [{ name: 'José Javier García Osorio', from: 1987, style: 'prudent', note: 'the festivals of the north, one brand of box' }],
  }),
  T({
    // Sevilla: live sound across the south.
    id: 'tole', name: 'Sonido Tole', hq: 'Sevilla', color: '#713f12', specialty: 'audio', countries: ['ES'], minTier: 1, maxTier: 3, startingReputation: 32, enters: 1995, // verify year
    leaders: [{ name: 'Bartolomé "Tole" López', from: 1995, style: 'pioneer', note: 'buying a bigger system to move up to bigger shows' }],
  }),
  T({
    // EML Productions (Belgium) and Vari-Lite Production Services: Sound and Light Productions SL, Madrid.
    id: 'eml', name: 'EML Productions', hq: 'Madrid', color: '#525252', specialty: 'lighting', countries: ['ES'], minTier: 2, maxTier: 4, startingReputation: 52, enters: 1998,
    exits: { year: 2011, news: 'PRG buys EML\'s Belgian parent — EML in Madrid becomes PRG Spain.' },
  }),
  T({
    // Dushow's Spanish arm: Barcelona from 2005, Madrid from 2021, Novelty Spain from 2023.
    id: 'dushowes', name: 'Dushow Barcelona', hq: 'Barcelona', color: '#1e3a5f', specialty: 'lighting', countries: ['ES'], minTier: 2, maxTier: 4, startingReputation: 48, enters: 2005,
    renames: [
      { year: 2021, name: 'Dushow Spain', news: 'Dushow\'s Spanish arm moves to Madrid as Dushow Spain.' },
      { year: 2023, name: 'Novelty Spain', news: 'Dushow Spain takes the group\'s name: Novelty Spain.' },
    ],
  }),

  // --- France -------------------------------------------------------------------
  T({
    // Roissy; also Nice, Marseille and Barcelona. Thirty years old in 2012.
    id: 'dushow', name: 'Dushow', hq: 'Paris', color: '#1e3a5f', specialty: 'lighting', countries: ['FR'], minTier: 2, maxTier: 4, startingReputation: 54, enters: 1982,
    exits: { year: 2018, news: 'Dushow joins Novelty and Magnum: the new group is the biggest in Europe.' },
  }),
  T({
    // Thierry Tranchant's firm; part of SSE Audio Group 2001-2017, then bought back by its managers.
    id: 'melpomen', name: 'Melpomen', hq: 'Nantes', color: '#7f1d1d', specialty: 'audio', countries: ['FR'], minTier: 1, maxTier: 4, startingReputation: 46, enters: 1985, // verify year
    leaders: [{ name: 'Thierry Tranchant', from: 1985, style: 'perfectionist', note: 'a decade on the road with Royal de Luxe' }],
  }),
  T({
    id: 'mes', name: 'MES Eclairages', hq: 'Nantes', color: '#4d7c0f', specialty: 'lighting', countries: ['FR'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1981,
    exits: { year: 2013, news: 'Melpomen buys MES Eclairages.' },
  }),
  T({
    // Started by Jacques de La Guillonnière as a student, as Euphonie, then Euroson.
    id: 'novelty', name: 'Novelty', hq: 'Paris', color: '#713f12', specialty: 'video', countries: ['FR'], minTier: 1, maxTier: 3, startingReputation: 40, enters: 1982, // verify year
    renames: [{ year: 2018, name: 'Novelty Magnum Dushow', news: 'Novelty, Magnum and Dushow become one group.' }],
    leaders: [{ name: 'Jacques de La Guillonnière', from: 1982, style: 'dealmaker', note: 'some seventy companies bought along the way' }],
  }),

  // --- Deutschland --------------------------------------------------------------
  T({
    id: 'blackbox', name: 'Black Box Music', hq: 'Berlin', color: '#1e293b', specialty: 'audio', countries: ['DE'], minTier: 2, maxTier: 4, startingReputation: 50, enters: 1985, // verify year
    exits: { year: 2022, news: 'Black Box Music goes to Clair Global and carries on as BBM | Clair.' },
    leaders: [{ name: 'Thilo Goos', from: 1985, style: 'perfectionist', note: 'one campus for everything a tour needs' }],
  }),
  T({
    // Students Jürgen Neumann and Eberhard Müller, starting with outdoor PA for WDR radio.
    id: 'nmueller', name: 'Neumann&Müller', hq: 'Düsseldorf', color: '#155e75', specialty: 'video', countries: ['DE'], minTier: 2, maxTier: 4, startingReputation: 48, enters: 1981,
    leaders: [{ name: 'Jürgen Neumann and Eberhard Müller', from: 1981, style: 'prudent', note: 'independent, and growing a branch at a time' }],
  }),
  T({
    // Karben, near Frankfurt: a "three-men show" in 1993.
    id: 'satisfy', name: 'satis&fy', hq: 'Frankfurt', color: '#831843', specialty: 'stage', countries: ['DE'], minTier: 2, maxTier: 4, startingReputation: 46, enters: 1993,
  }),
  T({
    // Alsdorf, near Aachen (Köln is the nearest town on the map).
    id: 'feedback', name: 'Feedback Show Systems', hq: 'Köln', color: '#4d7c0f', specialty: 'audio', countries: ['DE'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1996,
    leaders: [{ name: 'Bernd Schmitz', from: 2011, style: 'pioneer', note: 'first in Germany with Turbosound Flashline' }], // verify start
  }),
  T({
    // Karlsruhe (Mannheim is the nearest town on the map).
    id: 'crystal', name: 'Crystal Sound', hq: 'Mannheim', color: '#854d0e', specialty: 'audio', countries: ['DE'], minTier: 1, maxTier: 3, startingReputation: 36, enters: 1990, // verify year
  }),
  T({
    // Germany's biggest dry-hire house: kit to other companies, not shows.
    id: 'niclen', name: 'NicLen', hq: 'Dortmund', color: '#78350f', specialty: 'lighting', countries: ['DE'], minTier: 1, maxTier: 3, startingReputation: 36, enters: 1992,
  }),

  // --- Italia -------------------------------------------------------------------
  T({
    // L'Aquila (Pescara is the nearest town on the map): Wolfango and Vittorio De Amicis.
    id: 'agora', name: 'Agorà', hq: 'Pescara', color: '#0f766e', specialty: 'audio', countries: ['IT'], minTier: 2, maxTier: 4, startingReputation: 46, enters: 1990,
    leaders: [{ name: 'Wolfango and Vittorio De Amicis', from: 1990, style: 'expansionist', note: 'from Bocelli tours to Olympic ceremonies' }],
  }),
  T({
    // Bresso, Milan: congress kit first, then trade shows, TV, fashion and concerts; LED for Ligabue and Pausini.
    id: 'sts', name: 'STS Communication', hq: 'Milano', color: '#155e75', specialty: 'video', countries: ['IT'], minTier: 1, maxTier: 4, startingReputation: 42, enters: 1984,
  }),
  T({
    // Romanengo, near Cremona: among the first in Italy with moving lights; mostly TV.
    id: 'mixer', name: 'Mixer Sound & Light', hq: 'Brescia', color: '#4d7c0f', specialty: 'lighting', countries: ['IT'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1986,
    leaders: [{ name: 'Walter Taietti', from: 1986, style: 'pioneer', note: 'a family firm buying the newest moving lights' }], // verify start
  }),
  T({
    // Sound, lights and staging for Festivalbar from about 1986. Home town not known.
    id: 'xenon', name: 'Xenon', color: '#713f12', specialty: 'audio', countries: ['IT'], minTier: 1, maxTier: 3, startingReputation: 36, enters: 1986, // verify year
  }),
  T({
    // Turin; its "Grandi Schermi" unit put the screens on Vasco Rossi's 2004 tour.
    id: 'euphon', name: 'Euphon Communication', hq: 'Torino', color: '#831843', specialty: 'video', countries: ['IT'], minTier: 2, maxTier: 4, startingReputation: 46, enters: 2003,
    renames: [{ year: 2007, name: 'Mediacontech', news: 'Euphon Communication becomes Mediacontech.' }],
    leaders: [{ name: 'Enzo Badalotti', from: 2007, style: 'dealmaker', note: 'running a listed group that holds half of Deltatre' }], // verify start
  }),
  T({
    // Bologna: full production for Vasco Rossi's Live Kom 011. First seen in the trade press in 2005.
    id: 'nuovo', name: 'Nuovo Service', hq: 'Bologna', color: '#365314', specialty: 'audio', countries: ['IT'], minTier: 2, maxTier: 4, startingReputation: 44, enters: 2005, // verify year
  }),
  T({
    // Rome (Pomezia): Vasco Rossi's lighting and set builders from 2018.
    id: 'botw', name: 'BOTW', hq: 'Roma', color: '#1e293b', specialty: 'lighting', countries: ['IT'], minTier: 2, maxTier: 4, startingReputation: 46, enters: 2018, // verify year (first seen)
  }),
  T({
    // Rome; lighting for Vasco Rossi.
    id: 'limelite', name: 'Limelite', hq: 'Roma', color: '#854d0e', specialty: 'lighting', countries: ['IT'], minTier: 1, maxTier: 3, startingReputation: 38, enters: 1990, // verify year
  }),
];

export function rivalsFor(country: CountryCode): RivalTemplate[] {
  return RIVAL_COMPANIES.filter(t => (t.countries.includes('*') && t.entersIn?.[country] !== null) || t.countries.includes(country));
}

/** The year a firm sets up in this country. */
export const entryYear = (t: RivalTemplate, country: CountryCode): number => t.entersIn?.[country] ?? t.enters;
/** Its base city in this country. */
export const hqFor = (t: RivalTemplate, country: CountryCode): string | undefined => t.hqIn?.[country] ?? t.hq;
