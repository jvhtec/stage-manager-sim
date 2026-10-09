import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { retrofitVehicle } from '../actions';
import { HOURS_PER_DAY } from '../catalog';
import { emissionClassIn, zoneIn, zonesStarting, ZONES } from '../content/regulations';
import { MAX_RETROFITS, chargeZones, retrofitBlocker, retrofitCost, vehicleClass, yearlyZones, zoneBill } from '../regulation';
import { estimateJobCosts, projectCoverage } from '../queries';
import { fleetSummary } from '../fleetReport';
import { worldOf } from '../mapgen';
import { COUNTRIES } from '../content/countries';
import type { Gig, TycoonState } from '../types';

const game = (country: TycoonState['country'] = 'GB', startYear = 2010): TycoonState => {
  const s = createTycoonGame({ companyName: 'Z', color: '#f00', seed: 9, country, startYear });
  return { ...s, company: { ...s.company, cash: 2_000_000 } };
};
/** A booked gig in a London-style zone town, with the first truck assigned. */
function inZone(s: TycoonState, townName: string): Gig {
  const world = worldOf(s);
  const city = world.cities.find(c => c.name === townName)!;
  const venue = city.venues.find(v => v.kind !== 'airport')!;
  const tpl = s.gigs.find(g => g.status === 'offer')!;
  const gig: Gig = { ...tpl, id: 'zone-gig', cityId: city.id, venueId: venue.id, day: 20, status: 'booked', tourId: undefined, festival: undefined, event: undefined, overseas: undefined, days: 2 };
  s.gigs.push(gig);
  s.vehicles.find(v => v.owner === 'player')!.orders = [gig.id];
  return gig;
}

describe('low-emission zones', () => {
  it('emission class climbs with the year a vehicle was built', () => {
    expect([1980, 1992, 1996, 2000, 2005, 2009, 2014].map(emissionClassIn)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('zones switch on in their year and the strictest rule wins', () => {
    expect(zoneIn('GB', 'London', 2007)).toBeUndefined();
    expect(zoneIn('GB', 'London', 2008)!.minClass).toBe(3);
    expect(zoneIn('GB', 'London', 2020)!.minClass).toBe(5);
    expect(zoneIn('GB', 'Leeds', 2020)).toBeUndefined();
    expect(zonesStarting('ES', 2018).map(z => z.name)).toContain('Madrid Central');
  });

  it('every zone town exists in that country’s town list', () => {
    COUNTRIES.forEach(c => ZONES[c.code].forEach(z => z.cities.forEach(city => expect(c.cities.map(([n]) => n), `${c.code} ${city}`).toContain(city))));
  });

  it('charges a vehicle below the class, per show day — and spares a compliant one', () => {
    const s = game('GB', 2010);
    const gig = inZone(s, 'London');
    const v = s.vehicles.find(x => x.owner === 'player')!;
    v.boughtHour = -24 * 365 * 6; // an old truck (built ~2004: class 3), now in ULEZ era
    s.hour = 0;
    // 2010: LEZ needs class 3 → this is fine… but make the show late enough for the ULEZ.
    gig.day = 365 * 10 + 20;
    const bill = zoneBill(s, v, gig)!;
    expect(bill.zone.minClass).toBe(5);
    expect(bill.days).toBe(2);
    expect(bill.total).toBe(bill.perDay * 2);
    const cash = s.company.cash;
    chargeZones(s, gig, [v]);
    expect(cash - s.company.cash).toBe(bill.total);
    expect(s.news[0].text).toMatch(/ULEZ/);
    // A new truck is fine.
    v.boughtHour = gig.day * 24 - 24;
    expect(zoneBill(s, v, gig)).toBeNull();
  });

  it('retrofitting adds a class, costs money, and can clear a charge', () => {
    const s = game('GB', 2010);
    const gig = inZone(s, 'London');
    const v = s.vehicles.find(x => x.owner === 'player')!;
    v.boughtHour = -24 * 365 * 6;
    gig.day = 365 * 9 + 20; // 2019: ULEZ needs class 5
    const before = vehicleClass(v, s);
    expect(before).toBeLessThan(5);
    let t: TycoonState = s;
    const cash = t.company.cash;
    for (let i = 0; i < MAX_RETROFITS; i++) {
      const out = retrofitVehicle(t, v.id);
      if (!out.result.ok) break;
      t = out.state;
    }
    const after = t.vehicles.find(x => x.id === v.id)!;
    expect(vehicleClass(after, t)).toBeGreaterThan(before);
    expect(cash - t.company.cash).toBeGreaterThan(0);
    expect(retrofitBlocker(t, after)).toMatch(/already|depot|costs/);
    expect(retrofitCost(v)).toBeGreaterThan(0);
  });

  it('shows up in the job estimate and the fleet alerts', () => {
    const s = game('GB', 2010);
    const gig = inZone(s, 'London');
    const v = s.vehicles.find(x => x.owner === 'player')!;
    v.boughtHour = -24 * 365 * 6;
    gig.day = 365 * 9 + 20;
    s.hour = 24 * 365 * 9;
    const costs = estimateJobCosts(s, gig, projectCoverage(s, gig));
    expect(costs.zones).toBeGreaterThan(0);
    expect(fleetSummary(s).alerts.some(a => a.vehicleId === v.id && /ULEZ/.test(a.text))).toBe(true);
  });

  it('announces new rules at New Year', () => {
    const s = game('ES', 2017);
    yearlyZones(s, 2018);
    expect(s.news.some(n => /Madrid Central/.test(n.text))).toBe(true);
  });

  it('works through a whole game without trouble', () => {
    const s = game('ES', 2016);
    const out = advanceHours(s, 365 * 3 * HOURS_PER_DAY);
    expect(out.hour).toBeGreaterThan(s.hour);
  });
});
