import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { buildAnnex, rehearseShow, upgradeDepot } from '../actions';
import {
  BENCH_CAP,
  MODULES,
  REHEARSAL_FAILURE,
  REHEARSAL_QUALITY,
  STAGE_RENTAL,
  annexUpkeep,
  benchRepair,
  gigRehearsalCost,
  loungeRest,
  modLevel,
  monthlyAnnexes,
  moduleBlocker,
  rehearsalBlocker,
  stageRental,
  tourRehearsalCost,
} from '../annexes';
import { facilitySpec, nextUpgrade } from '../facilities';
import { dayOf } from '../core';
import type { Gig, TycoonState } from '../types';

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 31, country: 'GB', startYear: 1995 });
  s.company.cash = 5_000_000;
  s.company.reputation = 95;
  return s;
};
const withStage = (level = 1) => {
  const s = game();
  s.depots[0].kind = 'warehouse';
  s.depots[0].size = 4;
  for (let i = 0; i < level; i++) {
    const out = buildAnnex(s, s.depots[0].id, 'rehearsal');
    expect(out.result.ok).toBe(true);
    s.depots[0] = out.state.depots[0];
    s.company.cash = out.state.company.cash;
  }
  return s;
};
const booked = (s: TycoonState, extra: Partial<Gig> = {}): Gig => {
  const g = { id: 'g' + s.gigs.length, act: 'Act', status: 'booked', fee: 8000, day: dayOf(s.hour) + 10, ...extra } as Gig;
  s.gigs.push(g);
  return g;
};

