/**
 * The balance bot: a scripted company that plays the game through the same actions as a player,
 * following a named strategy. Deterministic for a given (country, year, seed, strategy), so runs
 * can be compared. `runBot` returns a report that explains the result, not just the final cash.
 */
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import {
  assignVehicle,
  assignVehicleToTour,
  bookGig,
  bookTour,
  borrow,
  buildAnnex,
  buyGear,
  buyVehicle,
  crossHireKit,
  fixProduction,
  haggleGig,
  hireCrew,
  makeDecision,
  negotiateTerms,
  orderTourMerch,
  rehearseShow,
  repay,
  setCrewPicks,
  setManager,
  setPolicy,
  trainCrew,
  upgradeDepot,
} from '../actions';
import { gigBookingBar, tourBookingBar } from '../standing';
import { dayOf, yearOf } from '../core';
import { worldOf } from '../mapgen';
import { roadDistance } from '../pathfinding';
import { companyValue, projectCoverage } from '../queries';
import { deptTotals } from '../loading';
import { expectedQuality, productsAvailableIn } from '../content/gear';
import { VEHICLE_MODELS, getModel } from '../catalog';
import { tourMaxTier } from '../tours';
import { nextUpgrade } from '../facilities';
import { crossHireCost, crossHireOptions } from '../techRider';
import { forecastCash } from '../cashflow';
import { brandShares } from '../ecosystem';
import { ownedStock } from '../wear';
import { relationOf, rapport } from '../bonds';
import { checkInvariants } from '../invariants';
import { MANAGERS } from '../management';
import { DEPTS, type LedgerCategory, type TycoonState } from '../types';
import type { CountryCode } from '../content/countries';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any;
const ok = (s: S, out: { state: S; result: { ok: boolean } }): S => (out.result.ok ? out.state : s);

export type Feature =
  | 'gear' // buy the kit the shows it books need
  | 'invest' // trucks, crew, depot upgrades
  | 'tours'
  | 'merch'
  | 'annex' // rehearsal stage
  | 'train' // tickets
  | 'invoice' // factor invoices when cash is thin
  | 'sponsor'
  | 'riders' // cross-hire to meet riders, book room fixes
  | 'terms' // push for deposits and cancellation clauses
  | 'crew' // keep feuding crew apart
  | 'heads' // hire department heads
  | 'cash' // act on the cash forecast
  | 'standardise' // buy one brand per department
  | 'haggle'
  | 'learn'; // read its own post-mortems and fix the biggest recurring cause

export interface Strategy {
  id: string;
  label: string;
  blurb: string;
  features: Feature[];
  /** Share of a fee it'll spend meeting a rider or fixing a room. */
  fixLimit: number;
  /** Skip club-level-and-up shows paying less than this. */
  minFee: number;
  policies: Partial<Record<'workshop' | 'pay' | 'insurance' | 'training' | 'rest', string>>;
}

const CORE: Feature[] = ['gear', 'invest', 'tours', 'merch', 'annex', 'train', 'invoice', 'sponsor', 'haggle'];

export const STRATEGIES: Record<string, Strategy> = {
  baseline: {
    id: 'baseline',
    label: 'Baseline operator',
    blurb: 'Books what it can reach, buys the kit and trucks it needs, meets riders and fixes rooms. Never negotiates terms, ignores crew politics and the cash forecast.',
    features: [...CORE, 'riders'],
    fixLimit: 0.2,
    minFee: 800,
    policies: { insurance: 'basic', training: 'courses' },
  },
  managed: {
    id: 'managed',
    label: 'Managed company',
    blurb: 'The baseline, run properly: pushes for deposits and cancellation clauses on big shows (or any show when cash is at risk), keeps feuding crew apart, hires department heads as it grows, acts on the cash forecast, and reads its own post-mortems to fix what keeps going wrong.',
    features: [...CORE, 'riders', 'terms', 'crew', 'heads', 'cash', 'learn'],
    fixLimit: 0.2,
    minFee: 800,
    policies: { insurance: 'basic', training: 'courses' },
  },
  premium: {
    id: 'premium',
    label: 'Premium house',
    blurb: 'Managed, plus a full workshop, top pay, one brand per department, and only shows worth having.',
    features: [...CORE, 'riders', 'terms', 'crew', 'heads', 'cash', 'standardise', 'learn'],
    fixLimit: 0.3,
    minFee: 2500,
    policies: { insurance: 'full', training: 'courses', workshop: 'full', pay: 'high' },
  },
  lean: {
    id: 'lean',
    label: 'Lean operator',
    blurb: 'Keeps overheads down: low pay, no workshop, no insurance, no training, no heads. Still meets riders and watches the cash.',
    features: ['gear', 'invest', 'tours', 'invoice', 'riders', 'cash', 'haggle'],
    fixLimit: 0.15,
    minFee: 500,
    policies: { insurance: 'none', training: 'none', workshop: 'none', pay: 'low' },
  },
  reckless: {
    id: 'reckless',
    label: 'Corner-cutter',
    blurb: 'Takes everything, never cross-hires or fixes a room, no workshop or insurance, never looks at the forecast.',
    features: ['gear', 'invest', 'tours', 'haggle'],
    fixLimit: 0,
    minFee: 0,
    policies: { insurance: 'none', training: 'none', workshop: 'none', pay: 'low', rest: 'off' },
  },
};

