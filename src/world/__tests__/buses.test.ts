import { describe, expect, it } from 'vitest';
import { createTycoonGame, makeVehicle } from '../state';
import { advanceHours } from '../sim';
import { hireOutBus } from '../actions';
import { busHireBlocker, dailyBusOffers, freeBuses, hireNet } from '../buses';
import { createRng } from '@/lib/rng';
import { dayOf } from '../core';
import type { TycoonState } from '../types';

function game(): TycoonState {
  let s = createTycoonGame({ companyName: 'B', color: '#f00', seed: 4, country: 'GB', startYear: 1990 });
  s = { ...s, company: { ...s.company, cash: 2_000_000, reputation: 60 } };
  s.vehicles.push(makeVehicle(s, 'duple-coach', s.depots[0].cityId));
  return s;
}

describe('tour bus hire', () => {
  it('turns up contracts, and an idle coach can take one', () => {
    const s = game();
    const rng = createRng(1);
    for (let i = 0; i < 200 && !s.busHires.some(h => h.status === 'offer'); i++) dailyBusOffers(s, rng);
    const offer = s.busHires.find(h => h.status === 'offer')!;
    expect(offer).toBeDefined();
    const bus = freeBuses(s)[0];
    expect(bus).toBeDefined();
    expect(busHireBlocker(s, offer, bus)).toBeNull();
    const out = hireOutBus(s, offer.id, bus.id);
    expect(out.result.ok).toBe(true);
    expect(out.state.vehicles.find(v => v.id === bus.id)!.status).toBe('hired-out');
    expect(hireNet(offer)).toBeGreaterThan(0);
  });

  it('a vehicle that is not a bus cannot go on tour', () => {
    const s = game();
    s.busHires.push({ id: 'h1', act: 'Test', tier: 1, days: 10, rate: 200, startDay: dayOf(s.hour) + 8, acceptByDay: dayOf(s.hour) + 5, status: 'offer' });
    const van = s.vehicles.find(v => v.owner === 'player' && v.modelId !== 'duple-coach')!;
    expect(busHireBlocker(s, s.busHires[0], van)).toMatch(/coach or sleeper/);
  });

  it('pays a day rate while on tour, less the driver, then comes home', () => {
    let s = game();
    const bus = freeBuses(s)[0];
    s.busHires.push({ id: 'h1', act: 'The Tourists', tier: 2, days: 12, rate: 250, startDay: dayOf(s.hour) + 4, acceptByDay: dayOf(s.hour) + 2, status: 'offer' });
    s = hireOutBus(s, 'h1', bus.id).state;
    const before = s.ledger[1990]?.busHire ?? 0;
    s = advanceHours(s, 24 * 30);
    const hire = s.busHires.find(h => h.id === 'h1')!;
    expect(hire.status).toBe('done');
    expect((s.ledger[1990]?.busHire ?? 0) - before).toBeGreaterThan(250 * 10);
    expect(hire.earned).toBeGreaterThan(0);
    const back = s.vehicles.find(v => v.id === bus.id)!;
    expect(back.status).not.toBe('hired-out');
  });

  it('contracts left on the table go to a rival', () => {
    let s = game();
    s.busHires.push({ id: 'h2', act: 'Late Night Act', tier: 1, days: 10, rate: 150, startDay: dayOf(s.hour) + 12, acceptByDay: dayOf(s.hour) + 8, status: 'offer' });
    s = advanceHours(s, 24 * 14);
    expect(s.busHires.find(h => h.id === 'h2')!.status).toBe('lost');
  });
});
