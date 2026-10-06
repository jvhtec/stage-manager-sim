/**
 * Playable home countries. The map's geography is procedural; the country
 * decides what it's *called* — real towns (largest first, so the biggest
 * becomes the metropolis), how venues are named, famous venues in the big
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
  /** Real towns, biggest first. The map uses the first N. */
  cities: string[];
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
    cities: ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Zaragoza', 'Málaga', 'Bilbao', 'Murcia', 'Palma', 'Alicante', 'Córdoba', 'Valladolid', 'Vigo', 'Gijón', 'Granada', 'Pamplona', 'Santander', 'Oviedo'],
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
    cities: ['London', 'Birmingham', 'Manchester', 'Glasgow', 'Liverpool', 'Leeds', 'Newcastle', 'Sheffield', 'Bristol', 'Cardiff', 'Edinburgh', 'Nottingham', 'Leicester', 'Belfast', 'Brighton', 'Southampton', 'Aberdeen', 'Norwich'],
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
    cities: ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Philadelphia', 'Dallas', 'Atlanta', 'Miami', 'Seattle', 'Denver', 'Boston', 'Nashville', 'Detroit', 'Austin', 'New Orleans', 'Minneapolis', 'Las Vegas', 'Portland'],
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
    cities: ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt', 'Stuttgart', 'Düsseldorf', 'Leipzig', 'Dortmund', 'Bremen', 'Dresden', 'Hannover', 'Nürnberg', 'Bonn', 'Mannheim', 'Freiburg', 'Kiel', 'Münster'],
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
    cities: ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Strasbourg', 'Montpellier', 'Bordeaux', 'Lille', 'Rennes', 'Reims', 'Toulon', 'Grenoble', 'Dijon', 'Angers', 'Nîmes', 'Brest'],
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
    cities: ['Roma', 'Milano', 'Napoli', 'Torino', 'Palermo', 'Genova', 'Bologna', 'Firenze', 'Bari', 'Catania', 'Verona', 'Venezia', 'Padova', 'Trieste', 'Brescia', 'Parma', 'Ancona', 'Pescara'],
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

export function getCountry(code: string | undefined): Country {
  return COUNTRIES.find(c => c.code === code) ?? COUNTRIES.find(c => c.code === DEFAULT_COUNTRY)!;
}
