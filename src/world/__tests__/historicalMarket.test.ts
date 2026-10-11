import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createTycoonGame } from '../state';
import { rosterOf, selectRoster, updateRivals } from '../roster';
import { getWorld, worldOf } from '../mapgen';
import { COUNTRIES, cityNames } from '../content/countries';
import { HISTORICAL_ACTORS, actorById, eraIn, ownerIn, presenceIn } from '../content/actors';
import { ACTOR_POOLS } from '../content/marketRegions';
import { HISTORICAL_PEOPLE, leadersOf } from '../content/people';
import { STRATEGY_ERAS, pickWeighted, strategyEraOf, styleOf } from '../strategies';
import { aggression } from '../rivalry';
import { monthlyRivalOps, opsOf, rivalOverhead, rivalQuote, rivalTryTake } from '../rivalOps';
import { canPrime, deptsOf, planSupply, supplyPenalty } from '../supply';
import { offerToRivals } from '../offers';
import { dateOfDay } from '../core';
import { getModel } from '../catalog';
import type { Gig, TycoonState } from '../types';

type C = 'ES' | 'GB' | 'US' | 'DE' | 'FR' | 'IT';
const game = (country: C, startYear = 1990, seed = 99) => createTycoonGame({ companyName: 'Test', color: '#ff0066', seed, country, startYear });
/** Run the market forward year by year (rivals only), as the daily tick would. */
function advanceTo(s: TycoonState, year: number) {
  s.hour = Math.max(s.hour, 24 * 400);
  const world = worldOf(s);
  for (let y = s.startYear; y <= year; y++) updateRivals(s, world, y);
}
const ids = (s: TycoonState) => s.rivals.map(r => r.id);

describe('historical content', () => {
  it('is consistent: towns on the map, known actors, ordered eras and tenures', () => {
    const towns = new Map(COUNTRIES.map(c => [c.code, new Set(cityNames(c))]));
    HISTORICAL_ACTORS.forEach(a => {
      a.presence.forEach(p => p.city && expect(towns.get(p.country)!.has(p.city), `${a.id} → ${p.city}`).toBe(true));
      [a.eras, a.names].forEach(xs => xs.forEach((x, i) => i && expect(x.from, a.id).toBeGreaterThan(xs[i - 1].from)));
      (a.events ?? []).forEach(e => e.kind === 'absorbed' && expect(actorById(e.into), `${a.id} → ${e.into}`).toBeDefined());
      [...a.presence, ...a.eras, ...a.names, ...(a.events ?? [])].forEach(x => {
        if (x.basis === 'modelled') expect(x.note, `${a.id} modelled date must explain itself`).toBeTruthy();
      });
    });
    STRATEGY_ERAS.forEach(e => expect(actorById(e.actor), e.actor).toBeDefined());
    HISTORICAL_PEOPLE.forEach(p => p.tenures.forEach(t => expect(actorById(t.actor), `${p.name} → ${t.actor}`).toBeDefined()));
    ACTOR_POOLS.forEach(p => p.actorIds.forEach(id => expect(presenceIn(actorById(id)!, p.country, 2100) ?? actorById(id)!.presence.find(x => x.country === p.country)).toBeDefined()));
    expect(new Set(HISTORICAL_ACTORS.map(a => a.id)).size).toBe(HISTORICAL_ACTORS.length);
  });

  it('never shows a person before the evidence, and keeps people apart from strategy', () => {
    expect(leadersOf('twincam', 1990)).toEqual([]); // Rafael Campos is documented from 1994
    expect(leadersOf('twincam', 1995)).toEqual(['Rafael Campos']);
    expect(leadersOf('britrow', 1985)).toEqual(['Robbie Williams', 'Bryan Grant']);
    expect(leadersOf('britrow', 1991)).toEqual(['Bryan Grant', 'Mike Lowe']);
    // How a firm plays is attached to the company and its era, not to a person.
    expect(strategyEraOf('espiral', 1990)?.strategy).toBe('pioneer');
    expect(strategyEraOf('espiral', 2001)?.strategy).toBe('regional');
    expect(strategyEraOf('fluge', 1991)?.strategy).toBe('integrator');
    expect(styleOf({ id: 'wigwam' }, 1990).label).toBe('Steady');
  });
});

