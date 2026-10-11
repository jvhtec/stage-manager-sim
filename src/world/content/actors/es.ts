/**
 * Spain. Sources and confidence: docs/research/spain-live-production-market.md and
 * docs/rival-history.md. Firms whose real town isn't on the map work from the nearest one.
 *
 * Spain had a dense, regional, specialised domestic market; permanent foreign technical groups
 * came late — EML's Madrid subsidiary (2006), bought into PRG in 2011, renamed PRG in 2012.
 * Clair, Showco, Britannia Row and the like came only with their tours.
 */
import type { HistoricalActor } from './types';

const A = (a: HistoricalActor) => a;

export const ES_ACTORS: HistoricalActor[] = [
  // --- Madrid / central ---------------------------------------------------------------------------
  A({
    id: 'milan', color: '#7f1d1d', home: 'ES', reputation: 48,
    founded: { year: 1976, confidence: 'A', note: 'the company dates itself from 1976; registered as Milán Acústica SA in 1981' },
    presence: [{ country: 'ES', from: 1976, city: 'Madrid' }],
    names: [{ from: 1976, name: 'Milán Acústica' }],
    eras: [
      { from: 1976, lines: ['audio'], tiers: [1, 4], reach: 'national' },
      { from: 2000, lines: ['audio', 'installation'], tiers: [1, 4], reach: 'national' },
    ],
  }),
  A({
    // Four telecom engineers making amplifiers in 1977; hire and tours from the early '80s; Madrid institutions from 2000.
    id: 'espiral', color: '#365314', home: 'ES', reputation: 44,
    founded: { year: 1977, confidence: 'A', note: 'founded 1977 as a manufacturer; live hire "early 1980s"' },
    presence: [{ country: 'ES', from: 1982, city: 'Madrid', basis: 'modelled', note: 'source says live hire began in the early 1980s; 1982 is a gameplay anchor' }],
    names: [{ from: 1982, name: 'Espiral' }],
    eras: [
      { from: 1982, lines: ['audio'], tiers: [2, 4], reach: 'national', basis: 'modelled', note: 'early-1980s live-hire transition represented as 1982' },
      { from: 2000, lines: ['audio'], tiers: [1, 3], reach: 'regional' },
    ],
  }),
  A({
    // Stages, barriers, grandstands and towers for flown sound — infrastructure, not PA.
    id: 'valladar', color: '#57534e', home: 'ES', reputation: 38,
    founded: { year: 1980, confidence: 'A' },
    presence: [{ country: 'ES', from: 1980, city: 'Madrid' }],
    names: [{ from: 1980, name: 'Escenarios Valladar' }],
    eras: [{ from: 1980, lines: ['staging', 'rigging'], tiers: [1, 4], reach: 'national' }],
  }),
  A({
    // Berenice Concert Systems SA, incorporated 1 October 1986; last deposited accounts 1995.
    id: 'berenice', color: '#4c1d95', home: 'ES', reputation: 50,
    founded: { year: 1986, confidence: 'A', note: 'legal entity 1986; earlier activity possible but unproven' },
    presence: [{ country: 'ES', from: 1986, city: 'Madrid' }],
    names: [{ from: 1986, name: 'Berenice Concert Systems' }],
    eras: [{ from: 1986, lines: ['audio'], tiers: [2, 4], reach: 'national' }],
  }),
  A({
    // Sorter SA, 1986: founded by musicians, self-built boxes, then EAW, then L-Acoustics (from 1997).
    id: 'sorter', color: '#854d0e', home: 'ES', reputation: 46,
    founded: { year: 1986, confidence: 'A' },
    presence: [{ country: 'ES', from: 1986, city: 'Madrid' }],
    names: [{ from: 1986, name: 'Sorter' }],
    eras: [{ from: 1986, lines: ['audio'], tiers: [2, 4], reach: 'national' }],
  }),
  A({
    // Lighting for TV, theatre and events (Fuenlabrada).
    id: 'cinelux', color: '#a16207', home: 'ES', reputation: 36,
    founded: { year: 1988, confidence: 'C' },
    presence: [{ country: 'ES', from: 1988, city: 'Madrid' }],
    names: [{ from: 1988, name: 'Cinelux' }],
    eras: [{ from: 1988, lines: ['lighting'], tiers: [1, 3], reach: 'national' }],
  }),
  A({
    // Live sound for tours in 1990, using outside lighting firms; lighting, video and installations followed.
    id: 'fluge', color: '#0f766e', home: 'ES', reputation: 42,
    founded: { year: 1990, confidence: 'A' },
    presence: [{ country: 'ES', from: 1990, city: 'Madrid' }],
    names: [{ from: 1990, name: 'Fluge Audiovisuales' }],
    eras: [
      { from: 1990, lines: ['audio'], tiers: [1, 3], reach: 'national' },
      { from: 1996, lines: ['audio', 'lighting', 'video'], tiers: [2, 4], reach: 'national', basis: 'modelled', note: 'sources say Fluge expanded into lighting/video soon after founding; 1996 is a gameplay anchor' },
      { from: 2008, lines: ['audio', 'lighting', 'video', 'installation'], tiers: [2, 4], reach: 'international', basis: 'modelled', note: 'mature integrated/international era is documented, but 2008 is used as the gameplay transition point' },
    ],
  }),
  A({
    // Stages, sound and light towers, roofs, barriers and qualified riggers.
    id: 'tri', color: '#3f3f46', home: 'ES', reputation: 38,
    founded: { year: 1995, confidence: 'A' },
    presence: [{ country: 'ES', from: 1995, city: 'Madrid' }],
    names: [{ from: 1995, name: 'Tri i Talfis' }],
    eras: [{ from: 1995, lines: ['staging', 'rigging'], tiers: [1, 4], reach: 'national' }],
  }),
  A({
    // EML Sound and Light Productions SL (Madrid, 2006): a subsidiary of Belgium's EML. PRG bought the group
    // in January 2011; the Spanish company took the PRG name in 2012. Same company, staff and kit throughout.
    id: 'eml', color: '#525252', home: 'BE', reputation: 54,
    founded: { year: 2006, confidence: 'A', note: 'Spanish company constituted 2006; Belgian parent founded 1979' },
    presence: [{ country: 'ES', from: 2006, city: 'Madrid', news: 'Belgium\'s EML opens a Madrid subsidiary — the first foreign production group with a Spanish base.' }],
    names: [
      { from: 2006, name: 'EML Productions Spain' },
      { from: 2012, name: 'PRG', news: 'EML Productions Spain changes its name to PRG.' },
    ],
    eras: [
      { from: 2006, lines: ['audio', 'lighting', 'video'], tiers: [3, 4], reach: 'international' },
      { from: 2011, lines: ['audio', 'lighting', 'video'], tiers: [2, 4], reach: 'international' },
    ],
    events: [{ kind: 'ownership', year: 2011, owner: 'PRG', news: 'PRG buys EML\'s Belgian parent — and with it the Madrid operation, its crews and its clients.' }],
  }),

  // --- Catalonia ----------------------------------------------------------------------------------
  A({
    // LIL Service lineage (trade history: 1979, Meyer importer); Twin Cam Audio companies formed in 1990.
    id: 'twincam', color: '#0e7490', home: 'ES', reputation: 50,
    founded: { year: 1979, confidence: 'C', note: 'LIL Service lineage from 1979 (trade history); Twin Cam companies registered 1990' },
    presence: [{ country: 'ES', from: 1979, city: 'Barcelona' }],
    names: [
      { from: 1979, name: 'LIL Service' },
      { from: 1990, name: 'Twin Cam Audio', news: 'The LIL Service people trade as Twin Cam Audio from new companies in Barcelona.' },
    ],
    eras: [
      { from: 1979, lines: ['audio'], tiers: [1, 3], reach: 'regional' },
      { from: 1990, lines: ['audio'], tiers: [2, 4], reach: 'national' },
    ],
  }),
  A({
    // Toni Juncosa's lighting rental house, Montcada i Reixac; sound and production came later.
    id: 'arcoiris', color: '#be185d', home: 'ES', reputation: 40,
    founded: { year: 1983, confidence: 'A' },
    presence: [{ country: 'ES', from: 1983, city: 'Barcelona' }],
    names: [{ from: 1983, name: 'Arcoiris Lighting Systems' }],
    eras: [
      { from: 1983, lines: ['lighting'], tiers: [1, 4], reach: 'national' },
      { from: 2005, lines: ['lighting', 'audio'], tiers: [1, 4], reach: 'national', basis: 'modelled', note: 'later audio expansion is documented without a firm transition year; 2005 is a gameplay anchor' },
    ],
  }),
  A({
    // Corporate and institutional AV since 1972 — not an arena PA house. Euphon (Italy) took 60% around 2001.
    id: 'sono', color: '#1d4ed8', home: 'ES', reputation: 40,
    founded: { year: 1972, confidence: 'B' },
    presence: [{ country: 'ES', from: 1972, city: 'Barcelona' }],
    names: [{ from: 1972, name: 'Sono' }],
    eras: [{ from: 1972, lines: ['corporate-av', 'video'], tiers: [1, 3], reach: 'national' }],
    events: [{ kind: 'ownership', year: 2001, owner: 'Euphon', news: 'Italy\'s Euphon buys 60% of Sono.' }],
  }),
  A({
    // Dushow Barcelona SL (formed 2004, trading 2005); Dushow Spain in Madrid 2021; Novelty Spain from 2023.
    id: 'dushowes', color: '#1e3a5f', home: 'FR', reputation: 46,
    founded: { year: 2005, confidence: 'B' },
    presence: [{ country: 'ES', from: 2005, city: 'Barcelona', news: 'France\'s Dushow opens in Barcelona.' }],
    names: [
      { from: 2005, name: 'Dushow Barcelona' },
      { from: 2021, name: 'Dushow Spain', news: 'Dushow\'s Spanish arm becomes Dushow Spain.' },
      { from: 2023, name: 'Novelty Spain', news: 'Dushow Spain takes the group\'s name: Novelty Spain.' },
    ],
    eras: [{ from: 2005, lines: ['lighting', 'audio'], tiers: [2, 4], reach: 'international' }],
  }),

  // --- Asturias / Galicia --------------------------------------------------------------------------
  A({
    // José Javier García "Boby", Gijón: EAW, Les Luthiers, the northern festivals — and a workshop and shop.
    id: 'pronorte', color: '#78350f', home: 'ES', reputation: 36,
    founded: { year: 1985, confidence: 'A' },
    presence: [{ country: 'ES', from: 1985, city: 'Gijón' }],
    names: [{ from: 1985, name: 'Pronorte' }],
    eras: [{ from: 1985, lines: ['audio', 'lighting'], tiers: [1, 3], reach: 'national' }],
  }),
  A({
    // Ferrol (Vigo on the map): two people and a Peavey rig in 1980; the founder's son took over in 1995.
    id: 'megafer', color: '#155e75', home: 'ES', reputation: 26,
    founded: { year: 1980, confidence: 'A' },
    presence: [{ country: 'ES', from: 1980, city: 'Vigo' }],
    names: [{ from: 1980, name: 'Megafer' }],
    eras: [
      { from: 1980, lines: ['audio'], tiers: [1, 2], reach: 'local' },
      { from: 1995, lines: ['audio', 'lighting', 'video', 'staging'], tiers: [1, 2], reach: 'regional' },
    ],
  }),
  A({
    // Barro, Pontevedra (Vigo on the map): concert lighting, sound and structures from the start.
    id: 'emsac', color: '#0369a1', home: 'ES', reputation: 38,
    founded: { year: 1993, confidence: 'A' },
    presence: [{ country: 'ES', from: 1993, city: 'Vigo' }],
    names: [{ from: 1993, name: 'EMSAC' }],
    eras: [{ from: 1993, lines: ['audio', 'lighting', 'staging'], tiers: [1, 4], reach: 'national' }],
  }),

  // --- Castilla y León / Basque Country ------------------------------------------------------------
  A({
    // La Cistérniga, Valladolid: 1985 or 1987 depending on the source.
    id: 'swing', color: '#4d7c0f', home: 'ES', reputation: 32,
    founded: { year: 1987, confidence: 'C', note: 'sources give 1985 and 1987' },
    presence: [{ country: 'ES', from: 1987, city: 'Valladolid', basis: 'modelled', note: 'sources disagree between 1985 and 1987; 1987 is the conservative gameplay anchor' }],
    names: [{ from: 1987, name: 'Swing Electroshow' }],
    eras: [{ from: 1987, lines: ['audio', 'lighting', 'staging'], tiers: [1, 3], reach: 'national' }],
  }),
  A({
    // Eusebio Marchena and Carmen Herrero's family firm; the Meyer LYON rig (2014) went out with Sergio Dalma.
    id: 'use', color: '#0f766e', home: 'ES', reputation: 34,
    founded: { year: 1993, confidence: 'C', note: '"more than 30 years" — exact year not yet found' },
    presence: [{ country: 'ES', from: 1993, city: 'Valladolid', basis: 'modelled', note: 'company says more than 30 years; exact foundation year remains unresolved' }],
    names: [{ from: 1993, name: 'Use Sonido' }],
    eras: [
      { from: 1993, lines: ['audio', 'lighting'], tiers: [1, 3], reach: 'regional', basis: 'modelled', note: 'exact start year unresolved; 1993 is a conservative gameplay anchor' },
      { from: 2014, lines: ['audio', 'lighting'], tiers: [1, 4], reach: 'national' },
    ],
  }),
  A({
    // In the 2008 touring guide; José Luis Rico handed over to Andrés Rico in 2009; wound up in 2018.
    id: 'realaudio', color: '#713f12', home: 'ES', reputation: 26,
    founded: { year: 2008, confidence: 'C', note: 'first documented 2008; founding year not found' },
    presence: [{ country: 'ES', from: 2008, to: 2018, city: 'Valladolid' }],
    names: [{ from: 2008, name: 'Real Audio Systems' }],
    eras: [{ from: 2008, lines: ['audio'], tiers: [1, 2], reach: 'regional' }],
    events: [{ kind: 'closure', year: 2018, how: 'voluntary', news: 'Real Audio Systems is wound up by its owners — no debts, just the end of the road.' }],
  }),
  A({
    // Arrasate (Bilbao on the map): live production from 1990, distribution from about 2014–15.
    id: 'soinua', color: '#166534', home: 'ES', reputation: 34,
    founded: { year: 1990, confidence: 'A' },
    presence: [{ country: 'ES', from: 1990, to: 2015, city: 'Bilbao', basis: 'modelled', note: 'sources place the live-production-to-distribution pivot around 2014–15' }],
    names: [{ from: 1990, name: 'Soinua' }],
    eras: [{ from: 1990, lines: ['audio'], tiers: [1, 3], reach: 'regional' }],
    events: [{ kind: 'pivot', year: 2015, to: 'distribution', news: 'Soinua steps back from live work to distribute premium audio brands.', basis: 'modelled', note: 'documented transition is around 2014–15; gameplay uses 2015' }],
  }),
  A({
    // Patxi Ingunza's firm; Aste Nagusia sound and lighting for Bilbao council.
    id: 'ingunza', color: '#7c2d12', home: 'ES', reputation: 30,
    founded: { year: 2008, confidence: 'C', note: 'first documented 2008' },
    presence: [{ country: 'ES', from: 2008, city: 'Bilbao' }],
    names: [{ from: 2008, name: 'Ingunza Audiovisual' }],
    eras: [{ from: 2008, lines: ['audio', 'lighting'], tiers: [1, 3], reach: 'regional' }],
  }),

  // --- Andalucía ----------------------------------------------------------------------------------
  A({
    id: 'sonorock', color: '#9a3412', home: 'ES', reputation: 32,
    founded: { year: 1992, confidence: 'C', note: 'active 1992–94 in a technician\'s career record' },
    presence: [{ country: 'ES', from: 1992, city: 'Sevilla' }],
    names: [{ from: 1992, name: 'Sonorock' }],
    eras: [{ from: 1992, lines: ['audio'], tiers: [1, 3], reach: 'national' }],
  }),
  A({
    // El Puerto de Santa María, Cádiz (Sevilla on the map).
    id: 'ojeda', color: '#a16207', home: 'ES', reputation: 26,
    founded: { year: 1992, confidence: 'B' },
    presence: [{ country: 'ES', from: 1992, city: 'Sevilla' }],
    names: [{ from: 1992, name: 'Audiovisual Ojeda' }],
    eras: [{ from: 1992, lines: ['audio', 'lighting'], tiers: [1, 2], reach: 'regional' }],
  }),
  A({
    // Apogee Servicios SL, Valencina de la Concepción, 3 August 1993: sound, light, video, rental and repair.
    id: 'apogee', color: '#365314', home: 'ES', reputation: 34,
    founded: { year: 1993, confidence: 'A' },
    presence: [{ country: 'ES', from: 1993, city: 'Sevilla' }],
    names: [{ from: 1993, name: 'Apogee Servicios' }],
    eras: [{ from: 1993, lines: ['audio', 'lighting', 'video'], tiers: [1, 3], reach: 'national' }],
  }),
  A({
    id: 'tcm', color: '#831843', home: 'ES', reputation: 34,
    founded: { year: 1994, confidence: 'C', note: 'active by 1994' },
    presence: [{ country: 'ES', from: 1994, city: 'Sevilla' }],
    names: [{ from: 1994, name: 'TCM Audiovisión' }],
    eras: [{ from: 1994, lines: ['audio', 'lighting', 'video', 'corporate-av'], tiers: [1, 3], reach: 'national' }],
  }),
  A({
    // Bartolomé "Tole" López; the HK Cohedra rig (2007–08).
    id: 'tole', color: '#713f12', home: 'ES', reputation: 30,
    founded: { year: 2007, confidence: 'C', note: 'first documented 2007; founding year not found' },
    presence: [{ country: 'ES', from: 2007, city: 'Sevilla' }],
    names: [{ from: 2007, name: 'Sonido Tole' }],
    eras: [{ from: 2007, lines: ['audio'], tiers: [1, 3], reach: 'regional' }],
  }),

  // --- Balearics ----------------------------------------------------------------------------------
  A({
    id: 'efectes', color: '#b45309', home: 'ES', reputation: 28,
    founded: { year: 1981, confidence: 'B' },
    presence: [{ country: 'ES', from: 1981, city: 'Palma' }],
    names: [{ from: 1981, name: 'Efectes' }],
    eras: [{ from: 1981, lines: ['lighting'], tiers: [1, 3], reach: 'regional' }],
  }),
  A({
    id: 'balearacustic', color: '#0e7490', home: 'ES', reputation: 28,
    founded: { year: 1990, confidence: 'B' },
    presence: [{ country: 'ES', from: 1990, city: 'Palma' }],
    names: [{ from: 1990, name: 'Balear Acustic' }],
    eras: [{ from: 1990, lines: ['audio', 'lighting', 'staging', 'backline'], tiers: [1, 2], reach: 'regional' }],
  }),
];
