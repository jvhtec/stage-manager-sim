/** France, Germany and Italy. Sources and confidence: docs/rival-history.md. */
import type { HistoricalActor } from './types';

const A = (a: HistoricalActor) => a;

export const FR_ACTORS: HistoricalActor[] = [
  A({
    id: 'mes', color: '#4d7c0f', home: 'FR', reputation: 38,
    founded: { year: 1981, confidence: 'A' },
    presence: [{ country: 'FR', from: 1981, city: 'Nantes' }],
    names: [{ from: 1981, name: 'MES Eclairages' }],
    eras: [{ from: 1981, lines: ['lighting'], tiers: [1, 3], reach: 'regional' }],
    events: [{ kind: 'absorbed', year: 2013, into: 'melpomen', news: 'Melpomen buys MES Eclairages.' }],
  }),
  A({
    // Roissy (Paris on the map); its Spanish arm is 'dushowes'.
    id: 'dushow', color: '#1e3a5f', home: 'FR', reputation: 54,
    founded: { year: 1982, confidence: 'B', note: 'thirty years old in 2012' },
    presence: [{ country: 'FR', from: 1982, city: 'Paris', basis: 'modelled', note: 'company described 40 years of history in 2022; gameplay uses 1982' }],
    names: [{ from: 1982, name: 'Dushow' }],
    eras: [{ from: 1982, lines: ['lighting', 'audio'], tiers: [2, 4], reach: 'international' }],
    events: [{ kind: 'absorbed', year: 2018, into: 'novelty', news: 'Dushow joins Novelty and Magnum: the new group is the biggest in Europe.' }],
  }),
  A({
    // Jacques de La Guillonnière, as Euphonie, then Euroson, then Novelty.
    id: 'novelty', color: '#713f12', home: 'FR', reputation: 40,
    founded: { year: 1982, confidence: 'C', note: '"40 years" in 2022' },
    presence: [{ country: 'FR', from: 1982, city: 'Paris' }],
    names: [
      { from: 1982, name: 'Novelty' },
      { from: 2018, name: 'Novelty Magnum Dushow', news: 'Novelty, Magnum and Dushow become one group.' },
    ],
    eras: [
      { from: 1982, lines: ['video', 'audio'], tiers: [1, 3], reach: 'national' },
      { from: 2016, lines: ['video', 'audio', 'lighting'], tiers: [2, 4], reach: 'international' },
    ],
  }),
  A({
    // Thierry Tranchant; part of SSE Audio Group 2001–2017; a lighting department from 2012.
    id: 'melpomen', color: '#7f1d1d', home: 'FR', reputation: 46,
    founded: { year: 1985, confidence: 'D', note: 'founding year not found' },
    presence: [{ country: 'FR', from: 1985, city: 'Nantes' }],
    names: [{ from: 1985, name: 'Melpomen' }],
    eras: [
      { from: 1985, lines: ['audio'], tiers: [1, 4], reach: 'national' },
      { from: 2012, lines: ['audio', 'lighting'], tiers: [1, 4], reach: 'national' },
    ],
    events: [
      { kind: 'ownership', year: 2001, owner: 'SSE Audio Group', news: 'Britain\'s SSE Audio Group buys Melpomen.' },
      { kind: 'ownership', year: 2017, owner: 'B Live Group', news: 'Melpomen\'s managers buy it back from SSE.' },
    ],
  }),
];