describe('Spain, decade by decade', () => {
  const foreign = ['clair', 'prg', 'solotech', 'lsd', 'britrow', 'eml', 'dushowes'];

  it('1980: domestic pioneers only — no foreign base', () => {
    const s = game('ES', 1980);
    ['milan', 'valladar', 'twincam'].forEach(id => expect(ids(s)).toContain(id));
    expect(s.rivals.find(r => r.id === 'twincam')!.name).toBe('LIL Service');
    foreign.forEach(id => expect(ids(s)).not.toContain(id));
    ['pronorte', 'fluge', 'sorter', 'berenice'].forEach(id => expect(ids(s)).not.toContain(id));
  });

  it('1985–1995: Pronorte in Gijón, the 1986 companies, a small sound-only Fluge', () => {
    const s = game('ES', 1980);
    advanceTo(s, 1986);
    const world = worldOf(s);
    const pronorte = s.rivals.find(r => r.id === 'pronorte')!;
    expect(world.cityById.get(pronorte.hqCityId)!.name).toBe('Gijón');
    ['sorter', 'berenice', 'arcoiris'].forEach(id => expect(ids(s)).toContain(id));
    expect(ids(s)).not.toContain('fluge');
    advanceTo(s, 1990);
    const fluge = s.rivals.find(r => r.id === 'fluge')!;
    expect(deptsOf(fluge, 1990)).toEqual(['audio', 'console']);
    expect(fluge.maxTier).toBeLessThanOrEqual(3);
    expect(s.rivals.find(r => r.id === 'twincam')!.name).toBe('Twin Cam Audio');
    advanceTo(s, 2000);
    // We know Berenice existed in this era, but not its exact closure date: history must not invent one.
    expect(ids(s)).toContain('berenice');
    foreign.filter(id => id !== 'dushowes').forEach(id => expect(ids(s)).not.toContain(id));
  });

  it('2006–2012: EML opens in Madrid, PRG buys it in 2011, the name changes in 2012 — same company', () => {
    const s = game('ES', 2000);
    advanceTo(s, 2006);
    const eml = s.rivals.find(r => r.id === 'eml')!;
    expect(eml.name).toBe('EML Productions Spain');
    expect(ids(s)).not.toContain('prg');
    const ops = opsOf(s, eml);
    ops.cash = 123456;
    s.gigs.push({ ...s.gigs[0], id: 'booked', status: 'rival', rivalId: 'eml', day: 99999, result: undefined } as Gig);
    advanceTo(s, 2011);
    expect(ownerIn(actorById('eml')!, 2011)).toBe('PRG');
    expect(s.news.some(n => n.text.startsWith('PRG buys EML'))).toBe(true);
    advanceTo(s, 2012);
    const prg = s.rivals.find(r => r.id === 'eml')!;
    expect(prg.name).toBe('PRG');
    // Continuity: the same operation, cash and bookings — not a new firm from nowhere.
    expect(prg.ops).toBe(ops);
    expect(prg.ops!.cash).toBe(123456);
    expect(s.gigs.find(g => g.id === 'booked')!.rivalId).toBe('eml');
    expect(ids(s)).not.toContain('prg');
  });

  it('2015–2020: Soinua pivots to distribution, Real Audio winds up; still no Clair or Solotech', () => {
    const s = game('ES', 2010);
    s.marketRoster = [...new Set([...rosterOf(s), 'soinua', 'realaudio'])];
    advanceTo(s, 2014);
    expect(ids(s)).toEqual(expect.arrayContaining(['soinua', 'realaudio']));
    advanceTo(s, 2015);
    expect(ids(s)).not.toContain('soinua');
    expect(s.goneRivals).toContain('soinua');
    expect(s.news.some(n => /Soinua steps back/.test(n.text))).toBe(true);
    advanceTo(s, 2020);
    expect(ids(s)).not.toContain('realaudio');
    expect(ids(s)).not.toContain('clair');
    expect(ids(s)).not.toContain('solotech');
  });
});

describe('the roster', () => {
  it('draws regional firms from pools by map seed, and the draw is saved', () => {
    const a = game('ES', 1995, 7);
    const b = game('ES', 1995, 7);
    expect(a.marketRoster).toEqual(b.marketRoster);
    ACTOR_POOLS.filter(p => p.country === 'ES').forEach(p => {
      const n = a.marketRoster!.filter(id => p.actorIds.includes(id)).length;
      expect(n).toBeGreaterThanOrEqual(p.min);
      expect(n).toBeLessThanOrEqual(p.max);
    });
    // Firms outside any pool are always in.
    ['milan', 'fluge', 'pronorte', 'eml'].forEach(id => expect(a.marketRoster).toContain(id));
    // Seeds differ in who they draw somewhere.
    const draws = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(seed => selectRoster({ country: 'ES', mapSeed: seed }).join()));
    expect(draws.size).toBeGreaterThan(1);
  });

  it('a saved roster is kept even if the content would draw differently', () => {
    const s = game('ES', 1995);
    s.marketRoster = ['milan'];
    s.rivals = [];
    advanceTo(s, 1996);
    expect(ids(s)).toEqual(['milan']);
  });

  it('an old save gets its roster once, keeps its firms and doesn\'t replay history', () => {
    const s = game('GB', 2000);
    const before = ids(s).sort();
    delete s.marketRoster;
    delete s.companyEventsApplied;
    s.news = [];
    advanceTo(s, 2000);
    expect(ids(s).sort()).toEqual(before);
    expect(s.news.some(n => /Salvesen|joins Production Resource Group/.test(n.text))).toBe(false);
  });
});

