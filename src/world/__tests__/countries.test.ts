import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createTycoonGame } from '../state';
import { getWorld, worldOf } from '../mapgen';
import { COUNTRIES } from '../content/countries';
import { ARTISTS, findArtist } from '../content/artists';
import { rivalsFor } from '../content/companies';
import { generateOffer } from '../offers';
import { generateWorldTour, tourGigs } from '../tours';
import { formatMoney } from '../core';
import type { Tour } from '../types';

const game = (country: 'ES' | 'GB' | 'US' | 'DE' | 'FR' | 'IT', seed = 2024) =>
  createTycoonGame({ companyName: 'Test', color: '#ff0066', seed, country });

describe('countries', () => {
  it('names towns after real cities, biggest first, on the same geography', () => {
    const es = getWorld(77, 'ES');
    const gb = getWorld(77, 'GB');
    const metroEs = es.cities.find(c => c.size === 'metropolis')!;
    expect(metroEs.name).toBe('Madrid');
    expect(gb.cities.find(c => c.size === 'metropolis')!.name).toBe('London');
    // Same roads and positions, different names.
    expect(es.cities.map(c => [c.x, c.y])).toEqual(gb.cities.map(c => [c.x, c.y]));
    expect(Array.from(es.road)).toEqual(Array.from(gb.road));
    const stadium = metroEs.venues.find(v => v.kind === 'stadium')!;
    expect(stadium.name).toBe('Estadio Santiago Bernabéu');
  });

  it('every country has enough towns and sensible content', () => {
    COUNTRIES.forEach(c => {
      expect(c.cities.length).toBeGreaterThanOrEqual(16);
      const s = game(c.code);
      expect(worldOf(s).cities.every(city => c.cities.includes(city.name))).toBe(true);
      expect(s.rivals.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('puts local firms plus the international giants on the map', () => {
    const s = game('ES');
    const ids = s.rivals.map(r => r.id);
    expect(ids).toContain('clair');
    expect(ids).toContain('fluge');
    expect(ids).toContain('dushow');
    expect(ids).not.toContain('britrow');
    rivalsFor('ES').forEach(t => expect(t.countries.includes('ES') || t.countries.includes('*')).toBe(true));
  });

  it('only books local acts in their home country', () => {
    const s = game('ES');
    const world = worldOf(s);
    const rng = createRng(4);
    const acts = new Set<string>();
    world.cities.forEach(city => {
      for (let i = 0; i < 30; i++) {
        const g = generateOffer(s, world, city, rng);
        if (g) acts.add(g.act);
      }
    });
    const real = [...acts].map(findArtist).filter(Boolean);
    expect(real.some(a => a!.country === 'ES')).toBe(true);
    expect(real.every(a => !a!.country || a!.country === 'ES')).toBe(true);
    expect(ARTISTS.some(a => a.country === 'GB')).toBe(true);
  });

  it('never flies a world-tour leg to the home country', () => {
    const s = game('ES');
    s.company.reputation = 95;
    const world = worldOf(s);
    const rng = createRng(11);
    const tours: Tour[] = [];
    for (let i = 0; i < 40; i++) {
      const t = generateWorldTour(s, world, rng);
      if (t) tours.push(t);
    }
    expect(tours.length).toBeGreaterThan(0);
    tours.forEach(t =>
      tourGigs(s, t).forEach(g => g.overseas?.stops.forEach(stop => expect(['Madrid', 'Barcelona']).not.toContain(stop.city))),
    );
  });

  it('formats money in the home currency', () => {
    expect(formatMoney(game('ES'), 12500)).toBe('€12,500');
    expect(formatMoney(game('GB'), -300)).toBe('-£300');
  });

  it('starts with a full rig including consoles', () => {
    const s = game('IT');
    expect(s.depots[0].gear['yamaha-pm3000']).toBe(2);
  });
});
