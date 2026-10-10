import { describe, expect, it } from 'vitest';
import { getWorld } from '../mapgen';
import { borderRegime, eraWorld, routeNotes, tripCharges } from '../infra';
import { roadDistance } from '../pathfinding';
import { createTycoonGame } from '../state';
import { buildDepot } from '../actions';
import type { WorldMap } from '../types';

const town = (w: WorldMap, name: string) => [...w.cities, ...w.abroad].find(c => c.name === name)!;
const trip = (code: string, year: number, a: string, b: string, winter = false) => {
  const w = eraWorld(getWorld(7, code), year, winter);
  const from = town(w, a).id;
  const to = town(w, b).id;
  return { units: roadDistance(w, from, to), notes: routeNotes(w, from, to), due: tripCharges(w, from, to, 'semi') };
};

describe('borders through history', () => {
  it('customs until the single market, passports until Schengen', () => {
    expect(borderRegime('ES', 'PT', 1985)).toEqual({ hours: 2.5, fee: 150 });
    expect(borderRegime('ES', 'PT', 1993)).toEqual({ hours: 0.5, fee: 0 });
    expect(borderRegime('ES', 'PT', 1996)).toEqual({ hours: 0, fee: 0 });
    // Switzerland never joined the customs union.
    expect(borderRegime('DE', 'CH', 2015).fee).toBeGreaterThan(0);
    // Britain and Ireland: no passports either way, customs again after Brexit.
    expect(borderRegime('GB', 'IE', 2000)).toEqual({ hours: 0, fee: 0 });
    expect(borderRegime('GB', 'IE', 2022).fee).toBeGreaterThan(0);
    expect(borderRegime('US', 'CA', 2010).hours).toBeGreaterThan(borderRegime('US', 'CA', 1990).hours);
  });

  it('the GDR transit checks go when the Wall does', () => {
    const before = trip('DE', 1985, 'Hamburg', 'Berlin');
    const after = trip('DE', 1995, 'Hamburg', 'Berlin');
    expect(before.notes.borders).toContain('the GDR');
    expect(after.notes.borders).toEqual([]);
    expect(after.units).toBeLessThan(before.units);
  });

  it('a domestic trip across the sea is a ferry, not a border', () => {
    const t = trip('GB', 1990, 'Glasgow', 'Belfast');
    expect(t.notes.ferries.length).toBe(1);
    expect(t.notes.borders).toEqual([]);
    expect(t.due.customs).toBe(0);
    expect(t.due.crossings).toBeGreaterThan(0);
  });
});

describe('crossings and motorways', () => {
  it('the Channel Tunnel replaces the Dover–Calais ferry in 1994', () => {
    const ferry = trip('GB', 1990, 'London', 'Lille');
    const tunnel = trip('GB', 1995, 'London', 'Lille');
    expect(ferry.notes.ferries).toEqual(['Dover–Calais']);
    expect(tunnel.notes.tunnels).toEqual(['Channel Tunnel']);
    expect(tunnel.units).toBeLessThan(ferry.units);
    expect(ferry.due.customs).toBeGreaterThan(0);
    expect(tunnel.due.customs).toBe(0);
  });

  it('Sicily is reached by ferry over the Strait of Messina', () => {
    expect(trip('IT', 1990, 'Napoli', 'Palermo').notes.ferries).toEqual(['Strait of Messina']);
  });

  it('motorways open in their real years and make trips quicker', () => {
    const before = trip('ES', 1985, 'Madrid', 'Sevilla');
    const after = trip('ES', 1995, 'Madrid', 'Sevilla');
    expect(before.notes.motorwayKm).toBe(0);
    expect(after.notes.motorwayKm).toBeGreaterThan(200);
    expect(after.units).toBeLessThan(before.units * 0.8);
  });

  it('tolls: French autoroutes always, German autobahns only for lorries from 2005, British never', () => {
    expect(trip('FR', 1990, 'Paris', 'Marseille').due.tolls).toBeGreaterThan(0);
    expect(trip('DE', 2000, 'Hamburg', 'Hannover').due.tolls).toBe(0);
    expect(trip('DE', 2010, 'Hamburg', 'Hannover').due.tolls).toBeGreaterThan(0);
    expect(trip('GB', 2010, 'London', 'Birmingham').due.tolls).toBe(0);
  });
});