describe('specialised firms and subcontracting', () => {
  const setup = () => {
    const s = game('ES', 1990);
    const world = worldOf(s);
    const fluge = s.rivals.find(r => r.id === 'fluge')!;
    const arcoiris = s.rivals.find(r => r.id === 'arcoiris')!;
    // Neighbours, for the test.
    arcoiris.hqCityId = fluge.hqCityId;
    const base = s.gigs.find(g => g.status === 'offer')!;
    const gig = { ...base, id: 'job', cityId: fluge.hqCityId, venueId: world.cityById.get(fluge.hqCityId)!.venues[0].id, tier: 2, fee: 200000, techSpec: undefined, needs: { audio: 8, console: 1, lighting: 5, video: 0, stage: 0 } } as Gig;
    s.gigs = [];
    return { s, world, fluge, arcoiris, gig };
  };

  it('a lighting house owns no PA and can\'t take a sound-led show', () => {
    const { s, arcoiris, gig } = setup();
    const ops = opsOf(s, arcoiris);
    expect(ops.kit.audio).toBe(0);
    expect(ops.kit.lighting).toBeGreaterThan(0);
    expect(ops.pa).toEqual([]);
    expect(canPrime(arcoiris, gig, 1990)).toBe(false);
    expect(rivalQuote(s, worldOf(s), arcoiris, gig)).toMatchObject({ ok: false, reason: 'lines' });
  });

  it('a sound house takes the show and subcontracts the lighting to a partner it then trusts', () => {
    const { s, world, fluge, arcoiris, gig } = setup();
    const fops = opsOf(s, fluge);
    const aops = opsOf(s, arcoiris);
    s.rivals.forEach(r => r.id !== 'arcoiris' && r.ops && (r.ops.kit.lighting = 0));
    fops.crew = 99;
    fops.trucks = 9;
    const plan = planSupply(s, world, fluge, fops, gig, 1990);
    expect(plan.lines).toEqual([{ dept: 'lighting', units: 5, from: 'arcoiris' }]);
    const cash = aops.cash;
    s.gigs.push(gig);
    expect(rivalTryTake(s, world, fluge, gig)).toBe(true);
    expect(gig.supply).toEqual([{ dept: 'lighting', units: 5, from: 'arcoiris' }]);
    expect(aops.cash).toBe(cash + plan.paid.arcoiris);
    expect(fops.partners?.arcoiris).toBe(1);
    // A partner it knows well is smoother on the night than the open market.
    const strangers = supplyPenalty({ ...gig, supply: [{ dept: 'lighting', units: 5 }] }, fops);
    fops.partners!.arcoiris = 10;
    expect(supplyPenalty(gig, fops)).toBeLessThan(strangers);
  });

  it('with no partner free, it hires the department on the open market', () => {
    const { s, world, fluge, arcoiris, gig } = setup();
    const fops = opsOf(s, fluge);
    opsOf(s, arcoiris).kit.lighting = 0;
    s.rivals.forEach(r => r.id !== 'fluge' && r.ops && (r.ops.kit.lighting = 0));
    const plan = planSupply(s, world, fluge, fops, gig, 1990);
    expect(plan.lines).toEqual([{ dept: 'lighting', units: 5 }]);
    expect(plan.cost).toBeGreaterThan(0);
  });

  it('a firm that keeps subcontracting a department may bring it in-house, if its strategy leans that way', () => {
    const { s, fluge } = setup();
    // A January: taking on a department is a once-a-year decision.
    let day = 360;
    while (dateOfDay(s, day).getUTCMonth() !== 0) day++;
    s.hour = 24 * day + 10;
    const ops = opsOf(s, fluge);
    ops.short = { lighting: 40 };
    ops.cash = rivalOverhead(ops) * 10;
    ops.quality = 99;
    const always = { ...createRng(1), chance: () => true } as never;
    monthlyRivalOps(s, fluge, always);
    expect(ops.kit.lighting).toBeGreaterThan(0);
    expect(s.news.some(n => /buys its own/.test(n.text))).toBe(true);
  });

  it('competition is local: a capable firm far away doesn\'t thin a town\'s chances', () => {
    const { s, world, fluge, gig } = setup();
    const chances = (extraFar: boolean) => {
      const t = structuredClone(s);
      t.rivals = t.rivals.filter(r => r.id === 'fluge');
      if (extraFar) {
        const far = [...world.cities].sort((a, b) => b.population - a.population).find(c => c.id !== fluge.hqCityId && c.name !== 'Madrid')!;
        t.rivals.push({ ...t.rivals[0], id: 'sorter', hqCityId: far.id, name: 'Far' });
      }
      const calls: number[] = [];
      offerToRivals(t, world, { next: () => 0.5, chance: (p: number) => (calls.push(p), false), pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never, { ...gig, status: 'offer' } as Gig);
      return calls[0];
    };
    expect(chances(true)).toBeCloseTo(chances(false), 10);
  });
});

describe('company events keep continuity', () => {
  it('an absorbed firm hands over its kit, bookings and patch', () => {
    const s = game('GB', 2005);
    advanceTo(s, 2012);
    const sse = s.rivals.find(r => r.id === 'sse')!;
    const wigwam = s.rivals.find(r => r.id === 'wigwam')!;
    const wk = opsOf(s, wigwam).kit.audio;
    const before = opsOf(s, sse).kit.audio;
    s.gigs.push({ ...s.gigs[0], id: 'ww', status: 'rival', rivalId: 'wigwam', day: 99999, result: undefined } as Gig);
    s.townShows[wigwam.hqCityId] = { wigwam: 7 };
    advanceTo(s, 2013);
    expect(ids(s)).not.toContain('wigwam');
    expect(opsOf(s, sse).kit.audio).toBe(before + wk);
    expect(s.gigs.find(g => g.id === 'ww')!.rivalId).toBe('sse');
    expect(s.townShows[wigwam.hqCityId].sse).toBe(7);
  });

  it('a foreign house opens where and when it really had a base', () => {
    expect(game('GB', 1990).rivals.some(r => r.id === 'clair')).toBe(false);
    expect(game('US', 1990).rivals.some(r => r.id === 'clair')).toBe(true);
    const s = game('GB', 2000);
    advanceTo(s, 2008);
    expect(s.news.some(n => n.text.includes('Concert Sound'))).toBe(true);
    expect(eraIn(actorById('clair')!, 2008).reach).toBe('international');
  });
});

describe('strategies', () => {
  it('does not materialise unaffordable reinvestment', () => {
    const s = game('GB', 2000);
    const r = s.rivals.find(x => x.id === 'delta')!;
    const ops = opsOf(s, r);
    ops.quality = 99;
    ops.short = {};
    ops.record.declined = { trucks: 9 };
    ops.month = { income: 0, costs: 0 };
    ops.kit = { audio: 0, console: 0, lighting: 0, video: 0, stage: 0 };
    const overhead = rivalOverhead(ops);
    const truckCost = getModel(r.maxTier >= 3 ? 'artic-40' : 'rigid-7t').price;
    const threshold = overhead * styleOf(r, 2000).reinvest;
    expect(truckCost).toBeGreaterThan(threshold + 1000);
    ops.cash = overhead + threshold + 1000;
    const beforeCash = ops.cash;
    const beforeTrucks = ops.trucks;
    monthlyRivalOps(s, r, createRng(1));
    expect(ops.trucks).toBe(beforeTrucks);
    expect(ops.cash).toBe(beforeCash - overhead);
  });

  it('a prudent firm keeps more cash back before spending than an expansionist', () => {
    const s = game('GB', 2000);
    getWorld(s.mapSeed, 'GB');
    const spend = (id: string) => {
      const r = s.rivals.find(x => x.id === id)!;
      const ops = opsOf(s, r);
      ops.quality = 99;
      ops.short = {};
      ops.record.declined = { crew: 9 };
      const overhead = rivalOverhead(ops);
      // Leave three months of overhead after this month's bills. Expansionist reinvests above two;
      // prudent waits for 4.5. Crew is deliberately cheap so this tests reserve policy, not affordability.
      ops.cash = overhead * 4;
      const crew = ops.crew;
      monthlyRivalOps(s, r, createRng(1));
      return ops.crew - crew;
    };
    expect(styleOf({ id: 'negearth' }, 2000).label).toBe('Prudent');
    expect(styleOf({ id: 'delta' }, 2000).label).toBe('Expansionist');
    expect(spend('negearth')).toBe(0);
    expect(spend('delta')).toBe(3);
  });

  it('grudges stay in range and weighted picks follow the weights', () => {
    HISTORICAL_ACTORS.forEach(a => [1980, 2000, 2020].forEach(y => {
      const g = aggression({ id: a.id }, y);
      expect(g).toBeGreaterThanOrEqual(0.1);
      expect(g).toBeLessThanOrEqual(1);
    }));
    const rng = createRng(5);
    let n = 0;
    for (let i = 0; i < 4000; i++) if (pickWeighted(rng, ['a', 'b'], x => (x === 'a' ? 3 : 1)) === 'a') n++;
    expect(n / 4000).toBeGreaterThan(0.7);
    expect(n / 4000).toBeLessThan(0.8);
  });
});
