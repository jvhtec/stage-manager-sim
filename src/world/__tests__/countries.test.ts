import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createTycoonGame } from '../state';
import { getWorld, worldOf } from '../mapgen';
import { COUNTRIES, cityNames } from '../content/countries';
import { ARTISTS, findArtist } from '../content/artists';
import { rivalsFor } from '../content/companies';
import { generateOffer } from '../offers';
import { generateWorldTour, tourGigs } from '../tours';
import { formatMoney, formatMoneyShort } from '../core';
import { deptTotals } from '../loading';
import type { Tour } from '../types';

const game = (country: 'ES' | 'GB' | 'US' | 'DE' | 'FR' | 'IT', seed = 2024) =>
  createTycoonGame({ companyName: 'Test', color: '#ff0066', seed, country });

describe('countries', () => {
  it('names towns after real cities, biggest first, where they really are', () => {
    const es = getWorld(77, 'ES');
    const gb = getWorld(77, 'GB');
    const metroEs = es.cities.find(c => c.size === 'metropolis')!;
    expect(metroEs.name).toBe('Madrid');
    expect(gb.cities.find(c => c.size === 'metropolis')!.name).toBe('London');
    // Real (metro-area) populations, in size order.
    expect(metroEs.population).toBe(6_800_000);
    const sorted = [...es.cities].sort((a, b) => b.population - a.population);
    expect(sorted[0].size).toBe('metropolis');
    expect(sorted.every((c, i) => i === 0 || c.population <= sorted[i - 1].population)).toBe(true);
    // A miniature of the real country: the towns sit in their true relative positions.
    const at = (w: typeof es, name: string) => w.cities.find(c => c.name === name)!;
    expect(at(es, 'Barcelona').x).toBeGreaterThan(at(es, 'Madrid').x);
    expect(at(es, 'Barcelona').y).toBeLessThan(at(es, 'Madrid').y);
    expect(at(es, 'Sevilla').y).toBeGreaterThan(at(es, 'Madrid').y);
    expect(at(es, 'Sevilla').x).toBeLessThan(at(es, 'Madrid').x);
    expect(at(gb, 'Glasgow').y).toBeLessThan(at(gb, 'London').y);
    expect(at(gb, 'Brighton').y).toBeGreaterThan(at(gb, 'London').y);
    expect(es.cities.map(c => [c.x, c.y])).not.toEqual(gb.cities.map(c => [c.x, c.y]));
    const stadium = metroEs.venues.find(v => v.kind === 'stadium')!;
    expect(stadium.name).toBe('Estadio Santiago Bernabéu');
  });

  it('every country has enough towns and sensible content', () => {
    COUNTRIES.forEach(c => {
      expect(c.cities.length).toBeGreaterThanOrEqual(16);
      const s = game(c.code);
      expect(worldOf(s).cities.every(city => cityNames(c).includes(city.name))).toBe(true);
      expect(s.rivals.length).toBeGreaterThanOrEqual(4);
    });
  });

  it('puts local firms plus the international giants on the map', () => {
    const s = game('ES');
    const ids = s.rivals.map(r => r.id);
    expect(ids).toContain('clair');
    // 1990: the '80s Spanish sound houses are trading; Fluge (1991) isn't yet.
    ['twincam', 'milan', 'berenice', 'sorter', 'apogee'].forEach(id => expect(ids).toContain(id));
    expect(ids).not.toContain('fluge');
    expect(ids).not.toContain('britrow');
    expect(ids).not.toContain('tycobrahe');
    expect(s.rivals.find(r => r.id === 'twincam')!.name).toBe('Twin Cam Audio');
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

  it('formats money in the home currency, as it was spelt in the year', () => {
    const at = (code: 'ES' | 'GB' | 'US' | 'DE' | 'FR' | 'IT', startYear: number) =>
      createTycoonGame({ companyName: 'T', color: '#f00', seed: 5, country: code, startYear });
    // The euro only arrives in 2002.
    expect(formatMoney(at('ES', 2010), 12500)).toBe('€12,500');
    expect(formatMoney(at('ES', 1990), 3000)).toBe('499,158 pts');
    expect(formatMoney(at('DE', 1985), 1000)).toBe('1,956 DM');
    expect(formatMoney(at('FR', 1985), 1000)).toBe('6,560 F');
    expect(formatMoney(at('IT', 1985), 1000)).toBe('L.1,936,270');
    expect(formatMoneyShort(at('IT', 1985), 3000)).toBe('L.5.8M');
    expect(formatMoney(at('GB', 1980), -300)).toBe('-£300');
    expect(formatMoney(at('US', 2010), 40)).toBe('$40');
    // ...and it changes over on its own as the years pass.
    const s = at('ES', 2000);
    expect(formatMoney(s, 1000)).toBe('166,386 pts');
    expect(formatMoney({ ...s, hour: s.hour + 24 * 365 * 3 }, 1000)).toBe('€1,000');
  });

  it('starts with a full rig including consoles', () => {
    const s = game('IT');
    expect(deptTotals(s.depots[0].gear).console).toBe(2);
  });
});
