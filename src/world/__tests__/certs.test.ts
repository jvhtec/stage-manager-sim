import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { buildAnnex, trainCrew } from '../actions';
import {
  CERTS,
  INSPECTION_FINE,
  certCount,
  certPenalty,
  certShortfall,
  courseBlocker,
  courseCost,
  courseDays,
  dailyCourses,
  hasCert,
  monthlyCerts,
  requiredCerts,
  startingCerts,
} from '../certs';
import { mayBoard, pickCrew } from '../people';
import { dayOf } from '../core';
import type { CrewMember, Gig, TycoonState } from '../types';

const yes = { next: () => 0, chance: () => true, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 52, country: 'GB', startYear: 1995 });
  s.company.cash = 2_000_000;
  s.people.forEach(m => (m.certs = []));
  return s;
};
const person = (s: TycoonState) => s.people.find(m => m.depotId)!;

describe('crew tickets', () => {
  it('big shows need riggers and a first aider', () => {
    expect(requiredCerts({ tier: 1 })).toEqual({ rigging: 0, safety: 0 });
    expect(requiredCerts({ tier: 2 })).toEqual({ rigging: 0, safety: 0 });
    expect(requiredCerts({ tier: 3 })).toEqual({ rigging: 1, safety: 1 });
    expect(requiredCerts({ tier: 4 })).toEqual({ rigging: 2, safety: 1 });
  });

  it('counts who is qualified and what is missing', () => {
    const crew = [{ certs: ['rigging'] }, { certs: ['safety'] }, { certs: [] }] as CrewMember[];
    expect(certCount(crew, 'rigging')).toBe(1);
    expect(certShortfall(crew, { tier: 3 })).toEqual({ rigging: 0, safety: 0 });
    expect(certShortfall(crew, { tier: 4 })).toEqual({ rigging: 1, safety: 0 });
    expect(certShortfall([], { tier: 3 })).toEqual({ rigging: 1, safety: 1 });
    expect(certShortfall([], { tier: 2 })).toEqual({ rigging: 0, safety: 0 });
  });

  it('an unticketed crew costs quality, safety and a fine', () => {
    const none = certPenalty({ rigging: 0, safety: 0 }, { fee: 10000 });
    expect(none.fine).toBe(0);
    expect(none.failureFactor).toBe(1);
    const both = certPenalty({ rigging: 1, safety: 1 }, { fee: 10000 });
    expect(both.fine).toBe(Math.round((10000 * INSPECTION_FINE * 2) / 10) * 10);
    expect(both.quality).toBeGreaterThan(0);
    expect(both.failureFactor).toBeGreaterThan(1.1);
  });

  it('hiring-market people turn up with tickets, deterministically; stage hands more often', () => {
    expect(startingCerts('crew-12', 'stage', 3)).toEqual(startingCerts('crew-12', 'stage', 3));
    let stage = 0;
    let sound = 0;
    for (let i = 0; i < 200; i++) {
      if (startingCerts(`crew-${i}`, 'stage', 2).includes('rigging')) stage++;
      if (startingCerts(`crew-${i}`, 'audio', 2).includes('rigging')) sound++;
    }
    expect(stage).toBeGreaterThan(sound * 2);
  });

  it('a course costs money, takes days and then you hold the ticket', () => {
    const s = game();
    const m = person(s);
    const cash = s.company.cash;
    const out = trainCrew(s, m.id, 'rigging');
    expect(out.result.ok).toBe(true);
    expect(cash - out.state.company.cash).toBe(courseCost(s, 'rigging'));
    const t = out.state;
    const mm = t.people.find(x => x.id === m.id)!;
    expect(mm.course?.cert).toBe('rigging');
    expect(courseBlocker(t, mm, 'safety')).toMatch(/already on a course/i);
    expect(mayBoard(mm)).toBe(false);
    const done = advanceHours(t, 24 * (CERTS.rigging.days + 1));
    const after = done.people.find(x => x.id === m.id)!;
    expect(hasCert(after, 'rigging')).toBe(true);
    expect(after.course).toBeUndefined();
    expect(done.news.some(n => /passes the rigging/.test(n.text))).toBe(true);
  });

  it('cannot train someone out on a job, someone qualified, or with no money', () => {
    const s = game();
    const m = person(s);
    m.certs = ['safety'];
    expect(courseBlocker(s, m, 'safety')).toMatch(/Already qualified/);
    const away = { ...m, depotId: undefined } as CrewMember;
    expect(courseBlocker(s, away, 'rigging')).toMatch(/out on a job/);
    s.company.cash = 10;
    expect(courseBlocker(s, m, 'rigging')).toMatch(/costs/);
  });

  it('a training room makes courses cheaper and shorter; an academy graduates apprentices', () => {
    const s = game();
    s.depots[0].kind = 'warehouse';
    s.depots[0].size = 3;
    const base = courseCost(s, 'rigging');
    const baseDays = courseDays(s, 'rigging');
    const one = buildAnnex(s, s.depots[0].id, 'academy').state;
    expect(courseCost(one, 'rigging')).toBeLessThan(base);
    expect(courseDays(one, 'rigging')).toBeLessThan(baseDays);
    const two = buildAnnex(one, one.depots[0].id, 'academy').state;
    expect(courseCost(two, 'rigging')).toBeLessThan(courseCost(one, 'rigging'));
    two.hour = 24 * 90;
    const crew = two.people.length;
    monthlyCerts(two, yes);
    expect(two.people.length).toBe(crew + 1);
    expect(two.news.some(n => /graduates from your academy/.test(n.text))).toBe(true);
    const lonely = one;
    lonely.hour = 24 * 90;
    const n = lonely.people.length;
    monthlyCerts(lonely, yes);
    expect(lonely.people.length).toBe(n);
  });

  it('ticketed people are picked first for the big shows', () => {
    const s = game();
    const [a, b] = s.people;
    b.certs = ['rigging', 'safety'];
    a.certs = [];
    const gig = { tier: 3, crewNeeded: 1, needs: { audio: 1, console: 0, lighting: 0, video: 0, stage: 0 } } as unknown as Gig;
    const picked = pickCrew([a, b], gig, 1, [], {});
    expect(picked[0].id).toBe(b.id);
    expect(dayOf(s.hour)).toBeGreaterThanOrEqual(0);
  });
});
