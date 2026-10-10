/**
 * Can the room take the show? Every venue has a power supply, a roof that can carry so much flown
 * weight (open-air stadiums have none: the staging brings its own ground support) and a load-in an
 * artic may not reach. Every rig draws power and flies weight — a 1980s rig of par cans drinks far
 * more than an LED one, a line array or a video wall is heavy. When the production doesn't fit the
 * room you redesign it before the night (a generator, ground-support towers, vans to shuttle the
 * kit from where the artic can park) or live with the consequences: trips, a half-flown rig, a
 * late load-in. Some jobs aren't worth taking at all.
 */
import { getProduct, productsAvailableIn, expectedQuality, type GearKind } from './content/gear';
import { getModel } from './catalog';
import { book, formatMoney } from './core';
import { traitsOf } from './venueTraits';
import type { Gig, GearStock, TycoonState, Vehicle, Venue, VenueKind, WorldMap } from './types';
import { DEPTS } from './types';

/** Power draw (kW) and flown weight (tonnes) of one unit (a flight-cased system package) of each kind. */
const LOAD: Record<GearKind, { kw: number; t: number }> = {
  'point-source': { kw: 6, t: 0.3 },
  'line-array': { kw: 5, t: 1.2 },
  'console-analog': { kw: 0.6, t: 0 },
  'console-digital': { kw: 0.4, t: 0 },
  par: { kw: 18, t: 0.6 },
  'moving-spot': { kw: 12, t: 0.5 },
  'moving-wash': { kw: 8, t: 0.4 },
  beam: { kw: 6, t: 0.3 },
  scanner: { kw: 8, t: 0.3 },
  desk: { kw: 0.3, t: 0 },
  jumbotron: { kw: 25, t: 0 },
  projector: { kw: 6, t: 0.1 },
  'led-wall': { kw: 15, t: 1.5 },
  'media-server': { kw: 1, t: 0 },
  deck: { kw: 0, t: 0 },
  truss: { kw: 0, t: 0.8 },
  motor: { kw: 3, t: 0 },
  automation: { kw: 10, t: 0.3 },
  set: { kw: 2, t: 0.5 },
};

/** Tonnes of ground support each staging unit brings (towers and roof systems). */
export const GROUND_SUPPORT_PER_STAGE = 5;

const BASE: Record<VenueKind, { kw: number; roof: number }> = {
  pub: { kw: 30, roof: 0.5 },
  hall: { kw: 60, roof: 2 },
  club: { kw: 80, roof: 3 },
  theatre: { kw: 150, roof: 8 },
  arena: { kw: 500, roof: 40 },
  stadium: { kw: 250, roof: 0 },
  airport: { kw: 0, roof: 0 },
};

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967296;
}

export interface VenueLimits {
  powerKw: number;
  /** Tonnes the roof can carry; 0 for open air. */
  roofT: number;
  /** An artic can't get to the load-in. */
  noArtics: boolean;
}

export function venueLimits(world: Pick<WorldMap, 'country' | 'cityById'>, venue: Venue): VenueLimits {
  const base = BASE[venue.kind];
  const traits = traitsOf(world, venue);
  return {
    powerKw: Math.round((base.kw * (0.7 + 0.6 * hash(`${venue.name}|kw`))) / 5) * 5,
    roofT: Math.round(base.roof * (0.7 + 0.6 * hash(`${venue.name}|roof`)) * 2) / 2,
    noArtics: traits.loadIn !== 'dock',
  };
}

export function rigLoad(kit: GearStock): { kw: number; flownT: number; groundT: number } {
  let kw = 0;
  let flownT = 0;
  let stage = 0;
  for (const id in kit) {
    const p = getProduct(id);
    const l = LOAD[p.kind] ?? { kw: 0, t: 0 };
    kw += l.kw * kit[id];
    flownT += l.t * kit[id];
    if (p.dept === 'stage') stage += kit[id];
  }
  return { kw: Math.round(kw), flownT: Math.round(flownT * 10) / 10, groundT: stage * GROUND_SUPPORT_PER_STAGE };
}

/** The kind of rig a show this size would usually carry this year, to judge an offer. */
export function typicalKit(gig: Pick<Gig, 'needs' | 'tier'>, year: number): GearStock {
  const kit: GearStock = {};
  const target = expectedQuality(gig.tier, year);
  DEPTS.forEach(d => {
    if (!gig.needs[d]) return;
    const options = productsAvailableIn(year, d).sort((a, b) => Math.abs(a.quality - target) - Math.abs(b.quality - target) || b.introYear - a.introYear);
    if (options[0]) kit[options[0].id] = gig.needs[d];
  });
  return kit;
}

