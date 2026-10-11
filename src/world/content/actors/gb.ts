/** Britain. Sources and confidence: docs/rival-history.md. */
import type { HistoricalActor } from './types';

const A = (a: HistoricalActor) => a;

export const GB_ACTORS: HistoricalActor[] = [
  A({
    // Dave Martin's horn-loaded PAs on the big '70s tours; sold to TGI in 1990, loudspeakers only from then.
    id: 'martinaudio', color: '#1c1917', home: 'GB', reputation: 58,
    founded: { year: 1971, confidence: 'A' },
    presence: [{ country: 'GB', from: 1971, to: 1990, city: 'London' }],
    names: [{ from: 1971, name: 'Martin Audio' }],
    eras: [{ from: 1971, lines: ['audio'], tiers: [2, 4], reach: 'national' }],
    events: [{ kind: 'pivot', year: 1990, to: 'manufacturing', news: 'Dave Martin sells Martin Audio to TGI; from now on it only builds loudspeakers.' }],
  }),
  A({
    // Pink Floyd's touring rig, hired out between tours; bought from the band by its managers in 1984.
    id: 'britrow', color: '#7f1d1d', home: 'GB', reputation: 58,
    founded: { year: 1975, confidence: 'A' },
    presence: [{ country: 'GB', from: 1975, city: 'London' }],
    names: [
      { from: 1975, name: 'Britannia Row' },
      { from: 2017, name: 'Britannia Row Productions' },
    ],
    eras: [{ from: 1975, lines: ['audio'], tiers: [2, 4], reach: 'international' }],
    events: [
      { kind: 'ownership', year: 1984, owner: 'its managers', news: 'Bryan Grant and Robbie Williams buy Britannia Row from Pink Floyd.' },
      { kind: 'ownership', year: 2017, owner: 'Clair Global', news: 'Clair Global buys Britannia Row Productions — the name, the crews and the clients stay.' },
    ],
  }),
  A({
    // Birmingham: Nick Jackson, Terry Lee and Alan Whitaker. Salvesen 1991, bought back 1995, PRG 1998.
    id: 'lsd', color: '#44403c', home: 'GB', reputation: 56,
    founded: { year: 1975, confidence: 'B' },
    presence: [{ country: 'GB', from: 1975, city: 'Birmingham' }],
    names: [
      { from: 1975, name: 'Light & Sound Design' },
      { from: 1998, name: 'PRG', news: 'Light & Sound Design now trades as PRG.' },
    ],
    eras: [
      { from: 1975, lines: ['lighting'], tiers: [2, 4], reach: 'international' },
      { from: 1998, lines: ['lighting', 'video'], tiers: [2, 4], reach: 'international' },
    ],
    events: [
      { kind: 'ownership', year: 1991, owner: 'Christian Salvesen', news: 'Christian Salvesen buys Light & Sound Design.' },
      { kind: 'ownership', year: 1995, owner: 'its founders and managers', news: 'Light & Sound Design\'s founders and managers buy the company back.' },
      { kind: 'ownership', year: 1998, owner: 'Production Resource Group', news: 'Light & Sound Design joins Production Resource Group.' },
    ],
  }),
  A({
    // A college disco at Trent Poly, Nottingham; Birmingham 1984, Redditch 2003. Solotech bought it in 2018.
    id: 'sse', color: '#1e3a5f', home: 'GB', reputation: 44,
    founded: { year: 1976, confidence: 'A' },
    presence: [{ country: 'GB', from: 1976, city: 'Nottingham' }],
    names: [
      { from: 1976, name: 'SSE Audio' },
      { from: 2020, name: 'Solotech UK', news: 'SSE Audio Group takes its owner\'s name: Solotech UK.' },
    ],
    eras: [
      { from: 1976, lines: ['audio'], tiers: [1, 3], reach: 'national' },
      { from: 2008, lines: ['audio'], tiers: [1, 4], reach: 'national' },
      { from: 2018, lines: ['audio', 'lighting', 'video'], tiers: [2, 4], reach: 'international' },
    ],
    events: [{ kind: 'ownership', year: 2018, owner: 'Solotech', news: 'John Penn sells SSE Audio Group to Canada\'s Solotech.' }],
  }),
  A({
    // Newbury, Berkshire (not on the map). Peter Howard's firm; Chris Fitch and Abby Llewellyn from 1996.
    id: 'skan', color: '#4a044e', home: 'GB', reputation: 38,
    founded: { year: 1976, confidence: 'C', note: '"1970s" — exact year not found' },
    presence: [{ country: 'GB', from: 1976, basis: 'modelled', note: 'sources only establish the 1970s; gameplay uses 1976' }],
    names: [{ from: 1976, name: 'Skan PA Hire' }],
    eras: [{ from: 1976, lines: ['audio'], tiers: [1, 3], reach: 'national', basis: 'modelled', note: 'sources only establish the 1970s; gameplay uses 1976' }],
    events: [{ kind: 'absorbed', year: 2022, into: 'britrow', news: 'Britannia Row Productions buys Skan PA Hire.' }],
  }),
  A({
    // Heywood, near Rochdale; year uncertain (early '70s to 1982).
    id: 'wigwam', color: '#4d7c0f', home: 'GB', reputation: 36,
    founded: { year: 1978, confidence: 'C', note: 'sources range from the early 1970s to 1982' },
    presence: [{ country: 'GB', from: 1978, city: 'Manchester', basis: 'modelled', note: 'sources range from early 1970s to 1982; gameplay uses 1978' }],
    names: [{ from: 1978, name: 'Wigwam Acoustics' }],
    eras: [{ from: 1978, lines: ['audio'], tiers: [1, 3], reach: 'national', basis: 'modelled', note: 'sources range from early 1970s to 1982; gameplay uses 1978' }],
    events: [{ kind: 'absorbed', year: 2013, into: 'sse', news: 'SSE Audio Group buys Wigwam Acoustics.' }],
  }),
  A({
    id: 'negearth', color: '#854d0e', home: 'GB', reputation: 42,
    founded: { year: 1983, confidence: 'A' },
    presence: [{ country: 'GB', from: 1983, city: 'London' }],
    names: [{ from: 1983, name: 'Neg Earth Lights' }],
    eras: [{ from: 1983, lines: ['lighting', 'rigging'], tiers: [1, 3], reach: 'national' }],
  }),
  A({
    // Andy Dockerty, a small PA and a VW van.
    id: 'adlib', color: '#713f12', home: 'GB', reputation: 38,
    founded: { year: 1984, confidence: 'A' },
    presence: [{ country: 'GB', from: 1984, city: 'Liverpool' }],
    names: [{ from: 1984, name: 'Adlib' }],
    eras: [{ from: 1984, lines: ['audio'], tiers: [1, 3], reach: 'national' }],
  }),
  A({
    // Sister company of Screenco, part of Avesco; NEP bought Avesco in 2017.
    id: 'ct', color: '#155e75', home: 'GB', reputation: 52,
    founded: { year: 1986, confidence: 'C' },
    presence: [{ country: 'GB', from: 1986, city: 'London' }],
    names: [{ from: 1986, name: 'Creative Technology' }],
    eras: [{ from: 1986, lines: ['video'], tiers: [3, 4], reach: 'international' }],
    events: [{ kind: 'ownership', year: 2017, owner: 'NEP', news: 'NEP buys CT\'s parent Avesco; Creative Technology carries on under its own name.' }],
  }),
  A({
    // Mark Bonner and Paul Keating, Weybridge (London on the map): corporate shows first, then Dubai.
    id: 'delta', color: '#3f6212', home: 'GB', reputation: 42,
    founded: { year: 1988, confidence: 'A' },
    presence: [{ country: 'GB', from: 1988, city: 'London' }],
    names: [
      { from: 1988, name: 'Delta Sound' },
      { from: 2019, name: 'DeltaLive', news: 'Delta Sound becomes DeltaLive.' },
      { from: 2026, name: 'Delta Live by Novelty' },
    ],
    eras: [{ from: 1988, lines: ['audio'], tiers: [2, 4], reach: 'international' }],
    events: [
      { kind: 'ownership', year: 2019, owner: 'L-Acoustics', news: 'L-Acoustics takes a majority stake in Delta Sound.' },
      { kind: 'ownership', year: 2026, owner: 'Groupe Novelty', news: 'France\'s Groupe Novelty buys DeltaLive.' },
    ],
  }),
  A({
    id: 'capital', color: '#365314', home: 'GB', reputation: 40,
    founded: { year: 1989, confidence: 'A' },
    presence: [{ country: 'GB', from: 1989, city: 'London' }],
    names: [{ from: 1989, name: 'Capital Sound' }],
    eras: [{ from: 1989, lines: ['audio'], tiers: [2, 3], reach: 'national' }],
    events: [{ kind: 'absorbed', year: 2018, into: 'sse', news: 'SSE Audio Group buys Capital Sound.' }],
  }),
  A({
    // Belgian, with a UK base.
    id: 'xlvideo', color: '#831843', home: 'BE', reputation: 48,
    founded: { year: 1995, confidence: 'C' },
    presence: [{ country: 'GB', from: 1995, city: 'London' }],
    names: [{ from: 1995, name: 'XL Video' }],
    eras: [{ from: 1995, lines: ['video'], tiers: [2, 4], reach: 'international' }],
    events: [{ kind: 'absorbed', year: 2015, into: 'lsd', news: 'PRG buys XL Video — its screens now tour under the PRG banner.' }],
  }),
  A({
    // Redditch (Birmingham on the map): six ex-SSE directors.
    id: '22live', color: '#7c2d12', home: 'GB', reputation: 44,
    founded: { year: 2022, confidence: 'A' },
    presence: [{ country: 'GB', from: 2022, city: 'Birmingham' }],
    names: [{ from: 2022, name: '22live' }],
    eras: [{ from: 2022, lines: ['audio'], tiers: [2, 4], reach: 'national' }],
  }),
];
