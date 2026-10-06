import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { worldOf } from '../mapgen';
import { assignTech, assignVehicle, bookGig, hireTech, releaseTech } from '../actions';
import { advanceHours } from '../sim';
import { STAR_TECHS, techBonus, techsActiveIn } from '../content/techs';
import { HOURS_PER_DAY, SHOW_END_HOUR } from '../catalog';
import { projectCoverage } from '../queries';
import type { Gig, TycoonState } from '../types';

const rich = (startYear = 1990): TycoonState => {
  const s = createTycoonGame({ companyName: 'T', color: '#f00', seed: 8, country: 'GB', startYear });
  return { ...s, company: { ...s.company, cash: 50_000_000 } };
};

function plant(s: TycoonState, act: string): { state: TycoonState; gig: Gig } {
  const world = worldOf(s);
  const hq = world.cityById.get(s.company.hqCityId)!;
  const venue = hq.venues.find(v => v.tier === 1)!;
  const day = Math.floor(s.hour / HOURS_PER_DAY) + 3;
  const gig: Gig = {
    id: 'tg', act, venueId: venue.id, cityId: hq.id, tier: 1, day, acceptByDay: day - 1,
    needs: { audio: 2, console: 1, lighting: 1, video: 0, stage: 1 }, crewNeeded: 2, fee: 4000, status: 'offer',
    // An unmet rider keeps the show below 100% so there's room for the tech to lift it.
    rider: { dept: 'audio', brand: 'Meyer Sound' },
  };
  const next = bookGig({ ...s, gigs: [...s.gigs, gig] }, 'tg').state;
  return { state: next, gig };
}

describe('star techs', () => {
  it('only offers names whose careers are live', () => {
    const names1975 = techsActiveIn(1975, 'GB').map(t => t.id);
    expect(names1975).toContain('bruce-jackson');
    expect(names1975).not.toContain('es-devlin');
    expect(techsActiveIn(2010, 'GB').map(t => t.id)).toContain('es-devlin');
    expect(techsActiveIn(2010, 'GB').map(t => t.id)).not.toContain('bruce-jackson');
    expect(hireTech(rich(1975), 'es-devlin').result.ok).toBe(false);
    STAR_TECHS.forEach(t => expect(t.from).toBeLessThan(t.to));
  });

  it('lifts shows they are physically at — more for acts they are known for', () => {
    expect(techBonus(['joe-oherlihy'], 'U2')).toBeGreaterThan(techBonus(['joe-oherlihy'], 'Oasis'));
    let s = rich();
    s = hireTech(s, 'joe-oherlihy').state;
    const planted = plant(s, 'U2');
    s = planted.state;
    const truck = s.vehicles.find(v => v.modelId === 'luton-box')!;
    s = assignVehicle(s, truck.id, 'tg').state;
    const without = projectCoverage(s, planted.gig).expectedQuality;
    s = assignTech(s, 'joe-oherlihy', truck.id).state;
    const withTech = projectCoverage(s, s.gigs.find(g => g.id === 'tg')!).expectedQuality;
    expect(withTech).toBeGreaterThan(without);
    s = advanceHours(s, planted.gig.day * HOURS_PER_DAY + SHOW_END_HOUR - s.hour);
    expect(s.gigs.find(g => g.id === 'tg')!.result!.techs).toEqual(['joe-oherlihy']);
  });

  it('costs wages every day, and retires at the end of the career', () => {
    let s = rich(1990);
    s = hireTech(s, 'bruce-jackson').state;
    const cash = s.company.cash;
    s = advanceHours(s, 24 * 2);
    expect(cash - s.company.cash).toBeGreaterThan(380 * 2);
    s = advanceHours(s, 24 * 365 * 6);
    expect(s.techs.some(t => t.techId === 'bruce-jackson')).toBe(false);
    expect(releaseTech(s, 'bruce-jackson').result.ok).toBe(false);
  });
});