export interface BotRun {
  country: CountryCode;
  startYear: number;
  years: number;
  seed: number;
  strategy: Strategy;
}

export interface BotReport {
  country: string;
  startYear: number;
  seed: number;
  strategy: string;
  survived: boolean;
  gameOver?: string;
  yearsRun: number;
  value: number;
  cash: number;
  loan: number;
  reputation: number;
  shows: number;
  failed: number;
  avgQuality: number;
  /** Totals over the whole run, by ledger category. */
  ledger: Partial<Record<LedgerCategory, number>>;
  revenue: number;
  costs: number;
  /** Shows per vehicle-year. */
  utilisation: number;
  fleet: number;
  crew: number;
  crewLost: number;
  burnout: number;
  trusted: number;
  feuds: number;
  /** Incidents by kind and by cause, over the whole run. */
  incidents: { kinds: Record<string, number>; causes: Record<string, number>; main: Record<string, number> };
  bans: number;
  monthsOverdrawn: number;
  lowestCash: number;
  forecastWarnings: number;
  bot: { termsAsked: number; termsWon: number; crossHires: number; fixes: number; crewSplits: number; heads: string[]; lessons: string[]; borrowed: number; factoredMonths: number; frozenMonths: number };
  rivals: { alive: number; gone: number; shows: number; failed: number; avgQuality: number; crossHires: number; fixes: number; declined: Record<string, number>; cashNegative: number };
  invariantViolations: string[];
}

function ensureGear(s: S, gig: S, depotId: string, strategy: Strategy): S {
  const depot = s.depots.find((d: S) => d.id === depotId);
  if (!depot) return s;
  const have = deptTotals(depot.gear);
  const year = yearOf(s, s.hour);
  const shares = strategy.features.includes('standardise') ? brandShares(ownedStock(s)) : undefined;
  for (const d of DEPTS) {
    let missing = gig.needs[d] - have[d];
    while (missing > 0) {
      const options = productsAvailableIn(year, d).filter((p: S) => p.price <= s.company.cash * 0.25);
      if (!options.length) break;
      const target = expectedQuality(gig.tier, year);
      const brand = shares?.[d].brand;
      options.sort(
        (a, b) =>
          (brand ? Number(b.brand === brand) - Number(a.brand === brand) : 0) ||
          Math.abs(a.quality - target) - Math.abs(b.quality - target) ||
          a.price - b.price,
      );
      const out = buyGear(s, depotId, options[0].id);
      if (!out.result.ok) break;
      s = out.state;
      missing -= 1;
    }
  }
  return s;
}

