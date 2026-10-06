/**
 * Playable home countries. The map's geography is procedural; the country
 * decides what it's *called* — real towns (largest first, so the biggest
 * becomes the metropolis, with real metro-area populations), how venues are named, famous venues in the big
 * cities, the currency, and (see companies.ts / artists.ts) who you compete
 * with and which local acts tour. Edit freely.
 */
import type { Rng } from '@/lib/rng';
import type { VenueKind } from '../types';

export type CountryCode = 'ES' | 'GB' | 'US' | 'DE' | 'FR' | 'IT';

type Namer = (city: string, rng: Rng) => string;

export interface Country {
  code: CountryCode;
  name: string;
  /** For tight buttons. */
  short: string;
  flag: string;
  currency: string;
  /** Real towns with (approximate) metro-area populations, biggest first. The map uses the first N. */
  cities: [name: string, population: number][];
  /** Famous rooms in particular towns, used when the map gives that town that kind of venue. */
  landmarks: Record<string, Partial<Record<VenueKind, string>>>;
  venueNames: Record<VenueKind, Namer>;
}

const pick = <T,>(rng: Rng, items: readonly T[]) => rng.pick(items);

export const COUNTRIES: Country[] = [
  {
    code: 'ES',
    short: 'España',
    name: 'España',
    flag: '🇪🇸',
    currency: '€',
    cities: [
      ['Madrid', 6800000],
      ['Barcelona', 5600000],
      ['Valencia', 1600000],
      ['Sevilla', 1500000],
      ['Málaga', 1050000],
      ['Bilbao', 1000000],
      ['Zaragoza', 780000],
      ['Alicante', 760000],
      ['Murcia', 670000],
      ['Palma', 560000],
      ['Granada', 530000],
      ['Vigo', 480000],
      ['Valladolid', 410000],
      ['Gijón', 400000],
      ['Pamplona', 360000],
      ['Oviedo', 340000],
      ['Córdoba', 330000],
      ['Santander', 300000],
    ],
    landmarks: {
      Madrid: { arena: 'WiZink Center', stadium: 'Estadio Santiago Bernabéu', theatre: 'Teatro Lope de Vega' },
      Barcelona: { arena: 'Palau Sant Jordi', stadium: 'Estadi Olímpic Lluís Companys', theatre: 'Teatre Coliseum' },
      Valencia: { arena: 'Roig Arena' },
      Sevilla: { stadium: 'Estadio de La Cartuja' },
      Bilbao: { arena: 'Bizkaia Arena (BEC)' },
    },
    venueNames: {
      pub: (_c, r) => `Bar ${pick(r, ['La Gramola', 'El Sótano', 'La Bodeguita', 'El Búho', 'Los Amigos', 'La Tasca', 'El Refugio'])}`,
      hall: c => `Auditorio de ${c}`,
      club: (_c, r) => `Sala ${pick(r, ['Rock', 'Eléctrica', 'Sótano', 'Neón', 'Caja Negra', 'Factoría', 'Garaje'])}`,
      theatre: (c, r) => `Teatro ${pick(r, ['Principal', 'Circo', 'Cervantes', 'Campoamor'])} de ${c}`,
      arena: c => `Palacio de los Deportes de ${c}`,
      stadium: c => `Estadio de ${c}`,
      airport: c => `Aeropuerto de ${c}`,
    },
  },
  {
    code: 'GB',
    short: 'UK',
    name: 'United Kingdom',
    flag: '🇬🇧',
    currency: '£',
    cities: [
      ['London', 9800000],
      ['Manchester', 2800000],
      ['Birmingham', 2600000],
      ['Leeds', 1900000],
      ['Glasgow', 1700000],
      ['Liverpool', 900000],
      ['Newcastle', 800000],
      ['Nottingham', 770000],
      ['Sheffield', 730000],
      ['Bristol', 670000],
      ['Belfast', 640000],
      ['Leicester', 560000],
      ['Edinburgh', 530000],
      ['Cardiff', 480000],
      ['Brighton', 480000],
      ['Southampton', 400000],
      ['Aberdeen', 230000],
      ['Norwich', 220000],
    ],
    landmarks: {
      London: { arena: 'The O2', stadium: 'Wembley Stadium', theatre: 'Hammersmith Apollo', club: 'Brixton Academy' },
      Birmingham: { arena: 'NEC Arena', theatre: 'Birmingham Symphony Hall' },
      Manchester: { arena: 'Manchester Arena', club: 'Manchester Academy' },
      Glasgow: { arena: 'OVO Hydro', club: 'Barrowland Ballroom' },
      Cardiff: { stadium: 'Principality Stadium' },
    },
    venueNames: {
      pub: (_c, r) => `The ${pick(r, ['Fox', 'Crown', 'Stag', 'Swan', 'Plough', 'Bell', 'Lion', 'Anchor'])} & ${pick(r, ['Fiddle', 'Hound', 'Lantern', 'Drum', 'Barrel', 'Key'])}`,
      hall: c => `${c} Town Hall`,
      club: (_c, r) => `${pick(r, ['Electric', 'Velvet', 'Basement', 'Neon', 'Warehouse', 'Factory'])} Club`,
      theatre: (c, r) => (r.chance(0.5) ? `${c} Playhouse` : `${c} Apollo`),
      arena: c => `${c} Arena`,
      stadium: c => `${c} Stadium`,
      airport: c => `${c} Airport`,
    },
  },
  {
    code: 'US',
    short: 'USA',
    name: 'United States',
    flag: '🇺🇸',
    currency: '$',
    cities: [
      ['New York', 19500000],
      ['Los Angeles', 12900000],
      ['Chicago', 9300000],
      ['Dallas', 7900000],
      ['Houston', 7300000],
      ['Atlanta', 6300000],
      ['Philadelphia', 6200000],
      ['Miami', 6100000],
      ['Boston', 4900000],
      ['Detroit', 4300000],
      ['Seattle', 4000000],
      ['Minneapolis', 3700000],
      ['Denver', 3000000],
      ['Portland', 2500000],
      ['Austin', 2400000],
      ['Las Vegas', 2300000],
      ['Nashville', 2000000],
      ['New Orleans', 1000000],
    ],
    landmarks: {
      'New York': { arena: 'Madison Square Garden', stadium: 'MetLife Stadium', theatre: 'Radio City Music Hall', club: 'Bowery Ballroom' },
      'Los Angeles': { arena: 'The Forum', stadium: 'Rose Bowl', theatre: 'Hollywood Palladium' },
      Chicago: { arena: 'United Center', stadium: 'Soldier Field', theatre: 'Chicago Theatre' },
      Nashville: { theatre: 'Ryman Auditorium' },
      Denver: { theatre: 'Red Rocks Amphitheatre' },
    },
    venueNames: {
      pub: (_c, r) => `${pick(r, ["Joe's", 'The Tip Top', 'Rusty Spur', 'The Basement', 'Blue Moon', 'Lucky Star'])} Bar`,
      hall: c => `${c} Civic Center`,
      club: (_c, r) => `The ${pick(r, ['Roxy', 'Ballroom', 'Paradise', 'Fillmore', 'Echo', 'Metro'])}`,
      theatre: (c, r) => `${c} ${pick(r, ['Paramount', 'Orpheum', 'Fox', 'Palace'])} Theatre`,
      arena: c => `${c} Coliseum`,
      stadium: c => `${c} Memorial Stadium`,
      airport: c => `${c} International`,
    },
  },
  {
    code: 'DE',
    short: 'Deutschland',
    name: 'Deutschland',
    flag: '🇩🇪',
    currency: '€',
    cities: [
      ['Berlin', 4500000],
      ['Hamburg', 3300000],
      ['München', 2900000],
      ['Stuttgart', 2700000],
      ['Frankfurt', 2300000],
      ['Köln', 2100000],
      ['Düsseldorf', 1500000],
      ['Nürnberg', 1300000],
      ['Dortmund', 1200000],
      ['Hannover', 1100000],
      ['Leipzig', 1000000],
      ['Bremen', 1000000],
      ['Mannheim', 800000],
      ['Dresden', 790000],
      ['Bonn', 600000],
      ['Münster', 520000],
      ['Kiel', 400000],
      ['Freiburg', 400000],
    ],
    landmarks: {
      Berlin: { arena: 'Uber Arena', stadium: 'Olympiastadion', club: 'Columbiahalle' },
      Hamburg: { arena: 'Barclays Arena', stadium: 'Volksparkstadion' },
      München: { arena: 'Olympiahalle', stadium: 'Olympiastadion München' },
      Köln: { arena: 'Lanxess Arena' },
    },
    venueNames: {
      pub: (_c, r) => `Kneipe ${pick(r, ['Zum Anker', 'Zur Linde', 'Goldener Hirsch', 'Zum Krug', 'Eckkneipe'])}`,
      hall: c => `Stadthalle ${c}`,
      club: (_c, r) => `${pick(r, ['Musikbunker', 'Kantine', 'Kulturfabrik', 'Werk 2', 'Tanzhalle'])}`,
      theatre: c => `Theater ${c}`,
      arena: c => `Arena ${c}`,
      stadium: c => `Stadion ${c}`,
      airport: c => `Flughafen ${c}`,
    },
  },
  {
    code: 'FR',
    short: 'France',
    name: 'France',
    flag: '🇫🇷',
    currency: '€',
    cities: [
      ['Paris', 12600000],
      ['Lyon', 2300000],
      ['Marseille', 1900000],
      ['Lille', 1500000],
      ['Toulouse', 1450000],
      ['Bordeaux', 1350000],
      ['Nice', 1000000],
      ['Nantes', 1000000],
      ['Strasbourg', 850000],
      ['Montpellier', 800000],
      ['Rennes', 750000],
      ['Grenoble', 700000],
      ['Toulon', 600000],
      ['Angers', 430000],
      ['Dijon', 390000],
      ['Reims', 330000],
      ['Brest', 320000],
      ['Nîmes', 280000],
    ],
    landmarks: {
      Paris: { arena: 'Accor Arena (Bercy)', stadium: 'Stade de France', theatre: 'Olympia', club: 'La Cigale' },
      Marseille: { stadium: 'Orange Vélodrome' },
      Lyon: { arena: 'LDLC Arena' },
    },
    venueNames: {
      pub: (_c, r) => `Bar ${pick(r, ['Le Chat Noir', 'Le Zinc', 'Chez Paulette', 'Le Comptoir', 'La Péniche'])}`,
      hall: c => `Salle des fêtes de ${c}`,
      club: (_c, r) => `Le ${pick(r, ['Cargo', 'Hangar', 'Bikini', 'Molotov', 'Cabaret', 'Transbordeur'])}`,
      theatre: c => `Théâtre de ${c}`,
      // The Zénith network is France's arena circuit.
      arena: c => `Zénith de ${c}`,
      stadium: c => `Stade de ${c}`,
      airport: c => `Aéroport de ${c}`,
    },
  },
  {
    code: 'IT',
    short: 'Italia',
    name: 'Italia',
    flag: '🇮🇹',
    currency: '€',
    cities: [
      ['Roma', 4350000],
      ['Milano', 4300000],
      ['Napoli', 3000000],
      ['Torino', 2200000],
      ['Bari', 1250000],
      ['Palermo', 1200000],
      ['Catania', 1100000],
      ['Bologna', 1000000],
      ['Firenze', 1000000],
      ['Padova', 930000],
      ['Verona', 920000],
      ['Venezia', 850000],
      ['Genova', 820000],
      ['Brescia', 670000],
      ['Ancona', 470000],
      ['Parma', 450000],
      ['Pescara', 320000],
      ['Trieste', 230000],
    ],
    landmarks: {
      Roma: { arena: 'Palazzo dello Sport', stadium: 'Stadio Olimpico' },
      Milano: { arena: 'Unipol Forum', stadium: 'Stadio San Siro', club: 'Alcatraz' },
      Napoli: { stadium: 'Stadio Diego Armando Maradona' },
      Verona: { stadium: 'Arena di Verona' },
    },
    venueNames: {
      pub: (_c, r) => `Osteria ${pick(r, ['del Ponte', 'da Mario', 'La Botte', 'Il Grillo', 'Vecchia Roma'])}`,
      hall: c => `Auditorium di ${c}`,
      club: (_c, r) => `${pick(r, ['Fabbrica', 'Cantiere', 'Officina', 'Magazzini', 'Estragon'])} Club`,
      theatre: (c, r) => `Teatro ${pick(r, ['Verdi', 'Comunale', 'Politeama'])} di ${c}`,
      arena: c => `PalaSport di ${c}`,
      stadium: c => `Stadio di ${c}`,
      airport: c => `Aeroporto di ${c}`,
    },
  },
];

export const DEFAULT_COUNTRY: CountryCode = 'GB';

export const cityNames = (country: Country) => country.cities.map(([name]) => name);

export function getCountry(code: string | undefined): Country {
  return COUNTRIES.find(c => c.code === code) ?? COUNTRIES.find(c => c.code === DEFAULT_COUNTRY)!;
}
