/**
 * Gear wears out. Every product line you own has a condition (0-100, the
 * average across its units): shows wear it down — festivals and tours most —
 * and worn kit sounds and looks worse, sells for less, and is likelier to die
 * mid-set. Keep a workshop running (a monthly cost) to repair it as you go,
 * or pay to refurbish a line all at once.
 */
import type { Rng } from '@/lib/rng';
import { GEAR_RESALE_RATE } from './catalog';
import { book } from './core';
import { getProduct } from './content/gear';
import { addStock, stockSize } from './loading';
export { conditionFactor } from './loading';
import type { GearStock, TycoonState, WorkshopLevel } from './types';

export interface WorkshopInfo {
  label: string;
  /** Monthly cost as a share of the replacement value of everything you own. */
  monthlyRate: number;
  /** Condition points restored per day, up to `cap`. */
  repairPerDay: number;
  cap: number;
  blurb: string;
}

export const WORKSHOP: Record<WorkshopLevel, WorkshopInfo> = {
  none: { label: 'None', monthlyRate: 0, repairPerDay: 0, cap: 0, blurb: 'No running cost. Gear only gets fixed when you pay to refurbish it.' },
  basic: { label: 'Basic', monthlyRate: 0.006, repairPerDay: 0.15, cap: 80, blurb: 'A tech and a bench: keeps kit serviceable, never like new.' },
  full: { label: 'Full workshop', monthlyRate: 0.015, repairPerDay: 0.4, cap: 100, blurb: 'Dedicated techs: kit goes out in as-new condition.' },
};
export const WORKSHOP_LEVELS: WorkshopLevel[] = ['none', 'basic', 'full'];

/** Condition lost per unit per show day. */
const WEAR_PER_DAY = 3;
const OVERSEAS_WEAR = 1.6;
/** Refurbishing costs this share of a unit's price per 100 condition points restored. */
const REFURB_RATE = 0.3;

export const condition = (state: TycoonState, productId: string) => state.gearCondition[productId] ?? 100;

/** Every unit you own, wherever it is. */
export function ownedStock(state: TycoonState): GearStock {
  const all: GearStock = {};
  state.depots.forEach(d => addStock(all, d.gear));
  state.vehicles.filter(v => v.owner === 'player').forEach(v => addStock(all, v.cargo));
  return all;
}

/** New units arrive in perfect condition and lift the line's average. */
export function onBought(s: TycoonState, productId: string, qty: number) {
  const owned = ownedStock(s)[productId] ?? 0; // already includes the new units
  const before = owned - qty;
  s.gearCondition[productId] = before > 0 ? (condition(s, productId) * before + 100 * qty) / owned : 100;
}

export function wearFromShow(s: TycoonState, delivered: GearStock, days: number, overseas: boolean) {
  const owned = ownedStock(s);
  for (const id in delivered) {
    const share = delivered[id] / Math.max(1, owned[id] ?? delivered[id]);
    const wear = WEAR_PER_DAY * days * (overseas ? OVERSEAS_WEAR : 1) * share;
    s.gearCondition[id] = Math.max(0, condition(s, id) - wear);
  }
}

export function dailyWorkshop(s: TycoonState) {
  const w = WORKSHOP[s.policies.workshop];
  if (!w.repairPerDay) return;
  for (const id in s.gearCondition) {
    const c = s.gearCondition[id];
    if (c < w.cap) s.gearCondition[id] = Math.min(w.cap, c + w.repairPerDay);
  }
}

export function replacementValue(stock: GearStock): number {
  let total = 0;
  for (const id in stock) total += getProduct(id).price * stock[id];
  return total;
}

export const monthlyWorkshopCost = (state: TycoonState, level = state.policies.workshop) =>
  Math.round(replacementValue(ownedStock(state)) * WORKSHOP[level].monthlyRate);

export function monthlyWorkshop(s: TycoonState) {
  book(s, 'workshop', -monthlyWorkshopCost(s));
}

export function refurbishCost(state: TycoonState, productId: string): number {
  const units = ownedStock(state)[productId] ?? 0;
  return Math.round(getProduct(productId).price * units * REFURB_RATE * ((100 - condition(state, productId)) / 100));
}

/** Resale value of one unit, which falls with condition. */
export const resaleValue = (state: TycoonState, productId: string) =>
  Math.round(getProduct(productId).price * GEAR_RESALE_RATE * (0.5 + 0.5 * (condition(state, productId) / 100)));

/** Average condition of a pile of kit, weighted by units. */
export function averageCondition(state: TycoonState, stock: GearStock): number {
  const n = stockSize(stock);
  if (!n) return 100;
  let sum = 0;
  for (const id in stock) sum += condition(state, id) * stock[id];
  return sum / n;
}

/** Chance something packs up mid-show, from the condition of what's on stage. */
export const failureChance = (avgCondition: number) => (avgCondition >= 75 ? 0.01 : 0.01 + ((75 - avgCondition) / 75) * 0.45);

export interface Failure {
  productId: string;
  units: number;
}

/** Rolls for a breakdown on the night; on a failure, removes the dead units from `delivered`. */
export function rollFailure(state: TycoonState, delivered: GearStock, rng: Rng): Failure | null {
  if (!stockSize(delivered) || !rng.chance(failureChance(averageCondition(state, delivered)))) return null;
  // The worst-kept kit is likeliest to go.
  const ids = Object.keys(delivered).filter(id => delivered[id] > 0).sort();
  const weights = ids.map(id => (101 - condition(state, id)) * delivered[id]);
  let roll = rng.next() * weights.reduce((a, b) => a + b, 0);
  let pick = ids[0];
  for (let i = 0; i < ids.length; i++) {
    roll -= weights[i];
    if (roll <= 0) {
      pick = ids[i];
      break;
    }
  }
  const units = Math.max(1, Math.ceil(delivered[pick] * 0.4));
  delivered[pick] -= units;
  if (!delivered[pick]) delete delivered[pick];
  return { productId: pick, units };
}
