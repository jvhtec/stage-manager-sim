/**
 * The United States, plus the international houses that grew from it. A firm appears in another
 * country only where it really had a local base; touring work abroad isn't a base. Sources and
 * confidence: docs/rival-history.md.
 */
import type { HistoricalActor } from './types';

const A = (a: HistoricalActor) => a;

export const US_ACTORS: HistoricalActor[] = [
  A({
    // Roy and Gene Clair, Lititz PA (Philadelphia on the map). Britain from 2008 by buying Concert Sound;
    // Germany through Black Box Music (that actor carries on as BBM | Clair). No Spanish, French or Italian base found.
    id: 'clair', color: '#0e7490', home: 'US', reputation: 78,
    founded: { year: 1966, confidence: 'A' },
    presence: [
      { country: 'US', from: 1966, city: 'Philadelphia' },
      { country: 'GB', from: 2008, city: 'London', news: 'Clair buys London\'s Concert Sound — ConcertSound Clair opens for business in Britain.' },
    ],
    names: [
      { from: 1966, name: 'Clair Brothers' },
      { from: 2000, name: 'ClairShowco', news: 'With Showco on board, Clair Brothers becomes ClairShowco.' },
      { from: 2008, name: 'Clair Global', news: 'ClairShowco drops the old names and becomes Clair Global.' },
    ],
    eras: [{ from: 1966, lines: ['audio'], tiers: [3, 4], reach: 'international' }],
  }),
  A({
    // Bob Bogdanovich, Hermosa Beach (Los Angeles on the map); the California Jam PA (1974).
    id: 'tycobrahe', color: '#134e4a', home: 'US', reputation: 60,
    founded: { year: 1969, confidence: 'C', note: '"late 1960s"' },
    presence: [{ country: 'US', from: 1969, to: 1981, city: 'Los Angeles', basis: 'modelled', note: 'founding is only dated to the late 1960s and the exact closure year is uncertain' }],
    names: [{ from: 1969, name: 'Tycobrahe Sound' }],
    eras: [{ from: 1969, lines: ['audio'], tiers: [2, 4], reach: 'national', basis: 'modelled', note: 'late-1960s origin represented as 1969' }],
    events: [{ kind: 'closure', year: 1981, how: 'unknown', news: 'Tycobrahe Sound goes out of business.', basis: 'modelled', note: 'closure is documented, exact year remains uncertain; gameplay uses 1981' }],
  }),
  A({
    // Jack Calmes, Rusty Brutsché and Jack Maxson, Dallas; lighting from 1972, Vari-Lite spun out in 1981.
    id: 'showco', color: '#7c2d12', home: 'US', reputation: 62,
    founded: { year: 1970, confidence: 'A' },
    presence: [{ country: 'US', from: 1970, city: 'Dallas' }],
    names: [{ from: 1970, name: 'Showco' }],
    eras: [
      { from: 1970, lines: ['audio'], tiers: [3, 4], reach: 'international' },
      { from: 1972, lines: ['audio', 'lighting'], tiers: [3, 4], reach: 'international' },
    ],
    events: [
      { kind: 'ownership', year: 1981, owner: 'Vari-Lite', news: 'Showco\'s lighting R&D becomes Vari-Lite, which now owns Showco.' },
      { kind: 'absorbed', year: 2000, into: 'clair', news: 'Vari-Lite sells Showco to Clair Brothers.' },
    ],
  }),
  A({
    // Rochester NY, then the San Diego area (Los Angeles on the map).
    id: 'soundimage', color: '#1e3a5f', home: 'US', reputation: 56,
    founded: { year: 1971, confidence: 'A' },
    presence: [{ country: 'US', from: 1971, city: 'Los Angeles' }],
    names: [
      { from: 1971, name: 'Silverfish Audio' },
      { from: 1984, name: 'Sound Image', news: 'Silverfish Audio becomes Southern California Sound Image.' }, // 1981 in some sources
    ],
    eras: [{ from: 1971, lines: ['audio'], tiers: [2, 4], reach: 'national' }],
  }),
  A({
    // Michael Strickland, aged 12, Kingsport TN; Knoxville 1973, Nashville 1982.
    id: 'bandit', color: '#365314', home: 'US', reputation: 50,
    founded: { year: 1968, confidence: 'A' },
    presence: [{ country: 'US', from: 1968, city: 'Nashville' }],
    names: [{ from: 1968, name: 'Bandit Lites' }],
    eras: [{ from: 1968, lines: ['lighting'], tiers: [2, 4], reach: 'national' }],
  }),
  A({
    // The Carone brothers and Robin Shaw, Des Plaines IL.
    id: 'upstaging', color: '#1e293b', home: 'US', reputation: 46,
    founded: { year: 1972, confidence: 'A' },
    presence: [{ country: 'US', from: 1972, city: 'Chicago' }],
    names: [{ from: 1972, name: 'Upstaging' }],
    eras: [{ from: 1972, lines: ['lighting'], tiers: [2, 4], reach: 'national' }],
  }),
  A({
    // Tony Villarreal, Willis then Livonia MI.
    id: 'thunder', color: '#78350f', home: 'US', reputation: 48,
    founded: { year: 1978, confidence: 'B' },
    presence: [{ country: 'US', from: 1978, city: 'Detroit' }],
    names: [{ from: 1978, name: 'Thunder Audio' }],
    eras: [{ from: 1978, lines: ['audio'], tiers: [2, 4], reach: 'national' }],
  }),
  A({
    // Highland Heights, near Cleveland (not on the map).
    id: 'eighthday', color: '#4c1d95', home: 'US', reputation: 50,
    founded: { year: 1980, confidence: 'B' },
    presence: [{ country: 'US', from: 1980, city: 'Detroit' }],
    names: [{ from: 1980, name: 'Eighth Day Sound' }],
    eras: [{ from: 1980, lines: ['audio'], tiers: [2, 4], reach: 'national' }],
    events: [{ kind: 'ownership', year: 2020, owner: 'Clair Global', news: 'Clair Global buys Eighth Day Sound; the name and the team carry on.' }],
  }),
  A({
    // Jere Harris's Harris Production Services (New York), Production Resource Group from 1995.
    id: 'prg', color: '#57534e', home: 'US', reputation: 50,
    founded: { year: 1983, confidence: 'A' },
    presence: [{ country: 'US', from: 1983, city: 'New York' }],
    names: [
      { from: 1983, name: 'Harris Production Services' },
      { from: 1995, name: 'PRG', news: 'Harris Production Services becomes Production Resource Group — PRG.' },
    ],
    eras: [
      { from: 1983, lines: ['lighting'], tiers: [2, 4], reach: 'national' },
      { from: 1995, lines: ['lighting', 'video', 'audio'], tiers: [2, 4], reach: 'international' },
    ],
  }),
  A({
    // Red Hook NY: a monitor specialist that grew into TV and awards shows.
    id: 'firehouse', color: '#9f1239', home: 'US', reputation: 44,
    founded: { year: 1994, confidence: 'B' },
    presence: [{ country: 'US', from: 1994, city: 'New York' }],
    names: [{ from: 1994, name: 'Firehouse Productions' }],
    eras: [{ from: 1994, lines: ['audio'], tiers: [2, 4], reach: 'national' }],
  }),
  A({
    // Toronto 1985; into the US from 1998 (Orlando, off the map).
    id: 'christie', color: '#713f12', home: 'CA', reputation: 44,
    founded: { year: 1985, confidence: 'A' },
    presence: [{ country: 'US', from: 1998 }],
    names: [{ from: 1998, name: 'Christie Lites' }],
    eras: [{ from: 1998, lines: ['lighting'], tiers: [1, 3], reach: 'national' }],
  }),
  A({
    // Montreal 1977; its first US office in Las Vegas (2007). In Britain through SSE (that actor).
    id: 'solotech', color: '#3f6212', home: 'CA', reputation: 50,
    founded: { year: 1977, confidence: 'A' },
    presence: [{ country: 'US', from: 2007, city: 'Las Vegas' }],
    names: [{ from: 2007, name: 'Solotech' }],
    eras: [{ from: 2007, lines: ['audio', 'lighting', 'video'], tiers: [3, 4], reach: 'international' }],
  }),
];