export const DE_ACTORS: HistoricalActor[] = [
  A({
    // Paderborn (Dortmund on the map): Proppe & Hövelkröger, Lightpower from 1987; later a distributor.
    id: 'lightpower', color: '#a16207', home: 'DE', reputation: 40,
    founded: { year: 1978, confidence: 'A' },
    presence: [{ country: 'DE', from: 1978, city: 'Dortmund' }],
    names: [
      { from: 1978, name: 'Proppe & Hövelkröger' },
      { from: 1987, name: 'Lightpower', news: 'Proppe & Hövelkröger renames itself Lightpower.' },
    ],
    eras: [{ from: 1978, lines: ['lighting'], tiers: [1, 4], reach: 'national' }],
  }),
  A({
    // Students Jürgen Neumann and Eberhard Müller, outdoor PA for WDR radio.
    id: 'nmueller', color: '#155e75', home: 'DE', reputation: 48,
    founded: { year: 1981, confidence: 'A' },
    presence: [{ country: 'DE', from: 1981, city: 'Düsseldorf' }],
    names: [{ from: 1981, name: 'Neumann&Müller' }],
    eras: [
      { from: 1981, lines: ['audio'], tiers: [1, 3], reach: 'regional' },
      { from: 1991, lines: ['audio', 'lighting', 'video'], tiers: [2, 4], reach: 'national', basis: 'modelled', note: 'diversification is documented but exact transition year is approximate' },
    ],
  }),
  A({
    // Bergisch Gladbach (Köln on the map): video sales and rental with four staff, then full service.
    id: 'gb', color: '#0369a1', home: 'DE', reputation: 42,
    founded: { year: 1983, confidence: 'B', note: '1983 (trade press) or 1984 (city profile)' },
    presence: [{ country: 'DE', from: 1983, city: 'Köln' }],
    names: [{ from: 1983, name: 'Gahrens + Battermann' }],
    eras: [
      { from: 1983, lines: ['video'], tiers: [1, 3], reach: 'national' },
      { from: 1995, lines: ['video', 'audio', 'lighting', 'rigging'], tiers: [2, 4], reach: 'national', basis: 'modelled', note: 'full-service transition is documented but exact year is approximate' },
    ],
  }),
  A({
    id: 'blackbox', color: '#1e293b', home: 'DE', reputation: 50,
    founded: { year: 1985, confidence: 'D', note: 'founding year not found' },
    presence: [{ country: 'DE', from: 1985, city: 'Berlin', basis: 'modelled', note: 'founding year remains unverified; 1985 is a gameplay anchor' }],
    names: [
      { from: 1985, name: 'Black Box Music' },
      { from: 2022, name: 'BBM | Clair', news: 'Black Box Music carries on as BBM | Clair.' },
    ],
    eras: [{ from: 1985, lines: ['audio'], tiers: [2, 4], reach: 'international', basis: 'modelled', note: 'founding year remains unverified; 1985 is a gameplay anchor' }],
    events: [{ kind: 'ownership', year: 2022, owner: 'Clair Global', news: 'Clair Global takes over Black Box Music\'s rental and rehearsal business.' }],
  }),
  A({
    // Procon Bühnen Produktions GmbH, Hamburg: computer-controlled lighting, then a listed group (1999).
    id: 'procon', color: '#57534e', home: 'DE', reputation: 46,
    founded: { year: 1988, confidence: 'A' },
    presence: [{ country: 'DE', from: 1988, city: 'Hamburg' }],
    names: [
      { from: 1988, name: 'Procon' },
      { from: 1999, name: 'Procon MultiMedia', news: 'Procon lists on the stock exchange as Procon MultiMedia AG.' },
      { from: 2010, name: 'PRG', news: 'Procon now trades as PRG.' },
    ],
    eras: [
      { from: 1988, lines: ['lighting'], tiers: [2, 4], reach: 'national' },
      { from: 1999, lines: ['lighting', 'video', 'audio', 'staging'], tiers: [2, 4], reach: 'international' },
    ],
    events: [{ kind: 'ownership', year: 2009, owner: 'PRG', news: 'PRG takes over Procon MultiMedia.' }],
  }),
  A({
    // Musicals (CATS), later theatres and cruise ships.
    id: 'amptown', color: '#7c2d12', home: 'DE', reputation: 38,
    founded: { year: 1990, confidence: 'B' },
    presence: [{ country: 'DE', from: 1990, city: 'Hamburg' }],
    names: [
      { from: 1990, name: 'Amptown Sound & Communication' },
      { from: 2008, name: 'Amptown System Company' },
    ],
    eras: [{ from: 1990, lines: ['audio', 'installation'], tiers: [2, 4], reach: 'national' }],
  }),
  A({
    // Karlsruhe (Mannheim on the map).
    id: 'crystal', color: '#854d0e', home: 'DE', reputation: 36,
    founded: { year: 1990, confidence: 'D', note: 'founding year not found' },
    presence: [{ country: 'DE', from: 1990, city: 'Mannheim', basis: 'modelled', note: 'founding year remains unverified; 1990 is a gameplay anchor' }],
    names: [{ from: 1990, name: 'Crystal Sound' }],
    eras: [{ from: 1990, lines: ['audio', 'lighting'], tiers: [1, 3], reach: 'regional', basis: 'modelled', note: 'founding year remains unverified; 1990 is a gameplay anchor' }],
  }),
  A({
    // Germany's biggest dry-hire house: kit to other companies, not shows.
    id: 'niclen', color: '#78350f', home: 'DE', reputation: 36,
    founded: { year: 1992, confidence: 'C' },
    presence: [{ country: 'DE', from: 1992, city: 'Dortmund' }],
    names: [{ from: 1992, name: 'NicLen' }],
    eras: [{ from: 1992, lines: ['lighting', 'audio'], tiers: [1, 3], reach: 'national' }],
  }),
  A({
    // Karben, near Frankfurt: a "three-men show" in 1993, then one-stop full service.
    id: 'satisfy', color: '#831843', home: 'DE', reputation: 46,
    founded: { year: 1993, confidence: 'A' },
    presence: [{ country: 'DE', from: 1993, city: 'Frankfurt' }],
    names: [{ from: 1993, name: 'satis&fy' }],
    eras: [{ from: 1993, lines: ['staging', 'lighting', 'video', 'audio'], tiers: [2, 4], reach: 'international' }],
  }),
  A({
    // Alsdorf, near Aachen (Köln on the map).
    id: 'feedback', color: '#4d7c0f', home: 'DE', reputation: 38,
    founded: { year: 1996, confidence: 'C' },
    presence: [{ country: 'DE', from: 1996, city: 'Köln' }],
    names: [{ from: 1996, name: 'Feedback Show Systems' }],
    eras: [{ from: 1996, lines: ['audio'], tiers: [1, 3], reach: 'regional' }],
  }),
];

