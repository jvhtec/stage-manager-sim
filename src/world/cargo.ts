/**
 * Kit is physical. Every unit weighs something and takes man-hours to push off a truck, into a
 * room and up into the air; every truck has a payload. A rig can fit a fleet on paper and still be
 * too heavy for it, or take too long to get in: the load-in has to be done six hours after the
 * doors open for the crew, or the soundcheck — and then the show — starts late. A dock helps,
 * the street is slower, stairs are slower still. More hands (your crew, freelancers, local loaders)
 * make it quicker; a lighter rig makes it easier.
 */
import { getProduct, type GearKind } from './content/gear';
import type { GearStock } from './types';

const PHYS: Record<GearKind, { t: number; mh: number }> = {
  'point-source': { t: 0.6, mh: 1.2 },
  'line-array': { t: 0.8, mh: 1.7 },
  'console-analog': { t: 0.2, mh: 0.7 },
  'console-digital': { t: 0.15, mh: 0.6 },
  par: { t: 0.35, mh: 1.1 },
  'moving-spot': { t: 0.45, mh: 1.2 },
  'moving-wash': { t: 0.4, mh: 1.2 },
  beam: { t: 0.35, mh: 1.1 },
  scanner: { t: 0.35, mh: 1.1 },
  desk: { t: 0.1, mh: 0.5 },
  jumbotron: { t: 3, mh: 3.6 },
  projector: { t: 0.2, mh: 1 },
  'led-wall': { t: 1, mh: 1.9 },
  'media-server': { t: 0.1, mh: 0.6 },
  deck: { t: 0.6, mh: 1.4 },
  truss: { t: 0.5, mh: 1.4 },
  motor: { t: 0.4, mh: 0.7 },
  automation: { t: 0.9, mh: 2.2 },
  set: { t: 0.8, mh: 2.4 },
};

/** Payload in tonnes, by vehicle model. */
const PAYLOAD: Record<string, number> = {
  'splitter-van': 1.6,
  'euro-van': 2,
  'luton-box': 3.2,
  'bedford-tk': 5.5,
  'rigid-7t': 7,
  'artic-40': 20,
  megaliner: 24,
  'duple-coach': 1.5,
  'setra-sleeper': 1.5,
  'sleeper-bus': 1.5,
};
export const payloadOf = (modelId: string, gearCapacity = 10) => PAYLOAD[modelId] ?? Math.round(gearCapacity * 0.6 * 10) / 10;

export const unitWeight = (productId: string) => (PHYS[getProduct(productId).kind] ?? { t: 0.5 }).t;
export function loadWeight(stock: GearStock): number {
  let t = 0;
  for (const id in stock) t += unitWeight(id) * stock[id];
  return Math.round(t * 10) / 10;
}

/** Hours from the doors opening for the crew until the rig must be in, for the soundcheck. */
export const HANDLING_WINDOW = 6;
const ACCESS: Record<'dock' | 'street' | 'stairs', number> = { dock: 1, street: 1.25, stairs: 1.6 };
/** Local loaders you can book for a load-in. */
export const LOADERS = 6;
/** A local loader's half-day rate (half a freelancer's day). */
export const LOADER_RATE = 70;
export const loadersCost = (days = 1) => Math.round(LOADERS * LOADER_RATE * Math.min(3, days));

/** Hours to get this kit in with this many hands. */
export function handlingHours(kit: GearStock, hands: number, access: 'dock' | 'street' | 'stairs' = 'dock'): number {
  let mh = 0;
  for (const id in kit) mh += (PHYS[getProduct(id).kind] ?? { mh: 1.2 }).mh * kit[id];
  return Math.round(((mh * ACCESS[access]) / Math.max(2, hands)) * 10) / 10;
}

/** How long past the window the load-in runs. */
export const handlingOverrun = (hours: number) => Math.max(0, Math.round((hours - HANDLING_WINDOW) * 10) / 10);
