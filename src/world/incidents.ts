/**
 * Things go wrong: trucks crash, warehouses get broken into, and festivals
 * get rained on. Insurance (a monthly premium on what you own) pays out on
 * the damage — some of it on the basic policy, all of it on the full one.
 */
import type { Rng } from '@/lib/rng';
import { getModel } from './catalog';
import { book, formatMoney, pushNews } from './core';
import { getProduct } from './content/gear';
import { replacementValue, ownedStock, condition } from './wear';
import type { Gig, InsuranceLevel, TycoonState, Vehicle } from './types';
import type { CountryCode } from './content/countries';

export interface InsuranceInfo {
  label: string;
  /** Monthly premium as a share of what you own (gear + fleet). */
  monthlyRate: number;
  /** Share of losses paid out. */
  cover: number;
  /** Whether bad weather at outdoor shows is covered. */
  weather: boolean;
  blurb: string;
}

export const INSURANCE: Record<InsuranceLevel, InsuranceInfo> = {
  none: { label: 'Uninsured', monthlyRate: 0, cover: 0, weather: false, blurb: 'Nothing to pay — until something happens.' },
  basic: { label: 'Basic cover', monthlyRate: 0.0025, cover: 0.6, weather: false, blurb: 'Theft and accidents, 60% of the loss.' },
  full: { label: 'Comprehensive', monthlyRate: 0.0055, cover: 1, weather: true, blurb: 'Everything, in full — including weather at outdoor shows.' },
};
export const INSURANCE_LEVELS: InsuranceLevel[] = ['none', 'basic', 'full'];

/** Daily odds. */
const THEFT_PER_DEPOT = 0.0006;
const ACCIDENT_PER_DRIVING_TRUCK = 0.002;
/** Chance a festival day gets a storm, by country (summer). */
const STORM_CHANCE: Record<CountryCode, number> = { GB: 0.22, DE: 0.18, FR: 0.14, US: 0.12, IT: 0.1, ES: 0.07 };

export function insuredValue(state: TycoonState): number {
  const fleet = state.vehicles.filter(v => v.owner === 'player').reduce((sum, v) => sum + getModel(v.modelId).price, 0);
  return replacementValue(ownedStock(state)) + fleet;
}

export const monthlyPremium = (state: TycoonState, level = state.policies.insurance) => Math.round(insuredValue(state) * INSURANCE[level].monthlyRate);

export function monthlyInsurance(s: TycoonState) {
  book(s, 'insurance', -monthlyPremium(s));
}

/** Pays a claim on `loss` per the current policy; returns the note for the news. */
function claim(s: TycoonState, loss: number, weather = false): string {
  const policy = INSURANCE[s.policies.insurance];
  if (!policy.cover || (weather && !policy.weather)) return s.policies.insurance === 'none' ? ' Uninsured.' : ' Not covered.';
  const paid = Math.round(loss * policy.cover);
  book(s, 'insurance', paid);
  return ` Insurance paid ${formatMoney(s, paid)}.`;
}

export function dailyIncidents(s: TycoonState, rng: Rng) {
  // Break-ins.
  s.depots.forEach(d => {
    const ids = Object.keys(d.gear).filter(id => d.gear[id] > 0).sort();
    if (!ids.length || !rng.chance(THEFT_PER_DEPOT)) return;
    const id = rng.pick(ids);
    const units = Math.min(d.gear[id], 1 + rng.nextInt(3));
    d.gear[id] -= units;
    if (!d.gear[id]) delete d.gear[id];
    const p = getProduct(id);
    const loss = p.price * units;
    pushNews(s, `Break-in at your warehouse: ${units}× ${p.brand} ${p.name} stolen (${formatMoney(s, loss)}).${claim(s, loss)}`, 'bad', { cityId: d.cityId });
  });
  // Accidents on the road.
  s.vehicles.forEach(v => {
    if (v.owner !== 'player' || v.status !== 'driving' || !rng.chance(ACCIDENT_PER_DRIVING_TRUCK)) return;
    crash(s, v, rng);
  });
}

function crash(s: TycoonState, v: Vehicle, rng: Rng) {
  const model = getModel(v.modelId);
  v.status = 'broken';
  v.brokenUntil = s.hour + 24 + rng.nextInt(48);
  v.reliability = Math.max(10, v.reliability - 15);
  const repair = Math.round(model.price * 0.08);
  // Some of the load gets knocked about.
  let damage = 0;
  for (const id in v.cargo) {
    const hit = 15 * (v.cargo[id] / Math.max(1, ownedStock(s)[id] ?? 1));
    damage += getProduct(id).price * v.cargo[id] * 0.15;
    s.gearCondition[id] = Math.max(0, condition(s, id) - hit);
  }
  book(s, 'servicing', -repair);
  v.profitThisYear -= repair;
  const loss = repair + Math.round(damage);
  pushNews(s, `${v.name} has been in an accident — off the road for a day or two, ${formatMoney(s, repair)} in repairs${damage ? ', and the load took a knock' : ''}.${claim(s, loss)}`, 'bad', { vehicleId: v.id });
}

export interface Weather {
  /** Show-quality hit. */
  penalty: number;
  /** Extra wear, in show days. */
  extraWear: number;
  note: string;
}

/** Outdoor festival days can get a storm: a worse show, soaked kit, maybe a claim. */
export function rollWeather(s: TycoonState, gig: Gig, rng: Rng): Weather | null {
  if (!gig.festival) return null;
  const days = gig.days ?? 1;
  let storms = 0;
  const odds = STORM_CHANCE[s.country] * (gig.mods?.stormFactor ?? 1);
  for (let d = 0; d < days; d++) if (rng.chance(odds)) storms++;
  if (!storms) return null;
  const penalty = Math.min(0.2, 0.07 * storms);
  const loss = Math.round(gig.fee * 0.12 * storms);
  const note = ` ${storms > 1 ? `${storms} days of storms` : 'A storm'} hit the site.${claim(s, loss, true)}`;
  return { penalty, extraWear: storms, note };
}
