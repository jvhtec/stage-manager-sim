/**
 * Every brand is an ecosystem. Kit ages out of support: for the first decade spares are on the
 * shelf; after that the line is legacy and parts take longer; past eighteen years it's end of life
 * and the workshop is cannibalising other units to keep it going. Standardise a department on one
 * brand and the workshop runs cheaper — one set of spares, techs who know the kit — but you are
 * exposed to that brand's bad days: a firmware bug or a bad batch hits every unit you own.
 */
import type { Rng } from '@/lib/rng';
import { getProduct, type GearKind } from './content/gear';
import { pushNews, yearOf } from './core';
import { logIncident } from './consequences';
import type { Dept, GearStock, TycoonState } from './types';
import { DEPTS } from './types';

export type Support = 'current' | 'legacy' | 'eol';
export const LEGACY_YEARS = 10;
export const EOL_YEARS = 18;

export function supportOf(productId: string, year: number): Support {
  const age = year - getProduct(productId).introYear;
  return age >= EOL_YEARS ? 'eol' : age >= LEGACY_YEARS ? 'legacy' : 'current';
}
export const SUPPORT_LABEL: Record<Support, string> = { current: 'Supported', legacy: 'Legacy: spares slow', eol: 'End of life: no spares' };
/** Workshop repair speed and refurbishment price by support status. */
export const REPAIR_SPEED: Record<Support, number> = { current: 1, legacy: 0.7, eol: 0.35 };
export const REFURB_PRICE: Record<Support, number> = { current: 1, legacy: 1.25, eol: 1.8 };

/** Share of each department's units in its single biggest brand. */
export function brandShares(stock: GearStock): Record<Dept, { brand?: string; share: number; units: number }> {
  const out = {} as Record<Dept, { brand?: string; share: number; units: number }>;
  DEPTS.forEach(d => {
    const by = new Map<string, number>();
    let units = 0;
    for (const id in stock) {
      const p = getProduct(id);
      if (p.dept !== d || !stock[id]) continue;
      units += stock[id];
      by.set(p.brand, (by.get(p.brand) ?? 0) + stock[id]);
    }
    const top = [...by.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    out[d] = { brand: top?.[0], share: top && units ? top[1] / units : 0, units };
  });
  return out;
}

/** Workshop cost factor: up to 25% off for a department standardised on one brand. */
export function standardisationFactor(stock: GearStock): number {
  const shares = brandShares(stock);
  let units = 0;
  let saved = 0;
  DEPTS.forEach(d => {
    const { share, units: u } = shares[d];
    units += u;
    saved += u * 0.25 * Math.max(0, (share - 0.5) / 0.5);
  });
  return units ? 1 - saved / units : 1;
}

/** Kinds that run firmware or come off a production batch that can go bad. */
const FRAGILE: GearKind[] = ['console-digital', 'moving-spot', 'moving-wash', 'beam', 'led-wall', 'media-server', 'line-array', 'automation'];
/** Monthly chance a brand you depend on has a bad day. */
export const BRAND_FAULT_CHANCE = 0.012;
export const BRAND_FAULT_DAMAGE = 25;

const FAULTS = [
  (brand: string, name: string) => `A firmware update has bricked ${brand} ${name} units worldwide: every one you own needs reflashing and recalibrating.`,
  (brand: string, name: string) => `${brand} has found a bad batch of components in the ${name}: every unit needs its boards swapped.`,
  (brand: string, name: string) => `${brand} has issued a safety recall on the ${name}: every unit has to be stripped and checked.`,
];

/** Monthly: a brand you rely on has a bad day, and every unit of it you own takes the hit. */
export function monthlyBrandFaults(s: TycoonState, stock: GearStock, rng: Rng) {
  const byBrand = new Map<string, string[]>();
  for (const id in stock) {
    const p = getProduct(id);
    if (!stock[id] || !FRAGILE.includes(p.kind)) continue;
    byBrand.set(p.brand, [...(byBrand.get(p.brand) ?? []), id]);
  }
  const year = yearOf(s, s.hour);
  [...byBrand.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([brand, ids]) => {
    const units = ids.reduce((n, id) => n + stock[id], 0);
    if (units < 4 || !rng.chance(BRAND_FAULT_CHANCE)) return;
    // The newest line is the one with the bug.
    const id = ids.sort((a, b) => getProduct(b).introYear - getProduct(a).introYear)[0];
    const p = getProduct(id);
    if (year - p.introYear > LEGACY_YEARS) return;
    s.gearCondition[id] = Math.max(0, (s.gearCondition[id] ?? 100) - BRAND_FAULT_DAMAGE);
    const text = rng.pick(FAULTS)(brand, p.name);
    const shares = brandShares(stock);
    const dept = shares[p.dept];
    const exposure = dept.brand === brand && dept.share >= 0.7 ? ` Your whole ${p.dept} department runs on ${brand}.` : '';
    logIncident(s, {
      kind: 'show',
      title: `${brand} ${p.name}: fleet-wide fault`,
      causes: [
        { id: 'brand-fault', label: 'A manufacturer problem', detail: text, weight: 0.6 },
        ...(exposure ? [{ id: 'standardised', label: 'All eggs in one basket', detail: `${Math.round(dept.share * 100)}% of your ${p.dept} kit is ${brand}.`, weight: 0.5 }] : []),
      ],
      outcome: `${stock[id]} unit${stock[id] > 1 ? 's' : ''} lost ${BRAND_FAULT_DAMAGE}% condition.`,
    });
    pushNews(s, `${text}${exposure} Condition down ${BRAND_FAULT_DAMAGE}% — the workshop will be busy.`, 'bad');
  });
}

export const supportNote = (s: TycoonState, productId: string) => {
  const sup = supportOf(productId, yearOf(s, s.hour));
  return sup === 'current' ? '' : `${SUPPORT_LABEL[sup]} — repairs at ${Math.round(REPAIR_SPEED[sup] * 100)}% speed, refurbishing ×${REFURB_PRICE[sup]}`;
};
