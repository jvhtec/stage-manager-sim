import { createRandomSeed, createRng } from '@/lib/rng';
import {
  START_YEAR,
  STARTING_CASH,
  STARTING_REPUTATION,
  VEHICLE_MODELS,
  getModel,
} from './catalog';
import { emptyCounts, newId } from './core';
import { getWorld } from './mapgen';
import { generateOffer } from './offers';
import { roadDistance } from './pathfinding';
import type { Rival, TycoonState, Vehicle } from './types';

export const TYCOON_SAVE_KEY = 'stage-manager-sim:tycoon';
export const TYCOON_SAVE_VERSION = 1;

export interface NewGameOptions {
  companyName: string;
  color: string;
  seed?: number;
  hqCityId?: string;
}

// Deliberately muted liveries that don't clash with any colour on the
// new-company palette, so a rival's warehouse never looks like yours.
const RIVAL_TEMPLATES = [
  { name: 'Pulsewave Collective', color: '#0e7490' },
  { name: 'LumenLyric Studios', color: '#854d0e' },
  { name: 'Deck & Drape Co-op', color: '#4d7c0f' },
];

/** Towns make the best starting HQ: busy enough for work, not in a rival's back yard. */
export function suggestedHqCities(seed: number) {
  const world = getWorld(seed);
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
    cargo: emptyCounts(),
    crew: 0,
    profitThisYear: 0,
    profitLastYear: 0,
  };
}

export function createTycoonGame(options: NewGameOptions): TycoonState {
  const seed = options.seed ?? createRandomSeed();
  const world = getWorld(seed);
  const rng = createRng(seed ^ 0xa11ce);

  const hqCandidates = suggestedHqCities(seed);
  const hq =
    world.cityById.get(options.hqCityId ?? '') ??
    hqCandidates.find(c => c.size === 'town') ??
    world.cities[0];

  const state: TycoonState = {
    mapSeed: seed,
    rngState: rng.getState(),
    hour: 8,
    startYear: START_YEAR,
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
    news: [],
    ledger: {},
    announcedModels: VEHICLE_MODELS.filter(m => m.introYear <= START_YEAR).map(m => m.id),
    negativeMonths: 0,
    nextId: 0,
    stats: { showsPlayed: 0, showsFailed: 0, peakCash: STARTING_CASH },
  };

  state.depots.push({
    id: newId(state, 'depot'),
    cityId: hq.id,
    gear: { audio: 5, lighting: 4, video: 1, stage: 3 },
    crew: 5,
    builtHour: 0,
  });
  state.vehicles.push(makeVehicle(state, 'splitter-van', hq.id));
  state.vehicles.push(makeVehicle(state, 'luton-box', hq.id));

  // Rivals set up in the biggest places that aren't your home town.
  const rivalCities = [...world.cities]
    .filter(c => c.id !== hq.id)
    .sort((a, b) => b.population - a.population)
    .slice(0, RIVAL_TEMPLATES.length);
  state.rivals = rivalCities.map((city, i): Rival => ({
    id: `rival-${i}`,
    name: RIVAL_TEMPLATES[i].name,
    color: RIVAL_TEMPLATES[i].color,
    hqCityId: city.id,
    reputation: 30 + rng.nextInt(25),
    showsPlayed: 0,
  }));

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
  state.rngState = rng.getState();

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
    if (save?.version !== TYCOON_SAVE_VERSION || !save.state?.company) return null;
    return save.state as TycoonState;
  } catch {
    return null;
  }
}

export function clearTycoonGame() {
  try {
    localStorage.removeItem(TYCOON_SAVE_KEY);
  } catch {
    // ignore
  }
}
