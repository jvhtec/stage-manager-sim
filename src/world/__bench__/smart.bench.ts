import { it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { assignVehicle, bookGig, buildAnnex, buyGear, buyVehicle, hireCrew, haggleGig, makeDecision, orderTourMerch, rehearseShow, setPolicy, trainCrew, upgradeDepot, bookTour, assignVehicleToTour } from '../actions';
import { gigBookingBar, tourBookingBar } from '../standing';
import { dayOf, yearOf } from '../core';
import { worldOf } from '../mapgen';
import { roadDistance } from '../pathfinding';
import { companyValue, projectCoverage } from '../queries';
import { deptTotals } from '../loading';
import { productsAvailableIn, expectedQuality } from '../content/gear';
import { VEHICLE_MODELS } from '../catalog';
import { tourMaxTier } from '../tours';
import { nextUpgrade, facilitySpec } from '../facilities';
import { DEPTS } from '../types';
import type { CountryCode } from '../content/countries';

const RUNS: [CountryCode, number, number][] = JSON.parse(process.env.BOT_RUNS ?? '[["GB",1995,9]]');
const SEED = Number(process.env.BOT_SEED ?? 3);
const FEATURES = new Set((process.env.SMART ?? 'annex,sponsor,invoice,merch,tours,gear,train,invest').split(','));
const on = (f: string) => FEATURES.has(f);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type S = any;
const ok = (s: S, out: { state: S; result: { ok: boolean } }): S => (out.result.ok ? out.state : s);

function answer(s: S): S {
  for (const d of [...s.dilemmas]) {
    const pick = (id: string) => d.options.find((o: { id: string; cost?: number }) => o.id === id && (!o.cost || o.cost < s.company.cash * 0.15));
    let choice = d.defaultOption;
    const prefer: Record<string, string[]> = {
      breakdown: ['recovery'], sponsor: on('sponsor') ? ['sign'] : ['decline'], charity: ['half'], dispute: ['argue', 'settle'], audit: ['fix'], dirty: ['security'],
      shareholders: ['appease'], venue: ['refurb'], ownfest: ['cover'], pricewar: ['ride'],
    };
    for (const id of prefer[d.kind] ?? []) if (pick(id)) { choice = id; break; }
    s = ok(s, makeDecision(s, d.id, choice));
  }
  return s;
}

function ensureGear(s: S, gig: S, depotId: string): S {
  if (!on('gear')) return s;
  const depot = s.depots.find((d: S) => d.id === depotId);
  if (!depot) return s;
  const have = deptTotals(depot.gear);
  const year = yearOf(s, s.hour);
  for (const d of DEPTS) {
    let missing = gig.needs[d] - have[d];
    while (missing > 0) {
      const options = productsAvailableIn(year, d).filter((p: S) => p.price <= s.company.cash * 0.25);
      if (!options.length) break;
      const target = expectedQuality(gig.tier, year);
      options.sort((a: S, b: S) => Math.abs(a.quality - target) - Math.abs(b.quality - target) || a.price - b.price);
      const out = buyGear(s, depotId, options[0].id);
      if (!out.result.ok) break;
      s = out.state;
      missing -= 1;
    }
  }
  return s;
}

/**
 * A competent player: buys gear for the shows it books, grows the fleet and crew, takes tours
 * and sponsors, builds a rehearsal stage, trains riggers and first-aiders, answers decisions.
 *
 *   BOT_RUNS='[["GB",1995,9]]' BOT_SEED=3 SMART=gear,invest npm run balance
 *
 * SMART is a comma list of features to leave on (annex,sponsor,invoice,merch,tours,gear,train,invest);
 * DIFF picks the difficulty; LEDGER=1 prints last year's books.
 */
it('smart bot', () => {
  for (const [country, startYear, years] of RUNS) {
    let s: S = createTycoonGame({ companyName: 'B', color: '#f00', seed: SEED, country, startYear, difficulty: (process.env.DIFF as S) ?? 'normal' });
    const world = worldOf(s);
    s = ok(s, setPolicy(s, 'insurance', 'basic'));
    s = ok(s, setPolicy(s, 'rehearsal', 'auto'));
    s = ok(s, setPolicy(s, 'training', 'courses'));
    for (let day = 0; day < 365 * years && !s.gameOver; day++) {
      s = advanceHours(s, 24);
      s = answer(s);
      const today = dayOf(s.hour);
      const maxDist = 25 + Math.min(50, s.company.reputation);
      // Singles.
      for (const g of s.gigs.filter((g: S) => g.status === 'offer' && !g.tourId)) {
        if (gigBookingBar(s, g).reason) continue;
        if (roadDistance(world, s.company.hqCityId, g.cityId) > maxDist || g.day - today < 4) continue;
        const v = s.vehicles.find((v: S) => v.owner === 'player' && v.orders.length === 0 && v.status !== 'broken');
        if (!v) continue;
        if (g.fee < 800 && g.tier > 1) continue;
        const home = s.depots.find((d: S) => d.cityId === v.homeCityId);
        if (!home) continue;
        s = ensureGear(s, g, home.id);
        const b = bookGig(s, g.id);
        if (!b.result.ok) continue;
        const a = assignVehicle(b.state, v.id, g.id);
        if (!a.result.ok) continue;
        s = a.state;
        if (g.tier >= 2) s = ok(s, haggleGig(s, g.id));
      }
      // Tours: take a national tour if we have a truck and the rating.
      if (on('tours')) {
        for (const t of s.tours.filter((t: S) => t.status === 'offer' && t.kind === 'national')) {
          if (tourBookingBar(s, t, tourMaxTier(s, t)).reason) continue;
          const v = s.vehicles.find((v: S) => v.owner === 'player' && v.orders.length === 0);
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
      // Monthly management.
      if (day % 30 === 15) {
        const depot = s.depots[0];
        const rep = s.company.reputation;
        if (on('invest')) {
          // Fleet: add a truck when every vehicle is booked and cash is comfortable.
          const mine = s.vehicles.filter((v: S) => v.owner === 'player');
          const busy = mine.filter((v: S) => v.orders.length > 0).length;
          const year = yearOf(s, s.hour);
          const model = VEHICLE_MODELS.filter(m => m.introYear <= year && m.kind !== 'bus' && m.kind !== 'semi').sort((a, b) => b.gearCapacity - a.gearCapacity)[0];
          if (model && busy >= mine.length && s.company.cash > model.price * 3 && mine.length < 12) s = ok(s, buyVehicle(s, s.depots[0].id, model.id));
          // Crew: keep a couple of techs per truck.
          if (s.people.length < mine.length * 2 && s.company.cash > 20000) s = ok(s, hireCrew(s, s.depots[0].id, 2));
          const next = nextUpgrade(depot);
          if (next && s.company.cash > next.cost * 2.5 && rep >= next.spec.minReputation) s = ok(s, upgradeDepot(s, depot.id));
        }
        if (on('annex') && depot.kind === 'warehouse' && s.company.cash > 150000 && rep >= 40) {
          s = ok(s, buildAnnex(s, s.depots[0].id, 'rehearsal'));
        }
        if (on('train')) {
          for (const cert of ['rigging', 'safety'] as const) {
            const m = s.people.find((p: S) => p.depotId && !p.certs?.includes(cert) && !p.course);
            if (m && rep >= 40 && s.company.cash > 30000) s = ok(s, trainCrew(s, m.id, cert));
          }
        }
        if (on('invoice')) s = ok(s, setPolicy(s, 'invoicing', s.company.cash < 60000 ? 'factor' : 'hold'));
      }
      // Rehearse anything that needs it (the auto policy does too).
      for (const g of s.gigs.filter((g: S) => g.status === 'booked' && !g.rehearsed && g.day - today >= 2 && g.day - today <= 14)) s = ok(s, rehearseShow(s, g.id));
      void projectCoverage;
    }
    if (process.env.LEDGER) { const y = s.ledger[yearOf(s, s.hour) - 1] ?? {}; console.log('LEDGER', JSON.stringify(Object.fromEntries(Object.entries(y).map(([k, v]) => [k, Math.round((v as number) / 1000)])))); }
    console.log('RES', JSON.stringify({ country, startYear, seed: SEED, alive: !s.gameOver, year: yearOf(s, s.hour), cash: Math.round(s.company.cash / 1000), value: Math.round(companyValue(s) / 1000), rep: Math.round(s.company.reputation), shows: s.stats.showsPlayed, failed: s.stats.showsFailed, vehicles: s.vehicles.filter((v: S) => v.owner === 'player').length, wh: facilitySpec(s.depots[0]).label, stage: s.depots[0].modules?.rehearsal ?? 0, sponsors: s.sponsors.filter((d: S) => d.status === 'active').length }));
  }
});
