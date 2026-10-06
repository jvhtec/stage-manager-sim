/**
 * Overseas legs for world tours. These cities aren't on the map: the rig
 * is trucked to your country's international airport, flown out, plays a
 * run of dates, and is flown back. Venue names are a mix of eras — flavour,
 * not a gazetteer. Edit freely.
 */
export interface OverseasCity {
  city: string;
  country: string;
  arena: string;
  stadium: string;
}

export interface Region {
  id: string;
  name: string;
  /** Days each way for the air freight. */
  freightDays: number;
  /** Air freight per gear unit, round trip. */
  freightPerUnit: number;
  /** Flights per crew member, round trip. */
  flightPerCrew: number;
  cities: OverseasCity[];
}

export const REGIONS: Region[] = [
  {
    id: 'europe',
    name: 'European leg',
    freightDays: 2,
    freightPerUnit: 350,
    flightPerCrew: 260,
    cities: [
      { city: 'Madrid', country: 'Spain', arena: 'WiZink Center', stadium: 'Santiago Bernabéu' },
      { city: 'Barcelona', country: 'Spain', arena: 'Palau Sant Jordi', stadium: 'Estadi Olímpic' },
      { city: 'Paris', country: 'France', arena: 'Bercy', stadium: 'Stade de France' },
      { city: 'Berlin', country: 'Germany', arena: 'Uber Arena', stadium: 'Olympiastadion' },
      { city: 'Amsterdam', country: 'Netherlands', arena: 'Ziggo Dome', stadium: 'Johan Cruijff ArenA' },
      { city: 'Milan', country: 'Italy', arena: 'Forum di Assago', stadium: 'San Siro' },
      { city: 'Lisbon', country: 'Portugal', arena: 'Altice Arena', stadium: 'Estádio da Luz' },
      { city: 'Dublin', country: 'Ireland', arena: '3Arena', stadium: 'Croke Park' },
      { city: 'Copenhagen', country: 'Denmark', arena: 'Royal Arena', stadium: 'Parken' },
      { city: 'Vienna', country: 'Austria', arena: 'Stadthalle', stadium: 'Ernst-Happel-Stadion' },
    ],
  },
  {
    id: 'northamerica',
    name: 'North American leg',
    freightDays: 4,
    freightPerUnit: 800,
    flightPerCrew: 620,
    cities: [
      { city: 'New York', country: 'USA', arena: 'Madison Square Garden', stadium: 'MetLife Stadium' },
      { city: 'Los Angeles', country: 'USA', arena: 'The Forum', stadium: 'Rose Bowl' },
      { city: 'Chicago', country: 'USA', arena: 'United Center', stadium: 'Soldier Field' },
      { city: 'Toronto', country: 'Canada', arena: 'Scotiabank Arena', stadium: 'Rogers Centre' },
      { city: 'Mexico City', country: 'Mexico', arena: 'Palacio de los Deportes', stadium: 'Estadio Azteca' },
    ],
  },
  {
    id: 'latam',
    name: 'Latin American leg',
    freightDays: 5,
    freightPerUnit: 950,
    flightPerCrew: 700,
    cities: [
      { city: 'São Paulo', country: 'Brazil', arena: 'Ginásio do Ibirapuera', stadium: 'Morumbi' },
      { city: 'Buenos Aires', country: 'Argentina', arena: 'Movistar Arena', stadium: 'Estadio Monumental' },
      { city: 'Santiago', country: 'Chile', arena: 'Movistar Arena', stadium: 'Estadio Nacional' },
      { city: 'Bogotá', country: 'Colombia', arena: 'Movistar Arena', stadium: 'El Campín' },
    ],
  },
  {
    id: 'apac',
    name: 'Asia-Pacific leg',
    freightDays: 6,
    freightPerUnit: 1100,
    flightPerCrew: 820,
    cities: [
      { city: 'Tokyo', country: 'Japan', arena: 'Nippon Budokan', stadium: 'Tokyo Dome' },
      { city: 'Seoul', country: 'South Korea', arena: 'KSPO Dome', stadium: 'Olympic Stadium' },
      { city: 'Sydney', country: 'Australia', arena: 'Qudos Bank Arena', stadium: 'Accor Stadium' },
      { city: 'Melbourne', country: 'Australia', arena: 'Rod Laver Arena', stadium: 'MCG' },
      { city: 'Singapore', country: 'Singapore', arena: 'Indoor Stadium', stadium: 'National Stadium' },
    ],
  },
];

export function getRegion(id: string): Region {
  const r = REGIONS.find(x => x.id === id);
  if (!r) throw new Error(`Unknown region ${id}`);
  return r;
}