describe('towns abroad', () => {
  it('every country has neighbours to play, on foreign land, with real rooms', () => {
    ['ES', 'GB', 'US', 'DE', 'FR', 'IT'].forEach(code => {
      const w = getWorld(7, code);
      expect(w.abroad.length).toBeGreaterThanOrEqual(2);
      w.abroad.forEach(c => {
        expect(w.foreign[c.y * w.width + c.x]).toBe(1);
        expect(c.lots).toHaveLength(0);
        expect(c.venues.length).toBeGreaterThan(0);
        expect(Number.isFinite(roadDistance(w, w.cities[0].id, c.id))).toBe(true);
      });
    });
    expect(town(getWorld(7, 'GB'), 'Dublin').venues.map(v => v.name)).toContain('The Point Depot');
  });

  it("you can't open a base abroad", () => {
    const s = createTycoonGame({ companyName: 'B', color: '#f00', seed: 7, country: 'ES', startYear: 1995 });
    s.company.cash = 10_000_000;
    const lisboa = town(getWorld(7, 'ES'), 'Lisboa');
    expect(buildDepot(s, lisboa.id, 'warehouse').result.ok).toBe(false);
  });
});

describe('winter', () => {
  it('snow slows the high roads from December to March, and the trip needs chains', () => {
    const w = getWorld(7, 'IT');
    expect(w.snowy.some(Boolean)).toBe(true);
    // Find a pair of towns whose road crosses snowy ground.
    const all = [...w.cities];
    let pair: [string, string] | null = null;
    for (const a of all) for (const b of all) if (!pair && a !== b && routeNotes(eraWorld(w, 2000, true), a.id, b.id).snowKm > 0) pair = [a.name, b.name];
    expect(pair).not.toBeNull();
    const summer = trip('IT', 2000, pair![0], pair![1]);
    const winter = trip('IT', 2000, pair![0], pair![1], true);
    expect(winter.units).toBeGreaterThan(summer.units);
    expect(winter.due.total).toBeGreaterThan(summer.due.total);
    expect(summer.notes.snowKm).toBe(0);
  });

  it('the game world turns wintry in January and back in summer', async () => {
    const { worldOf } = await import('../mapgen');
    const s = createTycoonGame({ companyName: 'W', color: '#f00', seed: 7, country: 'IT', startYear: 2000 });
    expect(worldOf(s).era?.winter).toBe(true);
    expect(worldOf({ ...s, hour: s.hour + 24 * 180 }).era?.winter).toBe(false);
  });
});

describe('team drivers', () => {
  it('a sleeper-cab crew gets there sooner, at a second driver\'s pay', async () => {
    const { setTeamDrivers } = await import('../actions');
    const { travelHours } = await import('../core');
    const { worldOf } = await import('../mapgen');
    const { advanceHours } = await import('../sim');
    const s = createTycoonGame({ companyName: 'T', color: '#f00', seed: 7, country: 'US', startYear: 2000 });
    const truck = s.vehicles.find(v => v.owner === 'player' && v.modelId !== 'splitter-van') ?? s.vehicles.find(v => v.owner === 'player')!;
    const world = worldOf(s);
    const far = [...world.cities].sort((a, b) => roadDistance(world, truck.homeCityId, b.id) - roadDistance(world, truck.homeCityId, a.id))[0];
    const solo = travelHours(world, truck, truck.homeCityId, far.id);
    const team = travelHours(world, { ...truck, teamDrivers: true }, truck.homeCityId, far.id);
    expect(team).toBeLessThan(solo * 0.8);
    const van = s.vehicles.find(v => v.owner === 'player' && v.modelId === 'splitter-van');
    if (van) expect(setTeamDrivers(s, van.id, true).result.ok).toBe(false);
    if (truck.modelId !== 'splitter-van') {
      const on = setTeamDrivers(s, truck.id, true).state;
      expect(on.vehicles.find(v => v.id === truck.id)!.teamDrivers).toBe(true);
      // Driving costs wages while it rolls.
      const t = on.vehicles.find(v => v.id === truck.id)!;
      t.status = 'driving';
      t.cityId = undefined;
      t.route = { from: truck.homeCityId, to: far.id, progress: 0, total: roadDistance(world, truck.homeCityId, far.id) };
      const before = on.ledger[2000]?.wages ?? 0;
      const later = advanceHours(on, 3);
      expect((later.ledger[2000]?.wages ?? 0) - before).toBeLessThan(0);
    }
  });
});
