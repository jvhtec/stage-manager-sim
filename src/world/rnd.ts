/**
 * R&D: build your own kit, like Clair, Showco or Meyer did. Fund a project in
 * a department — the bolder it is, the longer it takes, the more it costs and
 * the likelier it fails — and on success your own product joins the gear
 * shop: better than anything on the market that year, and cheap for you to
 * build. The industry buys it too, paying you royalties until it ages.
 */
import { tierInfo } from './catalog';
import { book, dateOfDay, dayOf, formatMoney, newId, pushNews, yearOf } from './core';
import { getProduct, ownProductId, productsAvailableIn, type GearProduct } from './content/gear';
import type { Rng } from '@/lib/rng';
import type { Dept, RndAmbition, TycoonState } from './types';

export interface AmbitionInfo {
  label: string;
  /** Quality over the best product on the market. */
  lift: number;
  months: number;
  /** Cost as a multiple of the market flagship's price × 40 units. */
  costFactor: number;
  risk: number;
  blurb: string;
}

export const AMBITIONS: Record<RndAmbition, AmbitionInfo> = {
  refine: { label: 'Refinement', lift: 0.3, months: 9, costFactor: 0.6, risk: 0.05, blurb: 'Take the best on the market and make it yours.' },
  flagship: { label: 'New flagship', lift: 0.8, months: 15, costFactor: 1.4, risk: 0.15, blurb: 'A product the industry will want on its riders.' },
  breakthrough: { label: 'Breakthrough', lift: 1.5, months: 24, costFactor: 3, risk: 0.35, blurb: 'Ahead of its time — if it works.' },
};
export const AMBITION_IDS: RndAmbition[] = ['refine', 'flagship', 'breakthrough'];

/** R&D needs a real base with engineers in it, and some standing. */
export const RND_REPUTATION = tierInfo(2).minReputation + 15;
const MIN_ENGINEERS = 2;
/** You build your own kit at this share of what the market would charge. */
const OWN_BUILD_COST = 0.6;
/** Royalties per month, as a share of the product's market price, at full standing and when new. */
const ROYALTY_RATE = 2;
const ROYALTY_LIFE_YEARS = 8;

const SERIES = ['S', 'X', 'Pro', 'V', 'R', 'One', 'Prime', 'Tour'];

export function marketBest(dept: Dept, year: number): GearProduct | undefined {
  return [...productsAvailableIn(year, dept)].sort((a, b) => b.quality - a.quality || b.introYear - a.introYear)[0];
}

export function projectCost(dept: Dept, ambition: RndAmbition, year: number): number {
  const best = marketBest(dept, year);
  return Math.round(((best?.price ?? 3000) * 40 * AMBITIONS[ambition].costFactor) / 1000) * 1000;
}

export function rndBlocker(state: TycoonState, dept: Dept): string | null {
  if (state.company.reputation < RND_REPUTATION) return `R&D needs reputation ${RND_REPUTATION}+ — nobody takes a newcomer's prototype seriously.`;
  if (!state.depots.some(d => d.kind === 'warehouse' && d.staff.warehouse >= MIN_ENGINEERS))
    return `R&D needs a warehouse with at least ${MIN_ENGINEERS} warehouse & prep staff to build prototypes.`;
  if (state.projects.some(p => p.dept === dept && p.status === 'running')) return 'You already have a project running in that department.';
  if (!marketBest(dept, yearOf(state, state.hour))) return 'Nobody makes that kind of kit yet.';
  return null;
}

/** Monthly: pay the engineers, advance projects, finish them (or not); collect royalties. */
export function monthlyRnd(s: TycoonState, rng: Rng) {
  const year = yearOf(s, s.hour);
  s.projects.forEach(p => {
    if (p.status !== 'running') return;
    const info = AMBITIONS[p.ambition];
    const instalment = Math.round(p.budget / info.months);
    book(s, 'rnd', -instalment);
    p.monthsDone += 1;
    if (p.monthsDone < info.months) return;
    if (rng.chance(info.risk)) {
      p.status = 'failed';
      pushNews(s, `R&D: the ${p.dept} prototype didn't work out. The engineers learned a lot; the accountants less so.`, 'bad');
      return;
    }
    const best = marketBest(p.dept, year);
    if (!best) return;
    const quality = Math.min(10.5, Math.round((best.quality + info.lift) * 10) / 10);
    const name = `${p.series}-${String(year).slice(2)}`;
    const product: Omit<GearProduct, 'id'> = {
      brand: s.company.name,
      name,
      dept: p.dept,
      kind: best.kind,
      introYear: year,
      price: Math.round((best.price * OWN_BUILD_COST * (1 + info.lift / 4)) / 50) * 50,
      quality,
    };
    const id = ownProductId(product);
    p.status = 'done';
    p.productId = id;
    s.ownProducts.push(id);
    s.company.reputation = Math.min(100, s.company.reputation + 2 + info.lift * 2);
    pushNews(s, `R&D: the ${s.company.name} ${name} is born — quality ${quality}, ahead of anything on the market. It's in your gear shop, and the industry wants it.`, 'big');
  });
  // Royalties from the industry buying your designs.
  let royalties = 0;
  s.ownProducts.forEach(id => {
    const p = getProduct(id);
    const age = year - p.introYear;
    const fresh = Math.max(0, 1 - age / ROYALTY_LIFE_YEARS);
    royalties += (p.price / OWN_BUILD_COST) * ROYALTY_RATE * (s.company.reputation / 100) * fresh;
  });
  if (royalties > 0) book(s, 'royalties', Math.round(royalties));
}

export function royaltiesPerMonth(state: TycoonState, id: string): number {
  const p = getProduct(id);
  const fresh = Math.max(0, 1 - (yearOf(state, state.hour) - p.introYear) / ROYALTY_LIFE_YEARS);
  return Math.round((p.price / OWN_BUILD_COST) * ROYALTY_RATE * (state.company.reputation / 100) * fresh);
}

/** Mutating helper for the action: starts a project. */
export function startProject(s: TycoonState, dept: Dept, ambition: RndAmbition) {
  const year = yearOf(s, s.hour);
  s.projects.push({
    id: newId(s, 'rnd'),
    dept,
    ambition,
    budget: projectCost(dept, ambition, year),
    monthsDone: 0,
    startedDay: dayOf(s.hour),
    status: 'running',
    series: SERIES[s.projects.length % SERIES.length],
  });
}

export function projectEta(state: TycoonState, months: number, startedDay: number): string {
  const d = dateOfDay(state, startedDay + months * 30);
  return `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export const describeCost = (state: TycoonState, n: number) => formatMoney(state, n);