export function runBot(run: BotRun): BotReport {
  const { country, startYear, years, seed, strategy } = run;
  const on = (f: Feature) => strategy.features.includes(f);
  let s: S = createTycoonGame({ companyName: 'Bot', color: '#f00', seed, country, startYear });
  const world = worldOf(s);
  for (const [k, v] of Object.entries(strategy.policies)) s = ok(s, setPolicy(s, k as S, v as S));
  s = ok(s, setPolicy(s, 'rehearsal', 'auto'));
  const bot = { termsAsked: 0, termsWon: 0, crossHires: 0, fixes: 0, crewSplits: 0, heads: [] as string[], lessons: [] as string[], borrowed: 0, factoredMonths: 0, frozenMonths: 0 };
  const violations: string[] = [];
  let monthsOverdrawn = 0;
  let lowestCash = Infinity;
  let forecastWarnings = 0;
  let frozenUntil = -1;
  let learned = { kit: 0, shows: 0 };

  for (let day = 0; day < 365 * years && !s.gameOver; day++) {
    s = advanceHours(s, 24);
    const today = dayOf(s.hour);
    lowestCash = Math.min(lowestCash, s.company.cash);
    if (day % 30 === 0) checkInvariants(s).forEach(v => violations.length < 200 && violations.push(`${v.kind}: ${v.message}`));

    // Decisions: the defaults, except where there's a clearly better answer.
    for (const d of [...s.dilemmas]) {
      const pick = (id: string) => d.options.find((o: { id: string; cost?: number }) => o.id === id && (!o.cost || o.cost < s.company.cash * 0.15));
      let choice = d.defaultOption;
      const prefer: Record<string, string[]> = { breakdown: ['recovery'], sponsor: on('sponsor') ? ['sign'] : ['decline'], charity: ['half'], dispute: ['argue', 'settle'], audit: ['fix'], dirty: ['security'], shareholders: ['appease'], venue: ['refurb'], ownfest: ['cover'], pricewar: ['ride'] };
      for (const id of prefer[d.kind] ?? []) if (pick(id)) { choice = id; break; }
      s = ok(s, makeDecision(s, d.id, choice));
    }

    const frozen = today < frozenUntil;
    const maxDist = 25 + Math.min(50, s.company.reputation);
    // Single shows.
    for (const g0 of s.gigs.filter((g: S) => g.status === 'offer' && !g.tourId)) {
      let g = g0;
      if (gigBookingBar(s, g).reason) continue;
      if (roadDistance(world, s.company.hqCityId, g.cityId) > maxDist || g.day - today < 4) continue;
      const v = s.vehicles.find((x: S) => x.owner === 'player' && x.orders.length === 0 && x.status !== 'broken' && getModel(x.modelId).kind !== 'bus');
      if (!v) continue;
      if (g.fee < strategy.minFee && g.tier > 1) continue;
      const home = s.depots.find((d: S) => d.cityId === v.homeCityId);
      if (!home) continue;
      // Terms first: a deposit and a clause on anything worth having.
      // Pushing for terms can lose the show: worth it on big fees, or on anything when cash is at risk.
      if (on('terms') && g.terms && !g.termsAsked && (g.fee >= 15000 || (frozen && g.fee >= 3000)) && (g.terms.deposit < 0.3 || g.terms.cancel < 0.75)) {
        bot.termsAsked++;
        const t = negotiateTerms(s, g.id);
        s = t.state;
        if (t.result.ok) bot.termsWon++;
        g = s.gigs.find((x: S) => x.id === g0.id);
        if (!g || g.status !== 'offer') continue;
      }
      if (on('gear') && !frozen) s = ensureGear(s, g, home.id, strategy);
      const b = bookGig(s, g.id);
      if (!b.result.ok) continue;
      const a = assignVehicle(b.state, v.id, g.id);
      if (!a.result.ok) continue;
      s = a.state;
      if (on('haggle') && g.tier >= 2) s = ok(s, haggleGig(s, g.id));
    }
    // National tours.
    if (on('tours')) {
      for (const t of s.tours.filter((x: S) => x.status === 'offer' && x.kind === 'national')) {
        if (tourBookingBar(s, t, tourMaxTier(s, t)).reason) continue;
        const v = s.vehicles.find((x: S) => x.owner === 'player' && x.orders.length === 0 && getModel(x.modelId).kind !== 'bus');
        if (!v) continue;
        const first = Math.min(...t.gigIds.map((id: string) => s.gigs.find((g: S) => g.id === id)?.day ?? 1e9));
        if (first - today < 5) continue;
        const b = bookTour(s, t.id);
        if (!b.result.ok) continue;
        const a = assignVehicleToTour(b.state, v.id, t.id);
        if (a.result.ok) {
          s = a.state;
          if (on('merch')) s = ok(s, orderTourMerch(s, t.id, 'small'));
        } else s = b.state;
      }
    }

    // Advancing the next few days' shows: riders, rooms, crew.
    for (const g of s.gigs.filter((x: S) => x.status === 'booked' && x.day - today >= 1 && x.day - today <= 5)) {
      const proj = projectCoverage(s, g);
      if (on('riders') && strategy.fixLimit > 0 && !s.managers?.production) {
        for (const b of proj.breaches) {
          const opt = crossHireOptions(g.techSpec, b.id, yearOf(s, g.day * 24))[0];
          const units = b.id === 'pa' ? Math.max(1, g.needs.audio) : 1;
          if (opt && crossHireCost(opt.id, units, g.days ?? 1) < g.fee * strategy.fixLimit) {
            const before = s;
            s = ok(s, crossHireKit(s, g.id, opt.id, units));
            if (s !== before) bot.crossHires++;
          }
        }
        for (const pr of proj.production)
          if (pr.fixCost < g.fee * strategy.fixLimit) {
            const before = s;
            s = ok(s, fixProduction(s, g.id, pr.id));
            if (s !== before) bot.fixes++;
          }
      }
      // Keep people who are at loggerheads off the same crew (a crew chief does it for you).
      if (on('crew') && !s.managers?.crew && proj.people.length > 1 && !g.crewPicks) {
        const clash = proj.people.find((m: S) => proj.people.some((o: S) => o.id !== m.id && ['feud', 'refuse'].includes(relationOf(rapport(s, m.id, o.id)) ?? '')));
        if (clash) {
          const keep = proj.people.filter((m: S) => m.id !== clash.id).map((m: S) => m.id);
          const before = s;
          s = ok(s, setCrewPicks(s, g.id, keep));
          if (s !== before) bot.crewSplits++;
        }
      }
    }
    for (const g of s.gigs.filter((x: S) => x.status === 'booked' && !x.rehearsed && x.day - today >= 2 && x.day - today <= 14)) s = ok(s, rehearseShow(s, g.id));

    // Weekly: the cash forecast.
    if (on('cash') && day % 7 === 3) {
      const f = forecastCash(s, world);
      if (f.riskWeek !== undefined) {
        forecastWarnings++;
        frozenUntil = today + 30;
        s = ok(s, setPolicy(s, 'invoicing', 'factor'));
        if (f.lowest.expected < 0) {
          const before = s.company.loan;
          s = ok(s, borrow(s));
          if (s.company.loan > before) bot.borrowed += s.company.loan - before;
        }
      } else if (s.company.loan > 0 && f.lowest.low > s.company.loan * 2) {
        s = ok(s, repay(s));
      }
    }

    // Monthly management.
    if (day % 30 === 15) {
      if (s.company.cash < 0) monthsOverdrawn++;
      if (frozen) bot.frozenMonths++;
      if (s.policies.invoicing === 'factor') bot.factoredMonths++;
      const depot = s.depots[0];
      const rep = s.company.reputation;
      const mine = s.vehicles.filter((x: S) => x.owner === 'player');
      if (on('invest') && !frozen) {
        const busy = mine.filter((x: S) => x.orders.length > 0).length;
        const year = yearOf(s, s.hour);
        const model = VEHICLE_MODELS.filter(m => m.introYear <= year && m.kind !== 'bus' && m.kind !== 'semi').sort((a, b) => b.gearCapacity - a.gearCapacity)[0];
        if (model && busy >= mine.length && s.company.cash > model.price * 3 && mine.length < 12) s = ok(s, buyVehicle(s, depot.id, model.id));
        if (s.people.length < mine.length * 2 && s.company.cash > 20000) s = ok(s, hireCrew(s, depot.id, 2));
        const next = nextUpgrade(depot);
        if (next && s.company.cash > next.cost * 2.5 && rep >= next.spec.minReputation) s = ok(s, upgradeDepot(s, depot.id));
      }
      if (on('annex') && !frozen && depot.kind === 'warehouse' && s.company.cash > 150000 && rep >= 40) s = ok(s, buildAnnex(s, depot.id, 'rehearsal'));
      if (on('train') && !frozen) {
        for (const cert of ['rigging', 'safety'] as const) {
          const m = s.people.find((p: S) => p.depotId && !p.certs?.includes(cert) && !p.course);
          if (m && rep >= 40 && s.company.cash > 30000) s = ok(s, trainCrew(s, m.id, cert));
        }
      }
      // Read the month's post-mortems: if kit dying on stage keeps coming up, buy a better workshop.
      if (on('learn')) {
        const main = s.incidentTally?.main ?? {};
        const kitNow = (main['kit-failed'] ?? 0) + (main['kit-worn'] ?? 0);
        const showsNow = s.stats.showsPlayed;
        const kitRate = (kitNow - learned.kit) / Math.max(1, showsNow - learned.shows);
        learned = { kit: kitNow, shows: showsNow };
        if (kitRate > 0.08 && s.policies.workshop !== 'full' && !frozen) {
          s = ok(s, setPolicy(s, 'workshop', s.policies.workshop === 'none' ? 'basic' : 'full'));
          bot.lessons.push(`workshop→${s.policies.workshop}@${yearOf(s, s.hour)}`);
        }
      }
      if (on('invoice') && !on('cash')) s = ok(s, setPolicy(s, 'invoicing', s.company.cash < 60000 ? 'factor' : 'hold'));
      if (on('cash') && !frozen && s.policies.invoicing === 'factor' && s.company.cash > 150000) s = ok(s, setPolicy(s, 'invoicing', 'hold'));
      // Department heads, once the business can carry them (a year's salary in the bank, ten times over).
      if (on('heads') && !frozen) {
        const showsPerMonth = s.stats.showsPlayed / Math.max(1, day / 30);
        const feuds = Object.values(s.bonds ?? {}).filter((x: S) => x <= -40).length;
        const afford = (id: keyof typeof MANAGERS) => s.company.cash > MANAGERS[id].salary * 120;
        const hire = (id: keyof typeof MANAGERS) => {
          const before = s;
          s = ok(s, setManager(s, id, true));
          if (s !== before) bot.heads.push(`${id}@${yearOf(s, s.hour)}`);
        };
        if (!s.managers?.production && showsPerMonth >= 12 && afford('production')) hire('production');
        if (!s.managers?.crew && (feuds >= 2 || s.people.length >= 16) && afford('crew')) hire('crew');
        if (!s.managers?.finance && s.receivables.length >= 6 && afford('finance')) hire('finance');
      }
    }
  }

  // The report.
  const ledger: Partial<Record<LedgerCategory, number>> = {};
  for (const y in s.ledger) for (const c in s.ledger[y]) ledger[c as LedgerCategory] = Math.round((ledger[c as LedgerCategory] ?? 0) + (s.ledger[y][c] ?? 0));
  const revenue = Object.entries(ledger).reduce((n, [c, v]) => (c !== 'equity' && c !== 'sales' && (v ?? 0) > 0 ? n + (v ?? 0) : n), 0);
  const costs = -Object.entries(ledger).reduce((n, [, v]) => ((v ?? 0) < 0 ? n + (v ?? 0) : n), 0);
  const yearsRun = Math.max(0.1, s.hour / (24 * 365));
  const done = s.gigs.filter((g: S) => g.status === 'done' && g.result);
  const fleet = s.vehicles.filter((x: S) => x.owner === 'player').length;
  const rivalOps = s.rivals.map((r: S) => r.ops).filter(Boolean);
  const rivalShows = s.gigs.filter((g: S) => g.status === 'rival' && g.result);
  const declined: Record<string, number> = {};
  rivalOps.forEach((o: S) => Object.entries(o.record.declined).forEach(([k, n]) => (declined[k] = (declined[k] ?? 0) + (n as number))));
  return {
    country,
    startYear,
    seed,
    strategy: strategy.id,
    survived: !s.gameOver,
    gameOver: s.gameOver?.reason,
    yearsRun: Math.round(yearsRun * 10) / 10,
    value: companyValue(s),
    cash: Math.round(s.company.cash),
    loan: s.company.loan,
    reputation: Math.round(s.company.reputation),
    shows: s.stats.showsPlayed,
    failed: s.stats.showsFailed,
    avgQuality: done.length ? Math.round((done.reduce((n: number, g: S) => n + g.result.quality, 0) / done.length) * 100) / 100 : 0,
    ledger,
    revenue,
    costs,
    utilisation: Math.round((s.stats.showsPlayed / Math.max(1, fleet) / yearsRun) * 10) / 10,
    fleet,
    crew: s.people.length,
    crewLost: s.stats.crewLost ?? 0,
    burnout: Math.round(s.people.reduce((n: number, m: S) => n + (m.burnout ?? 0), 0) / Math.max(1, s.people.length)),
    trusted: Object.values(s.bonds ?? {}).filter((x: S) => x >= 40).length,
    feuds: Object.values(s.bonds ?? {}).filter((x: S) => x <= -40).length,
    incidents: s.incidentTally ?? { kinds: {}, causes: {}, main: {} },
    bans: Object.keys(s.blacklist ?? {}).length,
    monthsOverdrawn,
    lowestCash: Math.round(lowestCash),
    forecastWarnings,
    bot,
    rivals: {
      alive: s.rivals.length,
      gone: s.goneRivals.length,
      shows: rivalOps.reduce((n: number, o: S) => n + o.record.shows, 0),
      failed: rivalOps.reduce((n: number, o: S) => n + o.record.failed, 0),
      avgQuality: rivalShows.length ? Math.round((rivalShows.reduce((n: number, g: S) => n + g.result.quality, 0) / rivalShows.length) * 100) / 100 : 0,
      crossHires: rivalOps.reduce((n: number, o: S) => n + o.record.crossHires, 0),
      fixes: rivalOps.reduce((n: number, o: S) => n + o.record.fixes, 0),
      declined,
      cashNegative: rivalOps.filter((o: S) => o.cash < 0).length,
    },
    invariantViolations: violations,
  };
}

