/**
 * Historical people at the rival firms: documented roles and tenures, for the League window and the
 * news. No gameplay numbers live here — how a firm plays is game tuning in strategies.ts, kept
 * separate so nobody's real reputation becomes a stat. Sources: docs/rival-history.md and
 * docs/research/spain-live-production-market.md.
 *
 * `from` is the first year the role is documented when the start isn't known (`seen: true`), so a
 * person is never shown in a year before the evidence.
 */
export type HistoricalRole = 'founder' | 'owner' | 'md' | 'chair' | 'technical';

export interface Tenure {
  actor: string;
  role: HistoricalRole;
  from: number;
  to?: number;
  /** `from` is when the role is first documented, not when it began. */
  seen?: boolean;
}

export interface HistoricalPerson {
  name: string;
  tenures: Tenure[];
}

const P = (name: string, ...tenures: Tenure[]): HistoricalPerson => ({ name, tenures });

export const HISTORICAL_PEOPLE: HistoricalPerson[] = [
  // --- International / US ---
  P('Roy Clair', { actor: 'clair', role: 'founder', from: 1966, to: 1994 }),
  P('Gene Clair', { actor: 'clair', role: 'founder', from: 1966, to: 1994 }),
  P('Troy Clair', { actor: 'clair', role: 'md', from: 1995 }),
  P('Jere Harris', { actor: 'prg', role: 'founder', from: 1983, to: 2021 }),
  P('Stephan Paridaen', { actor: 'prg', role: 'md', from: 2022 }),
  P('Denis Lefrançois', { actor: 'solotech', role: 'founder', from: 1977, to: 2016 }),
  P('Martin Tremblay', { actor: 'solotech', role: 'md', from: 2017, to: 2024 }),
  P('Stéphane Lefebvre', { actor: 'solotech', role: 'md', from: 2025 }),
  P('Bob Bogdanovich', { actor: 'tycobrahe', role: 'founder', from: 1969, to: 1981 }),
  P('Jim Gamble', { actor: 'tycobrahe', role: 'technical', from: 1974, seen: true }),
  P('Jack Calmes', { actor: 'showco', role: 'founder', from: 1970, to: 1980 }),
  P('Rusty Brutsché', { actor: 'showco', role: 'founder', from: 1970, to: 2000 }),
  P('Jack Maxson', { actor: 'showco', role: 'founder', from: 1970 }),
  P('Ross Ritto', { actor: 'soundimage', role: 'founder', from: 1971, to: 2009 }),
  P('Joel Silverman', { actor: 'soundimage', role: 'founder', from: 1971, to: 1980 }),
  P('Dave Shadoan', { actor: 'soundimage', role: 'owner', from: 1981 }),
  P('Michael Strickland', { actor: 'bandit', role: 'founder', from: 1968 }),
  P('Peter Heffernan', { actor: 'bandit', role: 'md', from: 2008 }),
  P('Robert Carone', { actor: 'upstaging', role: 'founder', from: 1972 }),
  P('Don Carone', { actor: 'upstaging', role: 'founder', from: 1972 }),
  P('Tony Villarreal', { actor: 'thunder', role: 'founder', from: 1978 }),
  P('Tom Arko', { actor: 'eighthday', role: 'md', from: 2020, seen: true }),
  P('Bryan Olson', { actor: 'firehouse', role: 'founder', from: 1994 }),
  P('Huntly Christie', { actor: 'christie', role: 'founder', from: 1998 }),

  // --- Britain ---
  P('Dave Martin', { actor: 'martinaudio', role: 'founder', from: 1971, to: 1990 }),
  P('Robbie Williams', { actor: 'britrow', role: 'md', from: 1975, to: 1990 }),
  P('Bryan Grant', { actor: 'britrow', role: 'owner', from: 1984, to: 2016 }),
  P('Mike Lowe', { actor: 'britrow', role: 'owner', from: 1991, to: 2016 }),
  P('Nicola Amoruso', { actor: 'britrow', role: 'md', from: 2025, seen: true }),
  P('Nick Jackson', { actor: 'lsd', role: 'founder', from: 1975 }),
  P('Terry Lee', { actor: 'lsd', role: 'founder', from: 1975, to: 1997 }),
  P('Alan Whitaker', { actor: 'lsd', role: 'founder', from: 1975, to: 1997 }),
  P('John Penn', { actor: 'sse', role: 'founder', from: 1976, to: 2019 }),
  P('Alex Penn', { actor: 'sse', role: 'md', from: 2020, to: 2021 }),
  P('Spencer Beard', { actor: 'sse', role: 'md', from: 2020, to: 2021 }, { actor: '22live', role: 'md', from: 2022 }),
  P('Paul Timmins', { actor: 'capital', role: 'technical', from: 1989, to: 2018 }, { actor: '22live', role: 'founder', from: 2022 }),
  P('Keith Davis', { actor: 'capital', role: 'founder', from: 1989, to: 2018 }),
  P('Peter Howard', { actor: 'skan', role: 'founder', from: 1976, to: 1995 }),
  P('Chris Fitch', { actor: 'skan', role: 'owner', from: 1996 }),
  P('Abby Llewellyn', { actor: 'skan', role: 'owner', from: 1996 }),
  P('Mick Spratt', { actor: 'wigwam', role: 'founder', from: 1978 }),
  P('Dave Ridgway', { actor: 'negearth', role: 'founder', from: 1983 }),
  P('Pip Ridgway', { actor: 'negearth', role: 'founder', from: 1983 }),
  P('Andy Dockerty', { actor: 'adlib', role: 'founder', from: 1984, to: 2023 }),
  P('John Hughes', { actor: 'adlib', role: 'md', from: 2024 }),
  P('Dave Crump', { actor: 'ct', role: 'founder', from: 1986 }),
  P('Mark Bonner', { actor: 'delta', role: 'founder', from: 1988, to: 2019 }),
  P('Paul Keating', { actor: 'delta', role: 'founder', from: 1988, to: 2019 }),
  P('David Hanson', { actor: 'delta', role: 'md', from: 2026, seen: true }),

  // --- Spain ---
  P('Gerardo Meiro', { actor: 'espiral', role: 'founder', from: 1977 }),
  P('Rafael Campos', { actor: 'twincam', role: 'md', from: 1994, seen: true }),
  P('James Woods', { actor: 'berenice', role: 'technical', from: 1988, to: 1990, seen: true }, { actor: 'twincam', role: 'technical', from: 1994, to: 1998, seen: true }),
  P('Pablo Jiménez', { actor: 'twincam', role: 'technical', from: 2017, seen: true }),
  P('José Javier García "Boby"', { actor: 'pronorte', role: 'founder', from: 1985 }),
  P('Luis Berlanga', { actor: 'fluge', role: 'founder', from: 1990 }),
  P('Roque Peña', { actor: 'sorter', role: 'technical', from: 2010, seen: true }),
  P('José Antonio Caballero', { actor: 'sorter', role: 'technical', from: 2017, seen: true }),
  P('Toni Juncosa', { actor: 'arcoiris', role: 'founder', from: 1983 }),
  P('Gaspar Bestard', { actor: 'sono', role: 'md', from: 2001, seen: true }),
  P('Emilio Sacarrera Ruza', { actor: 'emsac', role: 'founder', from: 1993 }),
  P('Celso Javier', { actor: 'megafer', role: 'md', from: 1995 }),
  P('Eusebio Marchena', { actor: 'use', role: 'founder', from: 1993 }),
  P('Carmen Herrero', { actor: 'use', role: 'founder', from: 1993 }),
  P('Oscar Marchena', { actor: 'use', role: 'technical', from: 2014, seen: true }),
  P('Manuel Rodríguez', { actor: 'swing', role: 'md', from: 2008, seen: true }),
  P('José Luis Rico', { actor: 'realaudio', role: 'md', from: 2008, to: 2008, seen: true }),
  P('Andrés Rico', { actor: 'realaudio', role: 'md', from: 2009, to: 2018 }),
  P('Patxi Ingunza', { actor: 'ingunza', role: 'md', from: 2008, seen: true }),
  P('Miguel Ángel Fragio Díaz', { actor: 'apogee', role: 'owner', from: 1998, seen: true }),
  P('Bartolomé "Tole" López', { actor: 'tole', role: 'owner', from: 2007 }),
  P('Jan Van Malder', { actor: 'eml', role: 'md', from: 2008, to: 2010, seen: true }),
  P('Xavier Theys', { actor: 'eml', role: 'md', from: 2011 }),

  // --- France / Germany / Italy ---
  P('Eric Alvergnat', { actor: 'dushow', role: 'founder', from: 1982 }),
  P('Jacques de La Guillonnière', { actor: 'novelty', role: 'founder', from: 1982 }),
  P('Thierry Tranchant', { actor: 'melpomen', role: 'founder', from: 1985 }),
  P('Thilo Goos', { actor: 'blackbox', role: 'owner', from: 1985, to: 2021 }),
  P('Jürgen Neumann', { actor: 'nmueller', role: 'founder', from: 1981 }),
  P('Eberhard Müller', { actor: 'nmueller', role: 'founder', from: 1981 }),
  P('Kurt-Werner Gahrens', { actor: 'gb', role: 'founder', from: 1983, to: 2015 }),
  P('Jürgen Battermann', { actor: 'gb', role: 'founder', from: 1983 }),
  P('Norbert Gahrens', { actor: 'gb', role: 'md', from: 2016, seen: true }),
  P('Morten Carlsson', { actor: 'procon', role: 'founder', from: 1988, to: 2010 }),
  P('Ralph-Jörg Wezorke', { actor: 'lightpower', role: 'founder', from: 1987, to: 2019 }),
  P('Peter Matthes', { actor: 'amptown', role: 'founder', from: 1990, to: 2016 }),
  P('Ulrich Müller', { actor: 'amptown', role: 'founder', from: 1990, to: 2016 }),
  P('Leif Witte', { actor: 'amptown', role: 'md', from: 2017, to: 2019 }),
  P('Bernd Schmitz', { actor: 'feedback', role: 'md', from: 2011, seen: true }),
  P('Wolfango De Amicis', { actor: 'agora', role: 'founder', from: 1990 }),
  P('Vittorio De Amicis', { actor: 'agora', role: 'founder', from: 1990 }),
  P('Walter Taietti', { actor: 'mixer', role: 'owner', from: 2016, seen: true }),
  P('Renato Neri', { actor: 'xenon', role: 'md', from: 2004, seen: true }),
  P('Enzo Badalotti', { actor: 'euphon', role: 'md', from: 2007, seen: true }),
  P('Willy Gubellini', { actor: 'nuovo', role: 'md', from: 2005, seen: true }),
  P('Alberto Azzola', { actor: 'sts', role: 'md', from: 2024, seen: true }),
];

const LEADING: HistoricalRole[] = ['founder', 'owner', 'md', 'chair'];
const active = (t: Tenure, year: number) => t.from <= year && (t.to === undefined || year <= t.to);

/** Who is running the firm this year (founders, owners, managing directors), in the registry's order. */
export function leadersOf(actorId: string, year: number): string[] {
  return HISTORICAL_PEOPLE.filter(p => p.tenures.some(t => t.actor === actorId && LEADING.includes(t.role) && active(t, year))).map(p => p.name);
}

/** Its documented technical leads this year. */
export function technicalOf(actorId: string, year: number): string[] {
  return HISTORICAL_PEOPLE.filter(p => p.tenures.some(t => t.actor === actorId && t.role === 'technical' && active(t, year))).map(p => p.name);
}

/** "A, B and C". */
export const joinNames = (names: string[]) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);
