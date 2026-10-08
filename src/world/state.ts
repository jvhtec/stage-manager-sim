import { createRandomSeed, createRng } from '@/lib/rng';
import {
  START_YEAR,
  STARTING_CASH,
  STARTING_REPUTATION,
  VEHICLE_MODELS,
  getModel,
} from './catalog';
import { newId } from './core';
import { expectedQuality, productsAvailableIn } from './content/gear';
import { DEFAULT_COUNTRY, type CountryCode } from './content/countries';
import { updateRivals } from './sim';
import { generateNationalTour } from './tours';
import { getWorld } from './mapgen';
import { generateOffer } from './offers';
import { marketNow } from './market';
import { roadDistance } from './pathfinding';
import { DEPTS, type GearStock, type Policies, type TycoonState, type Vehicle } from './types';

export const TYCOON_SAVE_KEY = 'stage-manager-sim:tycoon';
// v2: gear became real products (GearStock), plus artist relations, riders
// and rival specialties — v1 saves are discarded rather than half-migrated.
// v3: warehouse lots (several per town), airports, tours.
// v4: home country, audio consoles. v5: star techs, real populations.
// v6: market calendar, festivals, gear wear, crew fatigue, contracts, awards —
// v5 saves are migrated by filling in the new fields.
export const TYCOON_SAVE_VERSION = 6;
const OLDEST_MIGRATABLE = 5;

export const DEFAULT_POLICIES: Policies = { workshop: 'basic', pay: 'standard', insurance: 'none', freelance: 'fill' };

export interface NewGameOptions {
  companyName: string;
  color: string;
  seed?: number;
  hqCityId?: string;
  country?: CountryCode;
  startYear?: number;
}

/**
 * A starter rig for the era: in each slot, the cheapest kit that a pub
 * crowd of that year would still accept (or the best there is, early on).
 */
export function starterKit(year: number): GearStock {
  const counts: Record<string, number> = { audio: 5, console: 2, lighting: 4, video: 1, stage: 3 };
  const kit: GearStock = {};
  DEPTS.forEach(dept => {
    const options = productsAvailableIn(year, dept).sort((a, b) => a.price - b.price);
    if (!options.length) return;
    const bar = expectedQuality(1, year);
    const ok = options.filter(p => p.quality >= bar);
    const pool = ok.length ? ok : [...options].sort((a, b) => b.quality - a.quality);
    // Lighting gets two kinds of fixture for a bit of variety.
    if (dept === 'lighting' && pool.length > 1) {
      kit[pool[0].id] = 2;
      kit[pool[1].id] = counts[dept] - 2;
    } else {
      kit[pool[0].id] = counts[dept];
    }
  });
  return kit;
}

/** A crew van and a box truck from whatever the era sells. */
export function starterFleet(year: number): string[] {
  const models = VEHICLE_MODELS.filter(m => m.introYear <= year).sort((a, b) => a.price - b.price);
  const van = models.find(m => m.crewSeats >= 4) ?? models[0];
  const truck = models.find(m => m.id !== van.id && m.gearCapacity >= 6) ?? models.find(m => m.id !== van.id) ?? van;
  return [van.id, truck.id];
}

/** Towns make the best starting HQ: busy enough for work, not in a rival's back yard. */
export function suggestedHqCities(seed: number, country: CountryCode = DEFAULT_COUNTRY) {
  const world = getWorld(seed, country);
  return world.cities.filter(c => c.size === 'town' || c.size === 'city');
}

export function makeVehicle(state: TycoonState, modelId: string, homeCityId: string): Vehicle {
  const model = getModel(modelId);
  const count = state.vehicles.filter(v => v.owner === 'player' && getModel(v.modelId).kind === model.kind).length + 1;
  const kindLabel = { van: 'Van', truck: 'Truck', semi: 'Artic', bus: 'Bus' }[model.kind];
  return {
    id: newId(state, 'veh'),
    owner: 'player',
    modelId,
    name: `${kindLabel} ${count}`,
    homeCityId,
    boughtHour: state.hour,
    reliability: model.reliability,
    lastServiceHour: state.hour,
    status: 'parked',
    cityId: homeCityId,
    orders: [],
    cargo: {},
    crew: 0,
    profitThisYear: 0,
    profitLastYear: 0,
  };
}

