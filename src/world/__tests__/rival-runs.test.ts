import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { RIVAL_RUN_DAYS, RIVAL_RUN_TILES, rivalNearbyDates, rivalsTakeOffers } from '../offers';
import { dayOf } from '../core';
import { worldOf } from '../mapgen';
import { roadDistance } from '../pathfinding';
import type { Gig, TycoonState, Vehicle } from '../types';

function setup() {
  const s: TycoonState = createTycoonGame({ companyName: 'R', color: '#f00', seed: 19, country: 'GB', startYear: 1995 });
  const world = worldOf(s);
  const rival = s.rivals[0];
  rival.minTier = 1;
  rival.maxTier = 4;
  s.rivals = [rival]; // one rival, so chances are comparable
  s.gigs = [];
  s.vehicles = s.vehicles.filter(v => v.owner === 'player');
  const base = createTycoonGame({ companyName: 'R', color: '#f00', seed: 19, country: 'GB', startYear: 1995 });
  const today = dayOf(s.hour);
  // Two towns close together, and one far away.
  let near: [string, string] | null = null;
  for (const a of world.cities) for (const b of world.cities) if (!near && a.id !== b.id && roadDistance(world, a.id, b.id) <= RIVAL_RUN_TILES && roadDistance(world, a.id, b.id) > 12) near = [a.id, b.id];
  const far = world.cities.find(c => roadDistance(world, near![0], c.id) > RIVAL_RUN_TILES + 20)!;
  const template = base.gigs.find(g => g.status === 'offer')!;
  const mk = (id: string, cityId: string, day: number, status: Gig['status'] = 'offer'): Gig => {
    const venue = world.cityById.get(cityId)!.venues.find(v => v.kind !== 'airport')!;
    return { ...template, id, cityId, venueId: venue.id, day, tier: 1, acceptByDay: today + 30, status, tourId: undefined, festival: undefined, event: undefined, overseas: undefined, asksForYou: false };
  };
  return { s, world, rival, today, near: near!, far: far.id, mk };
}
const record = (calls: number[]) =>
  ({ next: () => 0.5, chance: (p: number) => (calls.push(p), false), pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a }) as never;

describe('rivals string runs together', () => {
  it('finds the dates a rival already holds nearby, within a few days', () => {
    const { s, world, rival, today, near, far, mk } = setup();
    const held = mk('held', near[0], today + 10, 'rival');
    held.rivalId = rival.id;
    s.gigs.push(held);
    expect(rivalNearbyDates(s, world, rival.id, mk('a', near[1], today + 10 + RIVAL_RUN_DAYS)).map(g => g.id)).toEqual(['held']);
    expect(rivalNearbyDates(s, world, rival.id, mk('b', near[1], today + 10 + RIVAL_RUN_DAYS + 1))).toEqual([]);
    expect(rivalNearbyDates(s, world, rival.id, mk('c', far, today + 11))).toEqual([]);
    expect(rivalNearbyDates(s, world, 'someone-else', mk('d', near[1], today + 11))).toEqual([]);
  });

  it('are likelier to land the next date in an area they already work', () => {
    const { s, world, rival, today, near, mk } = setup();
    const offer = mk('offer', near[1], today + 12);
    const lone = structuredClone(s);
    lone.gigs.push(offer);
    const a: number[] = [];
    rivalsTakeOffers(lone, world, record(a));
    const working = structuredClone(s);
    const held = mk('held', near[0], today + 10, 'rival');
    held.rivalId = rival.id;
    working.gigs.push(held, mk('offer', near[1], today + 12));
    const b: number[] = [];
    rivalsTakeOffers(working, world, record(b));
    // The same rival's chance is up by the run bonus.
    expect(Math.max(...b)).toBeGreaterThan(Math.max(...a) * 1.3);
  });

  it('put the new date on the same truck when the timing allows', () => {
    const { s, world, rival, today, near, mk } = setup();
    const held = mk('held', near[0], today + 10, 'rival');
    held.rivalId = rival.id;
    const truck: Vehicle = {
      id: 'rv-1', owner: rival.id, modelId: 'luton-box', name: 'T', homeCityId: rival.hqCityId, boughtHour: 0, reliability: 90, lastServiceHour: 0,
      status: 'parked', cityId: rival.hqCityId, orders: ['held'], cargo: {}, crew: 0, profitThisYear: 0, profitLastYear: 0,
    };
    s.vehicles.push(truck);
    s.gigs.push(held, mk('next', near[1], today + 13));
    const always = { next: () => 0.5, chance: () => true, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;
    const trucks = s.vehicles.filter(v => v.owner === rival.id).length;
    rivalsTakeOffers(s, world, always);
    const next = s.gigs.find(g => g.id === 'next')!;
    expect(next.status).toBe('rival');
    // Whoever took it, if it was this rival the truck carries both; no extra truck was sent.
    if (next.rivalId === rival.id) {
      expect(s.vehicles.find(v => v.id === 'rv-1')!.orders).toEqual(['held', 'next']);
      expect(s.vehicles.filter(v => v.owner === rival.id).length).toBe(trucks);
      expect(s.news.some(n => /strings/.test(n.text))).toBe(true);
    }
  });

  it('send a second truck when the dates are too close to drive between', () => {
    const { s, world, rival, today, near, mk } = setup();
    const held = mk('held', near[0], today + 10, 'rival');
    held.rivalId = rival.id;
    s.vehicles.push({
      id: 'rv-1', owner: rival.id, modelId: 'luton-box', name: 'T', homeCityId: rival.hqCityId, boughtHour: 0, reliability: 90, lastServiceHour: 0,
      status: 'parked', cityId: rival.hqCityId, orders: ['held'], cargo: {}, crew: 0, profitThisYear: 0, profitLastYear: 0,
    } as Vehicle);
    // Same day, towns more than 8 tiles apart: one truck can't do both.
    s.gigs.push(held, mk('clash', near[1], today + 10));
    const always = { next: () => 0.5, chance: () => true, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;
    rivalsTakeOffers(s, world, always);
    expect(s.vehicles.find(v => v.id === 'rv-1')!.orders).toEqual(['held']);
  });
});