describe('facility upgrades', () => {
  it('a warehouse can grow into a production campus', () => {
    const s = game();
    const d = s.depots[0];
    d.kind = 'warehouse';
    d.size = 3;
    const next = nextUpgrade(d)!;
    expect(next.size).toBe(4);
    expect(next.spec.label).toBe('Production campus');
    const out = upgradeDepot(s, d.id);
    expect(out.result.ok).toBe(true);
    expect(out.state.depots[0].size).toBe(4);
    expect(facilitySpec(out.state.depots[0]).capacity).toBeGreaterThan(facilitySpec(d).capacity);
    expect(nextUpgrade(out.state.depots[0])).toBeNull();
  });

  it('annexes need a warehouse of the right size, and the cash', () => {
    const s = game();
    const d = s.depots[0];
    d.kind = 'delegation';
    expect(moduleBlocker(s, d, 'rehearsal')).toMatch(/warehouse/);
    d.kind = 'warehouse';
    d.size = 1;
    expect(moduleBlocker(s, d, 'rehearsal')).toBeNull();
    const built = buildAnnex(s, d.id, 'rehearsal').state;
    expect(modLevel(built.depots[0], 'rehearsal')).toBe(1);
    expect(moduleBlocker(built, built.depots[0], 'rehearsal')).toMatch(/medium warehouse/);
    built.company.cash = 100;
    built.depots[0].size = 4;
    expect(moduleBlocker(built, built.depots[0], 'rehearsal')).toMatch(/Needs/);
    expect(buildAnnex(s, d.id, 'workshop').result.ok).toBe(true);
  });

  it('annex upkeep is charged monthly and a stage earns rent from bands', () => {
    const s = withStage(2);
    const d = s.depots[0];
    expect(annexUpkeep(d)).toBe(MODULES.rehearsal.levels[1].upkeep);
    const rent = stageRental(s, d);
    expect(rent).toBeGreaterThan(STAGE_RENTAL[2] * 0.4);
    const cash = s.company.cash;
    const rating = s.cityRatings[d.cityId] ?? 50;
    monthlyAnnexes(s);
    expect(s.company.cash - cash).toBe(rent - annexUpkeep(d));
    expect(s.cityRatings[d.cityId]).toBeGreaterThan(rating);
  });

  it('rehearsing a booked show improves its quality and cuts failures, for a price', () => {
    const s = withStage(3);
    const g = booked(s);
    expect(rehearsalBlocker(s, g.id)).toBeNull();
    const cash = s.company.cash;
    const out = rehearseShow(s, g.id);
    expect(out.result.ok).toBe(true);
    expect(cash - out.state.company.cash).toBe(gigRehearsalCost(g));
    const after = out.state.gigs.find(x => x.id === g.id)!;
    expect(after.mods?.quality).toBeCloseTo(REHEARSAL_QUALITY[3]);
    expect(after.mods?.failureFactor).toBeCloseTo(REHEARSAL_FAILURE[3]);
    expect(after.rehearsed).toBe(3);
    expect(rehearseShow(out.state, g.id).result.ok).toBe(false);
  });

  it('a bigger stage does more; a stage is booked while in use', () => {
    const small = withStage(1);
    const big = withStage(4);
    const a = booked(small);
    const b = booked(big);
    const s1 = rehearseShow(small, a.id).state.gigs.find(x => x.id === a.id)!;
    const s2 = rehearseShow(big, b.id).state.gigs.find(x => x.id === b.id)!;
    expect(s2.mods!.quality!).toBeGreaterThan(s1.mods!.quality!);
    const used = rehearseShow(big, b.id).state;
    const second = booked(used);
    expect(rehearsalBlocker(used, second.id)).toMatch(/booked up/);
    used.hour += 24 * 6;
    expect(rehearsalBlocker(used, second.id)).toBeNull();
  });

  it('needs a stage, a booked show, and some notice', () => {
    const s = game();
    const g = booked(s);
    expect(rehearsalBlocker(s, g.id)).toMatch(/stage/);
    const t = withStage(1);
    const soon = booked(t, { day: dayOf(t.hour) + 1 });
    expect(rehearsalBlocker(t, soon.id)).toMatch(/days away/);
    const open = booked(t, { status: 'offer' });
    expect(rehearsalBlocker(t, open.id)).toMatch(/days away/);
    expect(rehearsalBlocker(t, 'nothing')).toMatch(/Nothing/);
  });

  it('rehearsing a tour covers every remaining date at a discount', () => {
    const s = withStage(2);
    const legs = [0, 1, 2].map(i => booked(s, { tourId: 't1', day: dayOf(s.hour) + 10 + i * 3, fee: 10000 }));
    s.tours.push({ id: 't1', act: 'Act', name: 'The Tour', kind: 'national', gigIds: legs.map(l => l.id), bonus: 0, acceptByDay: 0, status: 'booked' } as never);
    const single = legs.reduce((sum, g) => sum + gigRehearsalCost(g), 0);
    expect(tourRehearsalCost(s, s.tours[0])).toBeLessThan(single);
    const out = rehearseShow(s, 't1');
    expect(out.result.ok).toBe(true);
    out.state.gigs.filter(g => g.tourId === 't1').forEach(g => expect(g.rehearsed).toBe(2));
    // Rehearsing any leg id also reaches the tour.
    expect(rehearsalBlocker(out.state, legs[0].id)).not.toBeNull();
  });

  it('the workshop bench repairs kit even with no workshop policy', () => {
    const s = game();
    s.policies.workshop = 'none';
    s.gearCondition['meyer-upa1'] = 40;
    s.depots[0].kind = 'warehouse';
    s.depots[0].size = 2;
    expect(benchRepair(s)).toEqual([0, 0]);
    const built = buildAnnex(buildAnnex(s, s.depots[0].id, 'workshop').state, s.depots[0].id, 'workshop').state;
    const [repair, cap] = benchRepair(built);
    expect(repair).toBeGreaterThan(0);
    expect(cap).toBe(BENCH_CAP[2]);
    const later = advanceHours(built, 24 * 20);
    expect(later.gearCondition['meyer-upa1']).toBeGreaterThan(40);
  });

  it('a crew lounge helps techs recover between jobs', () => {
    const s = game();
    s.depots[0].kind = 'warehouse';
    s.depots[0].size = 2;
    expect(loungeRest(s.depots[0])).toBe(0);
    const built = buildAnnex(buildAnnex(s, s.depots[0].id, 'lounge').state, s.depots[0].id, 'lounge').state;
    expect(loungeRest(built.depots[0])).toBeGreaterThan(0);
    const plain = game();
    const tired = (st: TycoonState) => {
      st.people.forEach(m => {
        m.depotId = st.depots[0].id;
        m.vehicleId = undefined;
        m.fatigue = 80;
      });
      return advanceHours(st, 24 * 2);
    };
    const a = tired(built).people.reduce((sum, m) => sum + m.fatigue, 0);
    const b = tired(plain).people.reduce((sum, m) => sum + m.fatigue, 0);
    expect(a).toBeLessThan(b);
  });
});
