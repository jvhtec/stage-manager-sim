/**
 * Small shared helpers for the world sim. Everything here mutates a *draft*
 * state — public entry points (`advanceHours`, the actions) always clone the
 * incoming state first, so callers only ever see immutable updates.
 */
import { createRng, type Rng } from '@/lib/rng';
import {
  DEPARTURE_BUFFER_HOURS,
  DAYS_PER_YEAR,
  HOURS_PER_DAY,
  LOAD_IN_HOUR,
  LOAD_OUT_DONE_HOUR,
  SHOW_END_HOUR,
  SHOW_START_HOUR,
  getModel,
} from './catalog';
import { roadDistance } from './pathfinding';
import { getRegion } from './content/world';
import { getCountry } from './content/countries';
import type {
  DeptCounts,
  Gig,
  LedgerCategory,
  NewsItem,
  NewsTone,
  TycoonState,
  Vehicle,
  WorldMap,
} from './types';

export const MAX_NEWS = 60;

export function cloneState(state: TycoonState): TycoonState {
  return structuredClone(state);
}

export function emptyCounts(): DeptCounts {
  return { audio: 0, console: 0, lighting: 0, video: 0, stage: 0 };
}

export function sumCounts(c: DeptCounts): number {
  return c.audio + c.console + c.lighting + c.video + c.stage;
}

// Time ----------------------------------------------------------------------

export const dayOf = (hour: number) => Math.floor(hour / HOURS_PER_DAY);

export function dateOfDay(state: Pick<TycoonState, 'startYear'>, day: number): Date {
  return new Date(Date.UTC(state.startYear, 0, 1) + day * 86400000);
}

export function yearOf(state: Pick<TycoonState, 'startYear'>, hour: number): number {
  return dateOfDay(state, dayOf(hour)).getUTCFullYear();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDay(state: Pick<TycoonState, 'startYear'>, day: number): string {
  const d = dateOfDay(state, day);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function formatHour(state: Pick<TycoonState, 'startYear'>, hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  return `${formatDay(state, dayOf(hour))} ${String(h).padStart(2, '0')}:00`;
}

// Overseas legs: trucks hand the rig over at the airport `freightDays`
// before the first date (that's "load-in"), and it comes back
// `freightDays` after the last one.
const freightDays = (gig: Gig) => (gig.overseas ? getRegion(gig.overseas.regionId).freightDays : 0);
export const lastShowDay = (gig: Gig) => (gig.overseas ? gig.overseas.stops[gig.overseas.stops.length - 1].day : gig.day + (gig.days ?? 1) - 1);

export const loadInHour = (gig: Gig) => (gig.day - freightDays(gig)) * HOURS_PER_DAY + LOAD_IN_HOUR;
/** Anything that arrives after this misses the show (or, overseas, the last flight out). */
export const showStartHour = (gig: Gig) =>
  gig.overseas ? loadInHour(gig) + 10 : gig.day * HOURS_PER_DAY + SHOW_START_HOUR;
export const showEndHour = (gig: Gig) => lastShowDay(gig) * HOURS_PER_DAY + SHOW_END_HOUR;
export const loadOutDoneHour = (gig: Gig) => (lastShowDay(gig) + freightDays(gig)) * HOURS_PER_DAY + LOAD_OUT_DONE_HOUR;

// Travel --------------------------------------------------------------------

export function travelHours(world: WorldMap, modelId: string, from: string, to: string): number {
  const dist = roadDistance(world, from, to);
  if (!Number.isFinite(dist)) return Infinity;
  return Math.ceil(dist / getModel(modelId).speed);
}

/** When a vehicle sitting in `from` should leave to make `gig`'s load-in with a safety margin. */
export function plannedDepartureHour(world: WorldMap, v: Vehicle, from: string, gig: Gig): number {
  const hours = travelHours(world, v.modelId, from, gig.cityId);
  const buffer = DEPARTURE_BUFFER_HOURS + Math.ceil(hours * 0.1);
  return loadInHour(gig) - hours - buffer;
}

// Vehicles --------------------------------------------------------------------

export function vehicleAgeYears(v: Vehicle, hour: number): number {
  return (hour - v.boughtHour) / HOURS_PER_DAY / DAYS_PER_YEAR;
}

/** Best reliability a service can restore — drops once a vehicle is past its lifespan. */
export function maxReliability(v: Vehicle, hour: number): number {
  const model = getModel(v.modelId);
  const over = Math.max(0, vehicleAgeYears(v, hour) - model.lifespanYears);
  return Math.max(30, model.reliability - over * 6);
}

export function sellValue(v: Vehicle, hour: number): number {
  const model = getModel(v.modelId);
  const remaining = Math.max(0.1, 1 - vehicleAgeYears(v, hour) / model.lifespanYears);
  return Math.round((model.price * remaining * 0.8) / 50) * 50;
}

// Money & news --------------------------------------------------------------

export function book(state: TycoonState, category: LedgerCategory, amount: number) {
  if (!amount) return;
  state.company.cash += amount;
  const year = yearOf(state, state.hour);
  const row = (state.ledger[year] ??= {});
  row[category] = (row[category] ?? 0) + amount;
}

export function newId(state: TycoonState, prefix: string): string {
  state.nextId += 1;
  return `${prefix}-${state.nextId}`;
}

export function pushNews(
  state: TycoonState,
  text: string,
  tone: NewsTone,
  refs: Pick<NewsItem, 'cityId' | 'vehicleId' | 'gigId'> = {},
) {
  state.news.unshift({ id: newId(state, 'news'), hour: state.hour, text, tone, ...refs });
  if (state.news.length > MAX_NEWS) state.news.length = MAX_NEWS;
}

/** Runs `fn` with an Rng seeded from the state and writes the advanced seed back. */
export function withRng<T>(state: TycoonState, fn: (rng: Rng) => T): T {
  const rng = createRng(state.rngState);
  const out = fn(rng);
  state.rngState = rng.getState();
  return out;
}

export const playerVehicles = (state: TycoonState) => state.vehicles.filter(v => v.owner === 'player');

export function depotInCity(state: TycoonState, cityId: string) {
  return state.depots.find(d => d.cityId === cityId);
}

export function gigById(state: TycoonState, id: string) {
  return state.gigs.find(g => g.id === id);
}

export function totalCrew(state: TycoonState): number {
  return (
    state.depots.reduce((sum, d) => sum + d.crew, 0) +
    playerVehicles(state).reduce((sum, v) => sum + v.crew, 0)
  );
}

/** Index of an unclaimed warehouse lot in a city, or -1 if every lot is taken. */
export function freeLot(state: TycoonState, world: WorldMap, cityId: string): number {
  const city = world.cityById.get(cityId);
  if (!city) return -1;
  const used = new Set([
    ...state.depots.filter(d => d.cityId === cityId).map(d => d.lot),
    ...state.rivals.filter(r => r.hqCityId === cityId).map(r => r.lot),
  ]);
  return city.lots.findIndex((_, i) => !used.has(i));
}

/** Money in the home country's currency, e.g. "€12,500". */
export function formatMoney(state: Pick<TycoonState, 'country'>, amount: number): string {
  const symbol = getCountry(state.country).currency;
  return `${amount < 0 ? '-' : ''}${symbol}${Math.abs(Math.round(amount)).toLocaleString('en-US')}`;
}
