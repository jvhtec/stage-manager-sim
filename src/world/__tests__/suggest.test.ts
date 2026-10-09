import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { bookAndAssign } from '../actions';
import { SUGGEST_RANGE, suggestJobs } from '../queries';
import { roadDistance } from '../pathfinding';
import { worldOf } from '../mapgen';
import type { TycoonState } from '../types';

const game = (): TycoonState => {
  let s = createTycoonGame({ companyName: 'S', color: '#f00', seed: 31, country: 'GB', startYear: 1995 });
  s = { ...s, company: { ...s.company, cash: 2_000_000, reputation: 40 } };
  return advanceHours(s, 24 * 12); // let offers pile up
};

describe('suggested next jobs', () => {
  it('offers bookable shows near the truck, best fee-for-the-driving first', () => {
    const s = game();
    const v = s.vehicles.find(x => x.owner === 'player')!;
    const picks = suggestJobs(s, v, 5);
    expect(picks.length).toBeGreaterThan(0);
    const world = worldOf(s);
    picks.forEach(p => {
      expect(p.gig.status).toBe('offer');
      expect(roadDistance(world, v.homeCityId, p.gig.cityId)).toBeLessThanOrEqual(SUGGEST_RANGE);
    });
    for (let i = 1; i < picks.length; i++) expect(picks[i - 1].score).toBeGreaterThanOrEqual(picks[i].score);
  });

  it('books and assigns in one go', () => {
    const s = game();
    const v = s.vehicles.find(x => x.owner === 'player')!;
    const pick = suggestJobs(s, v, 1)[0];
    const out = bookAndAssign(s, v.id, pick.gig.id);
    expect(out.result.ok).toBe(true);
    expect(out.state.gigs.find(g => g.id === pick.gig.id)!.status).toBe('booked');
    expect(out.state.vehicles.find(x => x.id === v.id)!.orders).toContain(pick.gig.id);
    // Once it's on the truck it stops being suggested.
    const after = out.state.vehicles.find(x => x.id === v.id)!;
    expect(suggestJobs(out.state, after, 10).some(p => p.gig.id === pick.gig.id)).toBe(false);
  });

  it('leaves everything untouched when the booking fails', () => {
    const s = game();
    const v = s.vehicles.find(x => x.owner === 'player')!;
    const pick = suggestJobs(s, v, 1)[0];
    s.gigs = s.gigs.map(g => (g.id === pick.gig.id ? { ...g, acceptByDay: -1 } : g));
    const out = bookAndAssign(s, v.id, pick.gig.id);
    expect(out.result.ok).toBe(false);
    expect(out.state.gigs.find(g => g.id === pick.gig.id)!.status).toBe('offer');
  });

  it('suggests nothing for a rival truck', () => {
    const s = game();
    const rival = s.vehicles.find(x => x.owner !== 'player');
    if (rival) expect(suggestJobs(s, rival)).toEqual([]);
  });
});
