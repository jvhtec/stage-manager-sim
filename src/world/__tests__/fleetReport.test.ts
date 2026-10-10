import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { assignVehicle, bookGig } from '../actions';
import { SERVICE_INTERVAL_DAYS } from '../catalog';
import { START_UTILISATION, UTIL_DAYS, dailyUtilisation, fleetSummary, utilisationOf } from '../fleetReport';
import type { TycoonState } from '../types';

const game = (): TycoonState => {
  let s = createTycoonGame({ companyName: 'F', color: '#f00', seed: 31, country: 'GB', startYear: 1995 });
  s = { ...s, company: { ...s.company, cash: 2_000_000, reputation: 40 } };
  return advanceHours(s, 24 * 16);
};

/** A plain offer a few days out that a well-known company can book. */
const bookable = (s: TycoonState) =>
  s.gigs.find(
    g =>
      g.status === 'offer' &&
      !g.tourId &&
      g.day - s.hour / 24 > 3 &&
      g.day - s.hour / 24 < 14 &&
      bookGig({ ...s, company: { ...s.company, reputation: 90 } }, g.id).result.ok,
  )!;

describe('fleet dashboard', () => {
  it('starts every vehicle at a neutral utilisation, then tracks how busy it is', () => {
    const s = game();
    const v = s.vehicles.find(x => x.owner === 'player')!;
    v.util = undefined;
    expect(utilisationOf(v)).toBe(START_UTILISATION);
    // Parked, no orders: drifts down. Working: drifts up.
    v.orders = [];
    v.status = 'parked';
    for (let i = 0; i < UTIL_DAYS; i++) dailyUtilisation(s);
    expect(v.util!).toBeLessThan(0.25);
    v.status = 'driving';
    for (let i = 0; i < UTIL_DAYS * 2; i++) dailyUtilisation(s);
    expect(v.util!).toBeGreaterThan(0.8);
  });

  it('summarises the fleet: counts, averages and profit ranking', () => {
    const s = game();
    const [a, b] = s.vehicles.filter(x => x.owner === 'player');
    a.profitThisYear = 5000;
    b.profitThisYear = -1200;
    const sum = fleetSummary(s);
    expect(sum.count).toBe(s.vehicles.filter(x => x.owner === 'player').length);
    expect(sum.profit).toBe(sum.rows.reduce((x, r) => x + r.profit, 0));
    expect(sum.best!.vehicle.id).toBe(a.id);
    expect(sum.worst!.vehicle.id).toBe(b.id);
    expect(sum.avgReliability).toBeGreaterThan(0);
  });

  it('alerts on a booked show with nobody assigned, and on an overdue service', () => {
    const s = game();
    const gig = bookable(s);
    const booked = bookGig({ ...s, company: { ...s.company, reputation: 90 } }, gig.id).state;
    const v = booked.vehicles.find(x => x.owner === 'player')!;
    v.lastServiceHour = booked.hour - (SERVICE_INTERVAL_DAYS + 10) * 24;
    const sum = fleetSummary(booked);
    expect(sum.alerts.some(a => a.gigId === gig.id && a.severity === 'bad' && /no vehicle/.test(a.text))).toBe(true);
    expect(sum.alerts.some(a => a.vehicleId === v.id && /overdue/.test(a.text))).toBe(true);
    // Worst alerts come first.
    const sev = sum.alerts.map(a => ({ bad: 0, warn: 1, info: 2 })[a.severity]);
    expect([...sev].sort()).toEqual(sev);
    expect(sum.upcoming.total).toBeGreaterThanOrEqual(1);
  });

  it('assigning a truck clears the no-vehicle alert', () => {
    const s = game();
    const gig = bookable(s);
    let b = bookGig({ ...s, company: { ...s.company, reputation: 90 } }, gig.id).state;
    const v = b.vehicles.find(x => x.owner === 'player')!;
    b = assignVehicle(b, v.id, gig.id).state;
    expect(fleetSummary(b).alerts.some(a => a.gigId === gig.id && /no vehicle/.test(a.text))).toBe(false);
  });

  it('flags a vehicle that has barely worked', () => {
    const s = game();
    const v = s.vehicles.find(x => x.owner === 'player')!;
    v.util = 0.05;
    v.orders = [];
    v.status = 'parked';
    v.boughtHour = s.hour - 24 * 200;
    expect(fleetSummary(s).alerts.some(a => a.vehicleId === v.id && /barely worked/.test(a.text))).toBe(true);
  });
});