export function createTycoonGame(options: NewGameOptions): TycoonState {
  const seed = options.seed ?? createRandomSeed();
  const country = options.country ?? DEFAULT_COUNTRY;
  const startYear = options.startYear ?? START_YEAR;
  const world = getWorld(seed, country);
  const rng = createRng(seed ^ 0xa11ce);

  const hqCandidates = suggestedHqCities(seed, country);
  const hq =
    world.cityById.get(options.hqCityId ?? '') ??
    hqCandidates.find(c => c.size === 'town') ??
    world.cities[0];

  const state: TycoonState = {
    mapSeed: seed,
    country,
    rngState: rng.getState(),
    hour: 8,
    startYear,
    company: {
      name: options.companyName,
      color: options.color,
      reputation: STARTING_REPUTATION,
      cash: STARTING_CASH,
      loan: 0,
      hqCityId: hq.id,
    },
    depots: [],
    vehicles: [],
    gigs: [],
    cityRatings: Object.fromEntries(world.cities.map(c => [c.id, 50])),
    rivals: [],
    tours: [],
    techs: [],
    news: [],
    ledger: {},
    announcedModels: VEHICLE_MODELS.filter(m => m.introYear <= startYear).map(m => m.id),
    announcedGear: productsAvailableIn(startYear).map(p => p.id),
    policies: { ...DEFAULT_POLICIES },
    crewMorale: 65,
    gearCondition: {},
    festivalsPosted: [],
    eventsPosted: [],
    contracts: [],
    yearStats: {},
    awards: [],
    announcedClimate: [],
    artistRelations: {},
    negativeMonths: 0,
    nextId: 0,
    stats: { showsPlayed: 0, showsFailed: 0, peakCash: STARTING_CASH },
  };

  state.depots.push({
    id: newId(state, 'depot'),
    kind: 'warehouse',
    size: 1,
    // One prep tech to start; hire sales staff to bring in work.
    staff: { warehouse: 1, office: 0 },
    cityId: hq.id,
    lot: 0,
    // A small, slightly dated rig for the era you start in.
    gear: starterKit(startYear),
    crew: 5,
    builtHour: 0,
  });
  starterFleet(startYear).forEach(modelId => state.vehicles.push(makeVehicle(state, modelId, hq.id)));

  // Rivals (real production houses) set up in the biggest places that aren't your home town.
  updateRivals(state, world, startYear);

  // An opening market: a couple of small shows close to home so the first
  // week has something bookable, plus a spread across the map.
  const nearby = [...world.cities]
    .sort((a, b) => roadDistance(world, hq.id, a.id) - roadDistance(world, hq.id, b.id))
    .slice(0, 3);
  nearby.forEach(city => {
    const gig = generateOffer(state, world, city, rng, { minLeadDays: 4, maxTier: 1 });
    if (gig) state.gigs.push(gig);
  });
  for (let i = 0; i < 6; i++) {
    const gig = generateOffer(state, world, rng.pick(world.cities), rng);
    if (gig) state.gigs.push(gig);
  }
  // And one small-venue tour, so touring is on the table from day one.
  for (let i = 0; i < 6 && !state.tours.length; i++) generateNationalTour(state, world, rng, 1, true);
  state.rngState = rng.getState();

  // The economy you're starting into.
  marketNow(state).periods.forEach(p => {
    state.announcedClimate.push(p.id);
    state.news.push({ id: newId(state, 'news'), hour: state.hour, text: `${p.label}: ${p.news}`, tone: 'info' });
  });

  state.news.push({
    id: newId(state, 'news'),
    hour: state.hour,
    text: `${state.company.name} opens its first warehouse in ${hq.name}. Book a show, assign a truck, and get the gear there by load-in.`,
    tone: 'big',
    cityId: hq.id,
  });
  return state;
}

export function saveTycoonGame(state: TycoonState) {
  try {
    localStorage.setItem(TYCOON_SAVE_KEY, JSON.stringify({ version: TYCOON_SAVE_VERSION, state }));
  } catch {
    // Storage full or blocked — keep playing in memory.
  }
}

export function loadTycoonGame(): TycoonState | null {
  try {
    const raw = localStorage.getItem(TYCOON_SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (!save?.state?.company || save.version > TYCOON_SAVE_VERSION || save.version < OLDEST_MIGRATABLE) return null;
    return migrate(save.state);
  } catch {
    return null;
  }
}

/** Fills in fields added since the save was made (everything new defaults to "nothing yet"). */
export function migrate(state: Partial<TycoonState>): TycoonState {
  const s = state as TycoonState;
  s.announcedClimate ??= [];
  s.festivalsPosted ??= [];
  s.eventsPosted ??= [];
  s.policies = { ...DEFAULT_POLICIES, ...s.policies };
  s.gearCondition ??= {};
  s.crewMorale ??= 65;
  s.contracts ??= [];
  s.depots.forEach(d => {
    d.kind ??= 'warehouse';
    d.size ??= 1;
    d.staff ??= { warehouse: 1, office: 0 };
  });
  s.yearStats ??= {};
  s.awards ??= [];
  return s;
}

export function clearTycoonGame() {
  try {
    localStorage.removeItem(TYCOON_SAVE_KEY);
  } catch {
    // ignore
  }
}
