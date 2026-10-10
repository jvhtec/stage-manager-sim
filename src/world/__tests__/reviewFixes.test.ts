import { describe, expect, it } from 'vitest';
import { createTycoonGame, makeVehicle } from '../state';
import { advanceHours } from '../sim';
import { HOURS_PER_DAY } from '../catalog';
import { eventStartDay } from '../events';
import { getEvent } from '../content/events';
import { forecastCash } from '../cashflow';
import { worldOf } from '../mapgen';
import { resolveChange } from '../changes';
import { dailyBusHire } from '../buses';
import { generateNationalTour } from '../tours';
import { afterDisaster } from '../blacklist';
import { gigBookingBar } from '../standing';
import { dayOf } from '../core';
import { createRng } from '@/lib/rng';
import type { Gig, TycoonState } from '../types';
import type { CountryCode } from '../content/countries';

const game = (country: CountryCode = 'GB', year = 1995): TycoonState => {
  const s = createTycoonGame({ companyName: 'R', color: '#f00', seed: 7, country, startYear: year });
  s.company.cash = 5_000_000;
  return s;
};

describe('review fixes', () => {
  it('event lots only carry their own department’s rider, and no booking terms', () => {
    let s = game('GB', 1985);
    s = advanceHours(s, (eventStartDay(s, getEvent('liveaid-uk')!, 1985) - 30) * HOURS_PER_DAY);
    const lots = s.gigs.filter(g => g.event?.id === 'liveaid-uk');
    expect(lots.length).toBeGreaterThan(1);
    lots.forEach(g => {
      expect(g.terms).toBeUndefined();
      if (g.event!.lot !== 'audio') expect(g.techSpec).toBeUndefined();
    });
  });

  it('the cash forecast counts the daily payroll', () => {
    const s = game();
    const withCrew = forecastCash(s, worldOf(s));
    const noCrew = forecastCash({ ...s, people: [], techs: [] }, worldOf(s));
    expect(noCrew.weeks[7].expected - withCrew.weeks[7].expected).toBeGreaterThan(0);
  });

  it('a banned act cannot be booked from an old offer, and banned venues drop off tour routes', () => {
    const s = game();
    const offer = s.gigs.find(g => g.status === 'offer')!;
    afterDisaster(s, { ...offer, status: 'failed' } as Gig, 'X, Y', 0);
    expect(gigBookingBar(s, offer).reason).toMatch(/won't work with you|won't book you/);
    // Ban every venue: no national tour can be routed.
    const w = worldOf(s);
    s.blacklist = Object.fromEntries(w.cities.flatMap(c => c.venues).map(v => [`venue:${v.id}`, dayOf(s.hour) + 999]));
    const rng = createRng(3);
    for (let i = 0; i < 20; i++) expect(generateNationalTour(s, w, rng)).toBeNull();
  });

  it('an accepted change quote still pays for the overtime', () => {
    const s = game();
    const gig = { id: 'g', act: 'Blur', tier: 2, fee: 10_000, crewNeeded: 6, cityId: 'c' } as unknown as Gig;
    const cash = s.company.cash;
    resolveChange(s, gig, 'hour', 'charge', { chance: () => true } as never);
    expect(gig.fee).toBeGreaterThan(10_000);
    expect(s.company.cash).toBeLessThan(cash);
  });

  it('a bus hired for N days is paid N times and comes back on day N', () => {
    const s = game('GB', 1990);
    s.vehicles.push(makeVehicle(s, 'duple-coach', s.depots[0].cityId));
    const bus = s.vehicles[s.vehicles.length - 1];
    bus.status = 'hired-out';
    const today = dayOf(s.hour);
    s.busHires.push({ id: 'h', act: 'Test', tier: 1, days: 3, rate: 100, startDay: today, acceptByDay: today, status: 'active', vehicleId: bus.id } as never);
    const never = { chance: () => false } as never;
    let paid = 0;
    for (let d = 0; d < 6; d++) {
      const before = s.ledger[1990]?.busHire ?? 0;
      dailyBusHire(s, never);
      if ((s.ledger[1990]?.busHire ?? 0) > before) paid++;
      if (d === 2) expect(s.busHires[0].status).toBe('active');
      s.hour += 24;
    }
    expect(paid).toBe(3);
    expect(s.busHires[0].status).toBe('done');
  });
});
