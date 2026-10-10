import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { assignVehicle, bookGig, makeDecision } from '../actions';
import { HOURS_PER_DAY } from '../catalog';
import { dayOf } from '../core';
import { checkInvariants, type Violation } from '../invariants';
import type { CountryCode } from '../content/countries';
import { monthlyRivals } from '../rivals';
import { createRng } from '@/lib/rng';
import type { TycoonState } from '../types';

/** A plain operator: books what it can reach, sends a free truck, answers decisions with the default. */
function operate(s: TycoonState): TycoonState {
  const today = dayOf(s.hour);
  for (const d of [...s.dilemmas]) s = makeDecision(s, d.id, d.defaultOption).state;
  for (const g of s.gigs.filter(x => x.status === 'offer' && !x.tourId && !x.event && x.day - today >= 3).slice(0, 4)) {
    const booked = bookGig(s, g.id);
    if (!booked.result.ok) continue;
    const truck = booked.state.vehicles.find(v => v.owner === 'player' && v.orders.length === 0 && v.status === 'parked');
    if (!truck) continue;
    const assigned = assignVehicle(booked.state, truck.id, g.id);
    s = assigned.result.ok ? assigned.state : booked.state;
  }
  return s;
}

function run(country: CountryCode, year: number, months: number): Violation[] {
  let s = createTycoonGame({ companyName: 'Inv', color: '#f00', seed: 11, country, startYear: year });
  const found: Violation[] = [];
  for (let m = 0; m < months && !s.gameOver; m++) {
    for (let w = 0; w < 4; w++) {
      s = operate(s);
      s = advanceHours(s, 7.5 * HOURS_PER_DAY);
    }
    checkInvariants(s).forEach(v => found.push({ ...v, message: `month ${m}: ${v.message}` }));
  }
  return found;
}

describe('simulation invariants', () => {
  it('a fresh game is consistent', () => {
    expect(checkInvariants(createTycoonGame({ companyName: 'I', color: '#f00', seed: 3, country: 'ES', startYear: 1990 }))).toEqual([]);
  });

  it.each([
    ['GB', 1995],
    ['ES', 1985],
    ['DE', 2005],
    ['US', 2010],
  ] as [CountryCode, number][])('money, kit, vehicles, contracts and people stay consistent through %s %i', (country, year) => {
    const v = run(country, year, 18);
    expect(v.slice(0, 10)).toEqual([]);
  }, 60_000);

  it('a firm that goes under hands its shows back: none left held by a ghost', () => {
    const s = createTycoonGame({ companyName: 'I', color: '#f00', seed: 3, country: 'GB', startYear: 1995 });
    const r = s.rivals[0];
    const g = s.gigs.find(x => x.status === 'offer')!;
    g.status = 'rival';
    g.rivalId = r.id;
    r.reputation = 10;
    for (let i = 0; i < 6 && s.rivals.some(x => x.id === r.id); i++) {
      r.health = -999;
      monthlyRivals(s, createRng(i));
    }
    expect(s.rivals.some(x => x.id === r.id)).toBe(false);
    expect(checkInvariants(s)).toEqual([]);
    expect(['offer', 'expired']).toContain(g.status);
  });

  it('catches money moving outside the books', () => {
    const s = createTycoonGame({ companyName: 'I', color: '#f00', seed: 3, country: 'GB', startYear: 1990 });
    s.company.cash += 500;
    expect(checkInvariants(s).some(v => v.kind === 'money')).toBe(true);
  });

  it('catches a person in two places and a negative stock', () => {
    const s = createTycoonGame({ companyName: 'I', color: '#f00', seed: 3, country: 'GB', startYear: 1990 });
    s.people[0].vehicleId = s.vehicles.find(v => v.owner === 'player')!.id;
    const id = Object.keys(s.depots[0].gear)[0];
    s.depots[0].gear[id] = -1;
    const kinds = checkInvariants(s).map(v => v.kind);
    expect(kinds).toContain('personnel');
    expect(kinds).toContain('equipment');
  });
});
