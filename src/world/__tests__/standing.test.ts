import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { bookGig } from '../actions';
import { actReputationBar, gigBookingBar } from '../standing';
import { worldOf } from '../mapgen';
import { HOURS_PER_DAY } from '../catalog';
import type { Gig, TycoonState } from '../types';

const game = (startYear: number, reputation?: number): TycoonState => {
  const s = createTycoonGame({ companyName: 'T', color: '#f00', seed: 11, country: 'GB', startYear });
  return reputation === undefined ? s : { ...s, company: { ...s.company, reputation } };
};

function clubGig(s: TycoonState, act: string): TycoonState {
  const world = worldOf(s);
  const hq = world.cityById.get(s.company.hqCityId)!;
  const venue = hq.venues.find(v => v.tier === 1)!;
  const day = Math.floor(s.hour / HOURS_PER_DAY) + 8;
  const gig: Gig = {
    id: 'club', act, venueId: venue.id, cityId: hq.id, tier: 1, day, acceptByDay: day - 3,
    needs: { audio: 2, console: 1, lighting: 1, video: 0, stage: 1 }, crewNeeded: 2, fee: 3000, status: 'offer',
  };
  return { ...s, gigs: [...s.gigs, gig] };
}

describe('who will hire you', () => {
  it('big acts want an established crew, even in a club', () => {
    const s = clubGig(game(1975), 'AC/DC');
    const out = bookGig(s, 'club');
    expect(out.result.ok).toBe(false);
    expect(out.result.message).toMatch(/AC\/DC's management/);
    // A local band doesn't care who you are.
    expect(bookGig(clubGig(game(1975), 'The Velvet Foxes'), 'club').result.ok).toBe(true);
  });

  it('the bar rises with the act and falls with your history together', () => {
    const s = game(1985);
    expect(actReputationBar(s, 'AC/DC')).toBeGreaterThanOrEqual(85);
    expect(actReputationBar(s, 'The Velvet Foxes')).toBe(0);
    const friends = { ...s, artistRelations: { 'AC/DC': 3 } };
    expect(actReputationBar(friends, 'AC/DC')).toBeLessThan(actReputationBar(s, 'AC/DC'));
    const established = clubGig(game(1985, 95), 'AC/DC');
    expect(gigBookingBar(established, established.gigs.at(-1)!).reason).toBeNull();
  });

  it("the starter tour is with an act that'll actually hire you", () => {
    for (const country of ['GB', 'ES', 'US', 'DE', 'FR', 'IT'] as const) for (const startYear of [1975, 1980, 1985, 1990, 2000, 2010]) {
      const s = createTycoonGame({ companyName: 'T', color: '#f00', seed: 11, country, startYear });
      expect(s.tours.length, `${country} ${startYear}`).toBeGreaterThan(0);
      s.tours.forEach(t => expect(actReputationBar(s, t.act)).toBeLessThanOrEqual(s.company.reputation));
    }
  });
});
