import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { assignVehicle, bookGig, setCrewPicks } from '../actions';
import { crewDirectives, pickCrew } from '../people';
import { projectCoverage } from '../queries';
import { HOURS_PER_DAY } from '../catalog';
import type { Gig, TycoonState } from '../types';

function scenario(): { s: TycoonState; gig: Gig } {
  let s = createTycoonGame({ companyName: 'C', color: '#f00', seed: 77, country: 'GB', startYear: 1995 });
  s = { ...s, company: { ...s.company, cash: 1_000_000 } };
  const v = s.vehicles.find(x => x.owner === 'player')!;
  const gig = s.gigs.find(g => g.status === 'offer' && g.day - s.hour / 24 > 6) ?? s.gigs.find(g => g.status === 'offer')!;
  s = bookGig(s, gig.id).state;
  s = assignVehicle(s, v.id, gig.id).state;
  return { s, gig: s.gigs.find(g => g.id === gig.id)! };
}

describe('naming the crew for a show', () => {
  it('stores nominations and rejects too many or unknown people', () => {
    const { s, gig } = scenario();
    const ids = s.people.slice(0, 2).map(m => m.id);
    const out = setCrewPicks(s, gig.id, ids);
    expect(out.result.ok).toBe(true);
    expect(out.state.gigs.find(g => g.id === gig.id)!.crewPicks).toEqual(ids);
    expect(setCrewPicks(s, gig.id, ['nobody']).result.ok).toBe(false);
    expect(setCrewPicks(s, gig.id, s.people.map(m => m.id).concat(['x'])).result.ok).toBe(false);
    expect(setCrewPicks(out.state, gig.id, []).state.gigs.find(g => g.id === gig.id)!.crewPicks).toBeUndefined();
  });

  it('named people board first, even a weak one over a star', () => {
    const { s, gig } = scenario();
    const here = s.people.filter(m => m.depotId);
    const weak = [...here].sort((a, b) => a.skills[a.primary] - b.skills[b.primary])[0];
    const dir = { prefer: new Set([weak.id]), reserved: new Set<string>() };
    const picked = pickCrew([...here], gig, 1, [], { vehicleId: 'v', ...dir });
    expect(picked.map(m => m.id)).toEqual([weak.id]);
  });

  it('people named for another booked show are held back', () => {
    const { s, gig } = scenario();
    const other = { ...gig, id: 'other', status: 'booked' as const, crewPicks: [s.people[0].id] };
    s.gigs.push(other);
    const dir = crewDirectives(s, gig);
    expect(dir.reserved.has(s.people[0].id)).toBe(true);
    const picked = pickCrew([...s.people], gig, s.people.length, [], { vehicleId: 'v', ...dir });
    expect(picked.some(m => m.id === s.people[0].id)).toBe(false);
    // …unless they are named for this show too.
    gig.crewPicks = [s.people[0].id];
    const again = crewDirectives(s, gig);
    expect(pickCrew([...s.people], gig, 1, [], { vehicleId: 'v', ...again })[0].id).toBe(s.people[0].id);
  });

  it('the forecast and the real loading both honour the picks', () => {
    const { s, gig } = scenario();
    const weak = [...s.people].sort((a, b) => a.skills[a.primary] - b.skills[b.primary])[0];
    const sg = s.gigs.find(g => g.id === gig.id)!;
    sg.crewPicks = [weak.id];
    expect(projectCoverage(s, sg).people.map(m => m.id)).toContain(weak.id);
    let out = s;
    const vid = s.vehicles.find(x => x.owner === 'player')!.id;
    for (let h = 0; h < (sg.day + 1) * HOURS_PER_DAY && !out.vehicles.find(x => x.id === vid)!.crew; h += 6) out = advanceHours(out, 6);
    const crewAboard = out.people.filter(m => m.vehicleId === vid);
    expect(crewAboard.length).toBeGreaterThan(0);
    expect(crewAboard.map(m => m.id)).toContain(weak.id);
  });
});