export const IT_ACTORS: HistoricalActor[] = [
  A({
    // Bresso (Milan): congress kit, then trade shows, TV, fashion and concerts.
    id: 'sts', color: '#155e75', home: 'IT', reputation: 42,
    founded: { year: 1984, confidence: 'A' },
    presence: [{ country: 'IT', from: 1984, city: 'Milano' }],
    names: [{ from: 1984, name: 'STS Communication' }],
    eras: [
      { from: 1984, lines: ['video', 'corporate-av'], tiers: [1, 3], reach: 'national' },
      { from: 2010, lines: ['video', 'audio', 'lighting', 'rigging'], tiers: [2, 4], reach: 'national', basis: 'modelled', note: 'integrated-production transition is documented but exact year is approximate' },
    ],
  }),
  A({
    // Romanengo, near Cremona (Brescia on the map); mostly TV.
    id: 'mixer', color: '#4d7c0f', home: 'IT', reputation: 38,
    founded: { year: 1986, confidence: 'A' },
    presence: [{ country: 'IT', from: 1986, city: 'Brescia' }],
    names: [{ from: 1986, name: 'Mixer Sound & Light' }],
    eras: [{ from: 1986, lines: ['lighting', 'audio'], tiers: [1, 3], reach: 'national' }],
  }),
  A({
    // Festivalbar for nineteen years by 2004. Home town not known.
    id: 'xenon', color: '#713f12', home: 'IT', reputation: 36,
    founded: { year: 1986, confidence: 'C' },
    presence: [{ country: 'IT', from: 1986 }],
    names: [{ from: 1986, name: 'Xenon' }],
    eras: [{ from: 1986, lines: ['audio', 'lighting', 'staging'], tiers: [1, 3], reach: 'national' }],
  }),
  A({
    // L'Aquila (Pescara on the map): Wolfango and Vittorio De Amicis.
    id: 'agora', color: '#0f766e', home: 'IT', reputation: 46,
    founded: { year: 1990, confidence: 'C', note: '"nearly 25 years" in 2014' },
    presence: [{ country: 'IT', from: 1990, city: 'Pescara', basis: 'modelled', note: '2014 source says nearly 25 years; gameplay uses 1990' }],
    names: [{ from: 1990, name: 'Agorà' }],
    eras: [{ from: 1990, lines: ['audio', 'lighting'], tiers: [2, 4], reach: 'national' }],
  }),
  A({
    id: 'limelite', color: '#854d0e', home: 'IT', reputation: 38,
    founded: { year: 1990, confidence: 'D', note: 'founding year not found' },
    presence: [{ country: 'IT', from: 1990, city: 'Roma', basis: 'modelled', note: 'founding year remains unverified; 1990 is a gameplay anchor' }],
    names: [{ from: 1990, name: 'Limelite' }],
    eras: [{ from: 1990, lines: ['lighting'], tiers: [1, 3], reach: 'national', basis: 'modelled', note: 'founding year remains unverified; 1990 is a gameplay anchor' }],
  }),
  A({
    // Turin: its "Grandi Schermi" unit put the screens on Vasco Rossi's 2004 tour.
    id: 'euphon', color: '#831843', home: 'IT', reputation: 46,
    founded: { year: 2003, confidence: 'B', note: 'set up in its 2003 form after a group reorganisation' },
    presence: [{ country: 'IT', from: 2003, city: 'Torino' }],
    names: [
      { from: 2003, name: 'Euphon Communication' },
      { from: 2007, name: 'Mediacontech', news: 'Euphon Communication becomes Mediacontech.' },
    ],
    eras: [{ from: 2003, lines: ['video', 'corporate-av'], tiers: [2, 4], reach: 'national' }],
  }),
  A({
    id: 'nuovo', color: '#365314', home: 'IT', reputation: 44,
    founded: { year: 2005, confidence: 'C', note: 'first documented 2005' },
    presence: [{ country: 'IT', from: 2005, city: 'Bologna' }],
    names: [{ from: 2005, name: 'Nuovo Service' }],
    eras: [{ from: 2005, lines: ['audio', 'lighting'], tiers: [2, 4], reach: 'national' }],
  }),
  A({
    // Rome (Pomezia): Vasco Rossi's lighting and set builders from 2018.
    id: 'botw', color: '#1e293b', home: 'IT', reputation: 46,
    founded: { year: 2018, confidence: 'C', note: 'first documented 2018' },
    presence: [{ country: 'IT', from: 2018, city: 'Roma' }],
    names: [{ from: 2018, name: 'BOTW' }],
    eras: [{ from: 2018, lines: ['lighting', 'staging'], tiers: [2, 4], reach: 'national' }],
  }),
];
