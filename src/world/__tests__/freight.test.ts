import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { bookGig, sendFreight } from '../actions';
import { freightQuote } from '../freight';
import { worldOf } from '../mapgen';
import { HOURS_PER_DAY } from '../catalog';
import { stockSize } from '../loading';
import type { Gig, TycoonState } from '../types';

function setup() {
  let s: TycoonState = createTycoonGame({ companyName: 'F', color: '#f00', seed: 31, country: 'GB', startYear: 1995 });
  s = { ...s, company: { ...s.company, cash: 1_000_000, reputation: 60 } };
  const world = worldOf(s);
  const hq = world.cityById.get(s.company.hqCityId)!;
  // A show in another town with a terminal, a week out.
  const city = world.cities.find(c => c.id !== hq.id && c.size !== 'village')!;
  const venue = city.venues.find(v => v.tier === 1)!;
  const today = Math.floor(s.hour / HOURS_PER_DAY);
  const gig: Gig = {
    id: 'freight-gig', act: 'The Freighters', venueId: venue.id, cityId: city.id, tier: 1, day: today + 7, acceptByDay: today + 2,
    needs: { audio: 2, console: 1, lighting: 1, video: 0, stage: 0 }, crewNeeded: 2, fee: 3000, status: 'offer',
  };
  s = bookGig({ ...s, gigs: [...s.gigs, gig] }, gig.id).state;
  return { s, depot: s.depots[0], gig };
}

describe('rail and air freight', () => {
  it('quotes rail cheaper and slower than air', () => {
    const { s, depot, gig } = setup();
    const rail = freightQuote(s, s.gigs.find(g => g.id === gig.id)!, depot, 'rail');
    expect(rail.ok).toBe(true);
    const air = freightQuote(s, s.gigs.find(g => g.id === gig.id)!, depot, 'air');
    if (air.ok) {
      expect(air.cost).toBeGreaterThan(rail.cost);
      expect(air.hours).toBeLessThan(rail.hours);
    }
  });

  it('plays the show with kit sent by rail and local crew, then brings the kit home', () => {
    const { s, depot, gig } = setup();
    const before = stockSize(depot.gear);
    const sent = sendFreight(s, gig.id, depot.id, 'rail');
    expect(sent.result.ok).toBe(true);
    expect(stockSize(sent.state.depots[0].gear)).toBeLessThan(before);
    const after = advanceHours(sent.state, 10 * HOURS_PER_DAY);
    const played = after.gigs.find(g => g.id === gig.id)!;
    expect(played.status).toBe('done');
    expect(stockSize(after.depots[0].gear) + after.transfers.reduce((n, t) => n + stockSize(t.stock), 0)).toBeGreaterThanOrEqual(before - 1);
  });
});
