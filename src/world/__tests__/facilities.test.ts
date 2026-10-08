import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { buildDepot, buyGear, buyVehicle, hireStaff, setPolicy, upgradeDepot } from '../actions';
import { HOURS_PER_DAY } from '../catalog';
import { freelancersFor } from '../crew';
import { DELEGATION, WAREHOUSES, leftBehindChance, monthlyRent, prepFailureFactor, prepRatio, salesBoost } from '../facilities';
import { worldOf } from '../mapgen';
import { freeLot } from '../core';
import type { Gig, TycoonState } from '../types';

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'F', color: '#f00', seed: 21, country: 'ES', startYear: 1995 });
  return { ...s, company: { ...s.company, cash: 2_000_000 }, gigs: [], tours: [] };
};
const otherCity = (s: TycoonState) => worldOf(s).cities.find(c => c.id !== s.company.hqCityId && c.size !== 'village' && freeLot(s, worldOf(s), c.id) >= 0)!;

describe('bases', () => {
  it('delegations are cheap, small, and van-only; warehouses grow with reputation', () => {
    let s = game();
    const city = otherCity(s);
    const before = s.company.cash;
    s = buildDepot(s, city.id, 'delegation').state;
    expect(before - s.company.cash).toBe(DELEGATION.build);
    const d = s.depots.find(x => x.cityId === city.id)!;
    expect(d.kind).toBe('delegation');
    expect(buyVehicle(s, d.id, 'luton-box').result.ok).toBe(false);
    expect(buyVehicle(s, d.id, 'splitter-van').result.ok).toBe(true);
    const product = Object.keys(s.depots[0].gear)[0];
    expect(buyGear(s, d.id, product, DELEGATION.capacity + 1).result.ok).toBe(false);
    expect(buyGear(s, d.id, product, 5).result.ok).toBe(true);

    s = upgradeDepot(s, d.id).state;
    expect(s.depots.find(x => x.id === d.id)!.kind).toBe('warehouse');
    s = { ...s, company: { ...s.company, reputation: 10 } };
    expect(upgradeDepot(s, d.id).result.ok).toBe(false); // medium needs reputation
    s = { ...s, company: { ...s.company, reputation: 60 } };
    s = upgradeDepot(upgradeDepot(s, d.id).state, d.id).state;
    expect(s.depots.find(x => x.id === d.id)!.size).toBe(3);
    expect(upgradeDepot(s, d.id).result.ok).toBe(false);
  });

  it('rent is dearer in big cities; rent and salaries land monthly', () => {
    const s = game();
    const world = worldOf(s);
    const big = [...world.cities].sort((a, b) => b.population - a.population)[0];
    const small = [...world.cities].sort((a, b) => a.population - b.population)[0];
    const at = (cityId: string) => monthlyRent(world, { ...s.depots[0], cityId });
    expect(at(big.id)).toBeGreaterThan(at(small.id));
    expect(at(big.id)).toBeGreaterThanOrEqual(WAREHOUSES[0].rent);
    const later = advanceHours(hireStaff(s, s.depots[0].id, 'office').state, 40 * HOURS_PER_DAY);
    expect(later.ledger[1995]?.salaries ?? 0).toBeLessThan(0);
    expect(later.ledger[1995]?.property ?? 0).toBeLessThan(0);
  });

  it('prep staff keep kit checked; sales staff bring in work', () => {
    let s = game();
    const hq = s.depots[0];
    s.depots[0] = { ...hq, staff: { warehouse: 0, office: 0 } };
    expect(prepRatio(s, s.depots[0])).toBe(0);
    expect(leftBehindChance(0)).toBeGreaterThan(0);
    expect(prepFailureFactor(0)).toBeGreaterThan(prepFailureFactor(1));
    s.depots[0] = { ...hq, staff: { warehouse: 4, office: 0 } };
    expect(prepRatio(s, s.depots[0])).toBe(1);
    expect(leftBehindChance(1)).toBe(0);
    const world = worldOf(s);
    expect(salesBoost(s, world, hq.cityId)).toBe(0);
    s = hireStaff(hireStaff(s, hq.id, 'office').state, hq.id, 'office').state;
    expect(salesBoost(s, world, hq.cityId)).toBeGreaterThan(0.2);
  });
});

describe('gig crews and the road', () => {
  it('local freelancers fill gaps — cheaper and better where you have a base', () => {
    const s = game();
    const world = worldOf(s);
    const away = otherCity(s);
    const gig = { id: 'g', act: 'X', cityId: away.id, venueId: away.venues[0].id, tier: 2, day: 10, crewNeeded: 6, needs: {} } as unknown as Gig;
    const strangers = freelancersFor(s, world, gig, 2);
    expect(strangers.count).toBe(4);
    const withBase = buildDepot(s, away.id, 'delegation').state;
    const contacts = freelancersFor(withBase, world, gig, 2);
    expect(contacts.cost).toBeLessThan(strangers.cost);
    expect(contacts.effectiveness).toBeGreaterThan(strangers.effectiveness);
    expect(freelancersFor(setPolicy(s, 'freelance', 'off').state, world, gig, 2).count).toBe(0);
  });

  it('trucks burn fuel and crews away from base cost per diems and hotels', () => {
    let s = game();
    const v = s.vehicles.find(x => x.owner === 'player')!;
    const away = otherCity(s);
    // Broken down on the way home: a night away, then it limps back.
    v.crew = 2;
    v.cityId = undefined;
    v.status = 'broken';
    v.brokenUntil = 30;
    v.route = { from: away.id, to: v.homeCityId, progress: 0 };
    v.orders = [];
    s = advanceHours(s, 2 * HOURS_PER_DAY);
    expect(s.ledger[1995]?.travel ?? 0).toBeLessThan(0);
    expect(s.ledger[1995]?.fuel ?? 0).toBeLessThan(0); // it drove home
  });
});
