import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { bookGig, bookTour, buildAnnex, rehearseShow } from '../actions';
import { gigBookingBar, tourBookingBar } from '../standing';
import { advanceHours } from '../sim';
import {
  UNREHEARSED_FAILURE,
  UNREHEARSED_QUALITY,
  dailyRehearsals,
  rehearsalBlocker,
  requiredStageLevel,
  stageBlocker,
  tourStageLevel,
  unrehearsed,
} from '../annexes';
import { dayOf } from '../core';
import type { Gig, TycoonState } from '../types';

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 17, country: 'GB', startYear: 1995 });
  s.company.cash = 5_000_000;
  s.company.reputation = 95;
  return s;
};
const gigAt = (s: TycoonState, extra: Partial<Gig>): Gig => {
  const g = { id: 'x' + s.gigs.length, act: 'Local Band', status: 'offer', tier: 3, fee: 9000, day: dayOf(s.hour) + 12, acceptByDay: dayOf(s.hour) + 8, venueId: 'v', cityId: s.depots[0].cityId, needs: { audio: 1, console: 0, lighting: 0, video: 0, stage: 0 }, crewNeeded: 1, ...extra } as Gig;
  s.gigs.push(g);
  return g;
};
const withStage = (s: TycoonState, levels: number) => {
  s.depots[0].kind = 'warehouse';
  s.depots[0].size = 4;
  let cur = s;
  for (let i = 0; i < levels; i++) cur = buildAnnex(cur, cur.depots[0].id, 'rehearsal').state;
  return cur;
};

describe('required rehearsals', () => {
  it('shows need a stage by size: arenas a room, stadiums and events a soundstage, world tours a hall', () => {
    const s = game();
    expect(requiredStageLevel(s, gigAt(s, { tier: 1 }))).toBe(0);
    expect(requiredStageLevel(s, gigAt(s, { tier: 2 }))).toBe(0);
    expect(requiredStageLevel(s, gigAt(s, { tier: 3 }))).toBe(1);
    expect(requiredStageLevel(s, gigAt(s, { tier: 4 }))).toBe(2);
    expect(requiredStageLevel(s, gigAt(s, { tier: 3, event: { scale: 3, citywide: false } as never }))).toBe(2);
    expect(requiredStageLevel(s, gigAt(s, { tier: 3, festival: { main: true } as never }))).toBe(0);
    expect(tourStageLevel('world', 2)).toBe(3);
    expect(tourStageLevel('national', 4)).toBe(3);
    expect(tourStageLevel('national', 3)).toBe(2);
    expect(tourStageLevel('national', 2)).toBe(1);
    expect(tourStageLevel('national', 1)).toBe(0);
  });

  it('cannot be booked without a big enough stage, then can', () => {
    const s = game();
    const g = gigAt(s, { tier: 3 });
    const bar = gigBookingBar(s, g);
    expect(bar.stage).toBe(true);
    expect(bar.reason).toMatch(/rehearsal room/);
    expect(bookGig(s, g.id).result.ok).toBe(false);
    const t = withStage(game(), 1);
    const g2 = gigAt(t, { tier: 3 });
    expect(gigBookingBar(t, g2).reason).toBeNull();
    expect(bookGig(t, g2.id).result.ok).toBe(true);
    // A bigger show wants a bigger stage.
    const g3 = gigAt(t, { tier: 4 });
    expect(gigBookingBar(t, g3).reason).toMatch(/soundstage/);
    const u = withStage(game(), 2);
    expect(gigBookingBar(u, gigAt(u, { tier: 4 })).reason).toBeNull();
  });

  it('reputation still comes first, and small shows are untouched', () => {
    const s = game();
    s.company.reputation = 1;
    const bar = gigBookingBar(s, gigAt(s, { tier: 3 }));
    expect(bar.stage).toBeUndefined();
    expect(bar.reason).toMatch(/reputation/);
    const t = game();
    expect(gigBookingBar(t, gigAt(t, { tier: 2 })).reason).toBeNull();
  });

  it('needs time to rehearse before the date', () => {
    const t = withStage(game(), 1);
    expect(stageBlocker(t, 1, dayOf(t.hour) + 1)).toMatch(/Too late/);
    expect(stageBlocker(t, 1, dayOf(t.hour) + 10)).toBeNull();
    expect(stageBlocker(t, 0, dayOf(t.hour))).toBeNull();
  });

  it('a tour needs the stage too', () => {
    const s = game();
    const legs = [0, 1].map(i => gigAt(s, { tier: 3, tourId: 'T', day: dayOf(s.hour) + 12 + i * 3 }));
    const tour = { id: 'T', act: 'Local Band', name: 'Tour', kind: 'national', gigIds: legs.map(l => l.id), bonus: 0, acceptByDay: dayOf(s.hour) + 8, status: 'offer' } as never;
    s.tours.push(tour);
    expect(tourBookingBar(s, tour, 3).stage).toBe(true);
    expect(bookTour(s, 'T').result.ok).toBe(false);
    const t = withStage(s, 2);
    expect(tourBookingBar(t, t.tours[0], 3).reason).toBeNull();
  });

  it('an unrehearsed show suffers; a rehearsed one does not', () => {
    const s = withStage(game(), 1);
    const g = gigAt(s, { tier: 3, status: 'booked' });
    expect(unrehearsed(s, g)).toBe(true);
    expect(UNREHEARSED_QUALITY).toBeGreaterThan(0);
    expect(UNREHEARSED_FAILURE).toBeGreaterThan(1);
    const out = rehearseShow(s, g.id).state;
    expect(unrehearsed(out, out.gigs.find(x => x.id === g.id)!)).toBe(false);
    const small = gigAt(s, { tier: 2, status: 'booked' });
    expect(unrehearsed(s, small)).toBe(false);
  });

  it('the stage has to be big enough for the show it rehearses', () => {
    const s = withStage(game(), 1);
    const g = gigAt(s, { tier: 4, status: 'booked', day: dayOf(s.hour) + 10 });
    expect(rehearsalBlocker(s, g.id)).toMatch(/too small/);
  });

  it('automatic rehearsal books them in the fortnight before; manual only nags', () => {
    const auto = withStage(game(), 1);
    auto.policies.rehearsal = 'auto';
    const g = gigAt(auto, { tier: 3, status: 'booked', day: dayOf(auto.hour) + 10 });
    dailyRehearsals(auto);
    expect(auto.gigs.find(x => x.id === g.id)!.rehearsed).toBe(1);

    const manual = withStage(game(), 1);
    const m = gigAt(manual, { tier: 3, status: 'booked', day: dayOf(manual.hour) + 7 });
    dailyRehearsals(manual);
    expect(manual.gigs.find(x => x.id === m.id)!.rehearsed).toBeUndefined();
    expect(manual.news.some(n => /hasn't rehearsed/.test(n.text))).toBe(true);
  });

  it('runs through the clock: auto rehearsal happens before the show', () => {
    const s = withStage(game(), 1);
    s.policies.rehearsal = 'auto';
    const g = gigAt(s, { tier: 3, status: 'booked', day: dayOf(s.hour) + 8 });
    const later = advanceHours(s, 24 * 3);
    expect(later.gigs.find(x => x.id === g.id)!.rehearsed).toBe(1);
  });
});
