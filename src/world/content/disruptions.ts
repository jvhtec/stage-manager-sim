/**
 * Real days when the roads went wrong: strikes, blockades, storms and the ash cloud. During one,
 * the roads it covers (a whole country or an area around a point) take longer, fuel can cost more,
 * borders can close up, and air freight can be grounded. Edit freely — dates are as reported.
 */
import type { CountryCode } from './countries';

export interface Disruption {
  id: string;
  /** Countries it hits; omit for everyone (the ash cloud). */
  countries?: CountryCode[];
  from: [number, number, number];
  to: [number, number, number];
  kind: 'strike' | 'blockade' | 'storm' | 'fuel' | 'ash' | 'border';
  title: string;
  /** What the news says when it starts. */
  news: string;
  /** Roads within `km` of a point (or the whole country) take this much longer. */
  road?: number;
  area?: { at: [number, number]; km: number };
  /** Fuel costs this much more. */
  fuel?: number;
  /** Extra hours at the country's borders. */
  borderHours?: number;
  /** Air freight grounded: each booked show abroad in the window costs this to rescue by road and charter. */
  freightRescue?: number;
}

const D = (d: Disruption) => d;

export const DISRUPTIONS: Disruption[] = [
  // United Kingdom
  D({ id: 'gb-haulage-1979', countries: ['GB'], from: [1979, 1, 3], to: [1979, 2, 12], kind: 'strike', title: 'Winter of Discontent', news: 'Lorry drivers are on strike and picketing depots and ports: the roads are slow and diesel is short.', road: 1.4, fuel: 1.3 }),
  D({ id: 'gb-storm-1987', countries: ['GB'], from: [1987, 10, 16], to: [1987, 10, 18], kind: 'storm', title: 'The Great Storm', news: 'A hurricane-force storm has felled trees across the south-east: roads around London are blocked.', road: 2.5, area: { at: [51.3, 0.1], km: 160 } }),
  D({ id: 'gb-fuel-2000', countries: ['GB'], from: [2000, 9, 8], to: [2000, 9, 15], kind: 'fuel', title: 'Fuel protests', news: 'Hauliers and farmers are blockading the refineries: pumps are running dry across the country.', road: 1.2, fuel: 1.8 }),
  D({ id: 'gb-freeze-2010', countries: ['GB'], from: [2010, 12, 17], to: [2010, 12, 27], kind: 'storm', title: 'The big freeze', news: 'Heavy snow and ice across Britain: motorways are crawling and gritters can’t keep up.', road: 1.6 }),
  D({ id: 'gb-beast-2018', countries: ['GB'], from: [2018, 2, 26], to: [2018, 3, 3], kind: 'storm', title: 'The Beast from the East', news: 'Siberian snow has hit Britain: roads are blocked and lorries stranded.', road: 1.6 }),
  // France
  D({ id: 'fr-routiers-1984', countries: ['FR'], from: [1984, 2, 16], to: [1984, 2, 24], kind: 'blockade', title: 'Routiers’ blockade', news: 'French lorry drivers have blocked the motorways and the Alpine passes.', road: 1.8 }),
  D({ id: 'fr-permis-1992', countries: ['FR'], from: [1992, 6, 29], to: [1992, 7, 10], kind: 'blockade', title: 'Points-licence blockade', news: 'Truckers protesting the new points licence have blockaded France: hundreds of barricades on the roads.', road: 2 }),
  D({ id: 'fr-routiers-1996', countries: ['FR'], from: [1996, 11, 18], to: [1996, 11, 29], kind: 'blockade', title: 'Routiers’ strike', news: 'The lorry drivers’ strike has barricaded depots, refineries and border crossings.', road: 1.8, borderHours: 4 }),
  D({ id: 'fr-fuel-2000', countries: ['FR'], from: [2000, 9, 4], to: [2000, 9, 12], kind: 'fuel', title: 'Fuel blockades', news: 'Hauliers are blockading the fuel depots: diesel is scarce and dear.', road: 1.3, fuel: 1.6 }),
  D({ id: 'fr-gilets-2018', countries: ['FR'], from: [2018, 11, 17], to: [2018, 12, 15], kind: 'blockade', title: 'Gilets jaunes', news: 'Gilets jaunes are occupying roundabouts and toll plazas across France.', road: 1.25 }),
  // Spain
  D({ id: 'es-transportistas-2008', countries: ['ES'], from: [2008, 6, 9], to: [2008, 6, 13], kind: 'strike', title: 'Hauliers’ strike', news: 'Spanish hauliers are on strike over diesel prices: pickets on the motorways and empty forecourts.', road: 1.8, fuel: 1.4 }),
  D({ id: 'es-filomena-2021', countries: ['ES'], from: [2021, 1, 8], to: [2021, 1, 14], kind: 'storm', title: 'Storm Filomena', news: 'The heaviest snow in fifty years has buried Madrid: roads in the centre are impassable.', road: 3, area: { at: [40.4, -3.7], km: 250 } }),
  D({ id: 'es-transporte-2022', countries: ['ES'], from: [2022, 3, 14], to: [2022, 4, 1], kind: 'strike', title: 'Transport stoppage', news: 'Independent hauliers have stopped work over fuel costs: supplies and roads are disrupted.', road: 1.4, fuel: 1.3 }),
  // Italy
  D({ id: 'it-neve-1985', countries: ['IT'], from: [1985, 1, 13], to: [1985, 1, 20], kind: 'storm', title: 'The great snowfall', news: 'A metre of snow on Milan and the north: the autostrade are closed for days.', road: 2, area: { at: [45.5, 9.2], km: 250 } }),
  D({ id: 'it-tir-2007', countries: ['IT'], from: [2007, 12, 10], to: [2007, 12, 14], kind: 'strike', title: 'TIR strike', news: 'Italian hauliers have stopped: blockades on the autostrade and empty shelves.', road: 1.8 }),
  D({ id: 'it-forconi-2012', countries: ['IT'], from: [2012, 1, 16], to: [2012, 1, 26], kind: 'blockade', title: 'Forconi blockade', news: 'The “pitchforks” movement has blockaded Sicily’s roads and ports.', road: 2.5, area: { at: [37.6, 14], km: 250 } }),
  // Germany
  D({ id: 'de-schnee-1978', countries: ['DE'], from: [1978, 12, 29], to: [1979, 1, 5], kind: 'storm', title: 'Schneekatastrophe', news: 'Blizzards have cut off the north: autobahns in Schleswig-Holstein are under snowdrifts.', road: 3, area: { at: [54.2, 10.5], km: 220 } }),
  D({ id: 'de-elbe-2002', countries: ['DE'], from: [2002, 8, 12], to: [2002, 8, 20], kind: 'storm', title: 'The Elbe flood', news: 'The Elbe has burst its banks: Dresden is under water and roads around it are closed.', road: 2.5, area: { at: [51.05, 13.74], km: 150 } }),
  D({ id: 'de-kyrill-2007', countries: ['DE'], from: [2007, 1, 18], to: [2007, 1, 20], kind: 'storm', title: 'Storm Kyrill', news: 'Hurricane Kyrill is sweeping Germany: trees across the autobahns, lorries blown over.', road: 1.6 }),
  // United States
  D({ id: 'us-blizzard-1978', countries: ['US'], from: [1978, 2, 5], to: [1978, 2, 9], kind: 'storm', title: 'The Blizzard of ’78', news: 'A blizzard has buried New England: interstates closed, thousands stranded on Route 128.', road: 3, area: { at: [42.4, -71.1], km: 400 } }),
  D({ id: 'us-storm-1993', countries: ['US'], from: [1993, 3, 12], to: [1993, 3, 15], kind: 'storm', title: 'The Storm of the Century', news: 'A superstorm is hitting the whole East Coast: snow from Alabama to Maine.', road: 2.5, area: { at: [37, -80], km: 900 } }),
  D({ id: 'us-blizzard-1996', countries: ['US'], from: [1996, 1, 6], to: [1996, 1, 10], kind: 'storm', title: 'The Blizzard of ’96', news: 'Two feet of snow from Washington to Boston: the I-95 corridor is shut.', road: 2.5, area: { at: [39.9, -75.2], km: 500 } }),
  D({ id: 'us-911', countries: ['US'], from: [2001, 9, 11], to: [2001, 9, 18], kind: 'border', title: 'Borders locked down', news: 'After the attacks the borders are locked down: crossings into Canada and Mexico take most of a day.', borderHours: 14 }),
  D({ id: 'us-katrina', countries: ['US'], from: [2005, 8, 29], to: [2005, 9, 12], kind: 'storm', title: 'Hurricane Katrina', news: 'Katrina has devastated the Gulf Coast: roads closed and diesel scarce across the South.', road: 3, area: { at: [30, -90], km: 350 }, fuel: 1.3 }),
  // Everyone
  D({ id: 'ash-2010', from: [2010, 4, 15], to: [2010, 4, 21], kind: 'ash', title: 'The ash cloud', news: 'Eyjafjallajökull’s ash cloud has closed European airspace: no air freight, no flights.', freightRescue: 12000 }),
];

const dayNumber = ([y, m, d]: [number, number, number]) => Date.UTC(y, m - 1, d) / 86400000;

/** Disruptions under way in a country on a date. */
export function disruptionsOn(country: string, date: Date): Disruption[] {
  const today = Math.floor(date.getTime() / 86400000);
  return DISRUPTIONS.filter(d => (!d.countries || d.countries.includes(country as CountryCode)) && today >= dayNumber(d.from) && today <= dayNumber(d.to));
}

/** Days from `date` until a disruption starts (negative once it has). */
export const daysUntil = (d: Disruption, date: Date) => dayNumber(d.from) - Math.floor(date.getTime() / 86400000);
export const daysSinceEnd = (d: Disruption, date: Date) => Math.floor(date.getTime() / 86400000) - dayNumber(d.to);
