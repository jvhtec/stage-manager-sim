/**
 * Technical riders as hard requirements. A bigger act's rider doesn't just prefer a brand: it says
 * how many inputs the desk must take, which console family the engineer's show file runs on, and
 * which PA systems are approved. Turn up with kit that breaks the rider and it is not merely a
 * worse night — the act's engineer refuses it, the client withholds part of the fee and the
 * relationship suffers. Own the right kit, or cross-hire it from a rental house for the show.
 */
import { createRng } from '@/lib/rng';
import { getProduct, productsAvailableIn, expectedQuality, type GearProduct } from './content/gear';
import { book, formatMoney } from './core';
import { deptTotals } from './loading';
import { consoleInputs } from './content/consoles';
export { consoleInputs };
import type { Gig, GearStock, TechSpec, TycoonState } from './types';

const isDigital = (p: GearProduct) => p.kind === 'console-digital';

/** Fee withheld when the rider is broken, per breach (capped). */
export const BREACH_WITHHOLD = 0.12;
export const MAX_WITHHOLD = 0.3;
/** Quality lost per breach: the engineer is fighting the kit all night. */
export const BREACH_QUALITY = 0.08;
/** A rental house's day rate, as a share of the unit's price. */
export const CROSS_HIRE_RATE = 0.06;

const hash = (s: string) => [...s].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 23);

/** Inputs a show needs: more channels at bigger shows and in later years. */
export function inputsNeeded(tier: number, year: number): number {
  const base = [0, 12, 24, 40, 56][Math.max(0, Math.min(4, tier))];
  const era = year >= 2010 ? 1.6 : year >= 2000 ? 1.3 : 1;
  return Math.round((base * era) / 4) * 4;
}

/** Roll the technical rider for a show (from its own seed, so the offer stream is unchanged). */
export function rollTechSpec(mapSeed: number, gig: Pick<Gig, 'id' | 'tier' | 'needs'>, year: number, real: boolean): TechSpec | undefined {
  if (gig.tier < 2 || !gig.needs.console) return undefined;
  const rng = createRng((mapSeed ^ hash(gig.id)) >>> 0);
  const spec: TechSpec = { inputs: inputsNeeded(gig.tier, year) + (rng.chance(0.3) ? 8 : 0) };
  // Acts with their own engineer bring a show file: the desk has to be the same family.
  const desks = productsAvailableIn(year, 'console').filter(isDigital);
  if (real && gig.tier >= 3 && desks.length && rng.chance(0.55)) {
    const brands = [...new Set(desks.filter(p => p.quality >= expectedQuality(gig.tier, year) - 2).map(p => p.brand))].sort();
    if (brands.length) spec.consoleFamily = rng.pick(brands);
  }
  // Approved PA list.
  if (gig.tier >= 3 && gig.needs.audio && rng.chance(real ? 0.5 : 0.2)) {
    const good = productsAvailableIn(year, 'audio').filter(p => p.quality >= expectedQuality(gig.tier, year) - 1.5);
    const brands = [...new Set(good.map(p => p.brand))].sort();
    if (brands.length >= 2) {
      const n = Math.min(brands.length, 2 + (rng.chance(0.4) ? 1 : 0));
      const picked: string[] = [];
      while (picked.length < n) {
        const b = rng.pick(brands);
        if (!picked.includes(b)) picked.push(b);
      }
      spec.paBrands = picked.sort();
    }
  }
  return spec;
}

export interface Breach {
  id: 'inputs' | 'showfile' | 'pa';
  label: string;
  detail: string;
}

/** Check a pile of kit against the rider. */
export function checkSpec(spec: TechSpec | undefined, kit: GearStock): Breach[] {
  if (!spec) return [];
  const out: Breach[] = [];
  const desks = Object.keys(kit).filter(id => kit[id] > 0).map(getProduct).filter(p => p.dept === 'console');
  const best = desks.reduce((m, p) => Math.max(m, consoleInputs(p)), 0);
  if (best < spec.inputs) {
    const top = desks.sort((a, b) => consoleInputs(b) - consoleInputs(a))[0];
    out.push({ id: 'inputs', label: 'Not enough inputs', detail: top ? `The ${top.brand} ${top.name} takes ${consoleInputs(top)} inputs; the show needs ${spec.inputs}.` : `No desk for a ${spec.inputs}-input show.` });
  }
  if (spec.consoleFamily && !desks.some(p => p.brand === spec.consoleFamily)) {
    out.push({ id: 'showfile', label: 'Wrong console family', detail: `The engineer's show file runs on ${spec.consoleFamily}; there's no ${spec.consoleFamily} desk.` });
  }
  if (spec.paBrands?.length) {
    const audio = deptTotals(kit).audio;
    let approved = 0;
    for (const id in kit) {
      const p = getProduct(id);
      if (p.dept === 'audio' && spec.paBrands.includes(p.brand)) approved += kit[id];
    }
    if (!audio || approved * 2 < audio) out.push({ id: 'pa', label: 'PA not on the approved list', detail: `The rider approves ${spec.paBrands.join(' or ')} only.` });
  }
  return out;
}

/** Products a rental house could send that would fix a breach this year. */
export function crossHireOptions(spec: TechSpec, breach: Breach['id'], year: number): GearProduct[] {
  if (breach === 'pa') return productsAvailableIn(year, 'audio').filter(p => spec.paBrands?.includes(p.brand)).sort((a, b) => a.price - b.price).slice(0, 3);
  return productsAvailableIn(year, 'console')
    .filter(p => consoleInputs(p) >= spec.inputs && (!spec.consoleFamily || p.brand === spec.consoleFamily))
    .sort((a, b) => a.price - b.price)
    .slice(0, 3);
}

export const crossHireCost = (productId: string, units: number, days: number) => Math.round(getProduct(productId).price * CROSS_HIRE_RATE * units * Math.max(1, days));

/** Book kit from a rental house to go straight to the venue for this show. */
export function crossHire(s: TycoonState, gig: Gig, productId: string, units: number): string {
  const cost = crossHireCost(productId, units, gig.days ?? 1);
  gig.crossHire = { ...(gig.crossHire ?? {}), [productId]: (gig.crossHire?.[productId] ?? 0) + units };
  book(s, 'subhire', -cost);
  const p = getProduct(productId);
  return `${units} × ${p.brand} ${p.name} cross-hired for ${gig.act} (${formatMoney(s, cost)}). It goes straight to the venue.`;
}

/** What breaking the rider costs on the night. */
export function breachPenalty(breaches: Breach[]) {
  return {
    quality: Math.min(0.24, breaches.length * BREACH_QUALITY),
    withhold: Math.min(MAX_WITHHOLD, breaches.length * BREACH_WITHHOLD),
  };
}
