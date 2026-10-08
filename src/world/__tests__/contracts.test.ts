import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { assignVehicle, bookGig, breakContract, signContract } from '../actions';
import { HOURS_PER_DAY } from '../catalog';
import { dayOf } from '../core';
import { houseKit } from '../contracts';
import { worldOf } from '../mapgen';
import { projectCoverage } from '../queries';
import { stockSize } from '../loading';
import type { Gig, TycoonState, VenueContract } from '../types';

function setup(): { s: TycoonState; contract: VenueContract } {
  let s = createTycoonGame({ companyName: 'H', color: '#f00', seed: 9, country: 'GB', startYear: 1990 });
  s = { ...s, company: { ...s.company, cash: 1_000_000, reputation: 30 } };
  const world = worldOf(s);
  const hq = world.cityById.get(s.company.hqCityId)!;
  const venue = hq.venues.find(v => v.tier === 1)!;
  const today = dayOf(s.hour);
  const contract: VenueContract = {
    id: 'c1', venueId: venue.id, cityId: hq.id, tier: 1, kit: houseKit(1), installed: {}, monthly: 1300,
    acceptByDay: today + 10, startDay: today + 15, endDay: today + 15 + 360, status: 'offer',
  };
  return { s: { ...s, contracts: [contract] }, contract };
}

describe('house contracts', () => {
  it('venues tender them over time', () => {
    let s = createTycoonGame({ companyName: 'H', color: '#f00', seed: 9, country: 'GB', startYear: 1990 });
    s = { ...s, company: { ...s.company, cash: 1_000_000 } };
    s = advanceHours(s, 120 * HOURS_PER_DAY);
    expect(s.contracts.length).toBeGreaterThan(0);
  });

  it('install kit from the town warehouse, pay monthly, and give it back at the end', () => {
    const { s: s0 } = setup();
    const before = stockSize(s0.depots[0].gear);
    const signed = signContract(s0, 'c1');
    expect(signed.result.ok).toBe(true);
    let s = signed.state;
    const installed = stockSize(s.contracts[0].installed);
    expect(installed).toBeGreaterThan(0);
    expect(stockSize(s.depots[0].gear)).toBe(before - installed);
    const endDay = s.contracts[0].endDay;
    s = advanceHours(s, (endDay - 1) * HOURS_PER_DAY - s.hour);
    expect(Object.values(s.ledger).reduce((sum, y) => sum + (y.contracts ?? 0), 0)).toBeGreaterThanOrEqual(1300 * 10);
    const beforeEnd = stockSize(s.depots[0].gear);
    s = advanceHours(s, 2 * HOURS_PER_DAY);
    expect(s.contracts.find(c => c.id === 'c1')?.status ?? 'ended').toBe('ended');
    expect(stockSize(s.depots[0].gear)).toBe(beforeEnd + installed);
  });

  it("refuses without a warehouse in town; pulling out costs three months", () => {
    const { s, contract } = setup();
    const elsewhere = { ...s, contracts: [{ ...contract, cityId: worldOf(s).cities.find(c => c.id !== s.company.hqCityId)!.id }] };
    expect(signContract(elsewhere, 'c1').result.ok).toBe(false);
    const signed = signContract(s, 'c1').state;
    const out = breakContract(signed, 'c1');
    expect(out.result.ok).toBe(true);
    expect(signed.company.cash - out.state.company.cash).toBe(1300 * 3);
  });

  it('shows at your house venue run on the house rig', () => {
    const { s: s0, contract } = setup();
    const s1 = signContract(s0, 'c1').state;
    const day = dayOf(s1.hour) + 5;
    const gig: Gig = {
      id: 'hg', act: 'The Static Engines', venueId: contract.venueId, cityId: contract.cityId, tier: 1, day, acceptByDay: day - 2,
      needs: { audio: 3, console: 1, lighting: 2, video: 0, stage: 1 }, crewNeeded: 2, fee: 3000, status: 'offer',
    };
    let s = bookGig({ ...s1, gigs: [gig] }, 'hg').state;
    const van = s.vehicles.find(v => v.owner === 'player')!;
    s = assignVehicle(s, van.id, 'hg').state;
    const withHouse = projectCoverage(s, s.gigs[0]);
    const noHouse = projectCoverage({ ...s, contracts: [] }, s.gigs[0]);
    expect(withHouse.evaluation.coverage).toBeGreaterThanOrEqual(noHouse.evaluation.coverage);
    expect(stockSize(withHouse.delivered)).toBeGreaterThan(0);
  });
});

describe('house contract edge cases', () => {
  it('a delegation is not a warehouse', () => {
    const { s, contract } = setup();
    const asDelegation = { ...s, depots: s.depots.map(d => (d.cityId === contract.cityId ? { ...d, kind: 'delegation' as const } : d)) };
    expect(signContract(asDelegation, 'c1').result.ok).toBe(false);
  });

  it("a departed rival's contract frees the venue", () => {
    const { s, contract } = setup();
    const held = { ...s, contracts: [{ ...contract, status: 'rival' as const, rivalId: 'gone-rival', endDay: contract.endDay + 300 }] };
    const later = advanceHours(held, 2 * HOURS_PER_DAY);
    expect(later.contracts.find(c => c.id === 'c1')?.status ?? 'ended').toBe('ended');
  });
});