export type FixId = 'generator' | 'groundSupport' | 'shuttle';

export interface ProductionProblem {
  id: FixId;
  label: string;
  detail: string;
  fixLabel: string;
  fixCost: number;
}

const days = (gig: Gig) => gig.days ?? 1;
export const generatorCost = (shortKw: number, d: number) => Math.round((600 + shortKw * 6) * d / 50) * 50;
export const groundSupportCost = (shortT: number, d: number) => Math.round((1500 + shortT * 350) * Math.min(3, d) / 50) * 50;
export const SHUTTLE_PER_ARTIC = 350;
/** Hand-balling the kit from where an artic could park. */
export const SHUTTLE_DELAY_HOURS = 2;

/** What's wrong with putting this kit (and these trucks) into this room. */
export function productionProblems(world: Pick<WorldMap, 'country' | 'cityById' | 'venueById'>, gig: Gig, kit: GearStock, vehicles: Pick<Vehicle, 'modelId'>[]): ProductionProblem[] {
  // Pub and hall gigs scale down to the wall sockets; the checks start at clubs and theatres.
  if (gig.festival || gig.overseas || gig.tier < 2) return [];
  const venue = world.venueById.get(gig.venueId);
  if (!venue || venue.kind === 'airport') return [];
  const lim = venueLimits(world, venue);
  const load = rigLoad(kit);
  const fixes = gig.fixes ?? {};
  const out: ProductionProblem[] = [];
  const shortKw = load.kw - lim.powerKw;
  if (shortKw > 0 && !fixes.generator) {
    out.push({ id: 'generator', label: 'Not enough power', detail: `The rig draws about ${load.kw} kW; the house supply gives ${lim.powerKw} kW.`, fixLabel: 'Hire a generator', fixCost: generatorCost(shortKw, days(gig)) });
  }
  const capacity = lim.roofT + load.groundT;
  const shortT = load.flownT - capacity;
  if (shortT > 0.25 && !fixes.groundSupport) {
    out.push({
      id: 'groundSupport',
      label: lim.roofT ? 'Roof can’t take the rig' : 'Nothing to hang from',
      detail: lim.roofT ? `About ${load.flownT} t to fly; the roof takes ${lim.roofT} t${load.groundT ? ` and your staging ${load.groundT} t` : ''}.` : `Open air: ${load.flownT} t to fly and ${load.groundT ? `only ${load.groundT} t of` : 'no'} ground support in the staging.`,
      fixLabel: 'Hire ground-support towers',
      fixCost: groundSupportCost(shortT, days(gig)),
    });
  }
  const artics = vehicles.filter(v => getModel(v.modelId).kind === 'semi').length;
  if (lim.noArtics && artics && !fixes.shuttle) {
    out.push({ id: 'shuttle', label: 'Artics can’t reach the load-in', detail: `The load-in is off the street: ${artics} artic${artics > 1 ? 's' : ''} would be unloaded by hand from where ${artics > 1 ? 'they' : 'it'} can park (+${SHUTTLE_DELAY_HOURS}h).`, fixLabel: 'Book local vans to shuttle', fixCost: SHUTTLE_PER_ARTIC * artics });
  }
  return out;
}

/** What the unfixed problems do on the night. */
export function problemEffects(problems: ProductionProblem[]) {
  const has = (id: FixId) => problems.some(p => p.id === id);
  return {
    failureFactor: has('generator') ? 2 : 1,
    quality: (has('generator') ? 0.04 : 0) + (has('groundSupport') ? 0.08 : 0),
    delay: has('shuttle') ? SHUTTLE_DELAY_HOURS : 0,
  };
}

export const FIX_TEXT: Record<FixId, string> = {
  generator: 'the house supply kept tripping',
  groundSupport: 'half the rig stayed on the floor — the venue wouldn’t let it fly',
  shuttle: 'the artics were unloaded by hand from the street',
};

/** Book a fix for a show. */
export function bookFix(s: TycoonState, gig: Gig, problem: ProductionProblem): string {
  gig.fixes = { ...(gig.fixes ?? {}), [problem.id]: true };
  book(s, 'onsite', -problem.fixCost);
  return `${problem.fixLabel} for ${gig.act}: ${formatMoney(s, problem.fixCost)}.`;
}
