import { geoAbroad } from '../content/geo';
import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { HOURS_PER_DAY } from '../catalog';
import { VENUE_YEARS, venueOpenIn } from '../content/venueYears';
import { generateOffer, localFame, yearlyVenues } from '../offers';
import { worldOf } from '../mapgen';
import { createRng } from '@/lib/rng';
import { COUNTRIES } from '../content/countries';
import type { TycoonState } from '../types';

const game = (country: TycoonState['country'], startYear: number): TycoonState =>
  createTycoonGame({ companyName: 'V', color: '#f00', seed: 33, country, startYear });

describe('landmark venues keep their real years', () => {
  it('the O2 does not exist before 2007; Wembley is shut 2001-2006', () => {
    expect(venueOpenIn('The O2', 2006)).toBe(false);
    expect(venueOpenIn('The O2', 2007)).toBe(true);
    expect(venueOpenIn('Wembley Stadium', 2003)).toBe(false);
    expect(venueOpenIn('Wembley Stadium', 2000)).toBe(true);
    expect(venueOpenIn('Wembley Stadium', 2007)).toBe(true);
    expect(venueOpenIn('The Fox & Fiddle', 1975)).toBe(true);
  });

  it('no offers or tour dates in a room that is not there yet', () => {
    const s = game('GB', 1995);
    const world = worldOf(s);
    const london = world.cities.find(c => c.name === 'London')!;
    const rng = createRng(5);
    for (let i = 0; i < 150; i++) {
      const g = generateOffer(s, world, london, rng, { minLeadDays: 6 });
      if (!g) continue;
      expect(world.venueById.get(g.venueId)!.name).not.toBe('The O2');
    }
    // Ten years later it is fair game.
    const later = game('GB', 2008);
    let seen = false;
    for (let i = 0; i < 400 && !seen; i++) {
      const g = generateOffer(later, world, london, createRng(i + 1));
      seen = !!g && world.venueById.get(g.venueId)!.name === 'The O2';
    }
    expect(seen).toBe(true);
  });

  it('the new year announces openings, closures and reopenings', () => {
    const s = game('GB', 2006);
    const world = worldOf(s);
    yearlyVenues(s, world, 2007);
    const text = s.news.map(n => n.text).join('\n');
    expect(text).toMatch(/The O2 opens in London/);
    expect(text).toMatch(/Wembley Stadium reopens/);
    const t = game('GB', 1999);
    yearlyVenues(t, worldOf(t), 2001);
    expect(t.news.some(n => /Wembley Stadium in London closes/.test(n.text))).toBe(true);
  });

  it('the year rolls over in play and says so', () => {
    const s = game('GB', 2006);
    s.company.cash = 50_000_000;
    const mid = advanceHours(s, 360 * HOURS_PER_DAY);
    const out = advanceHours(mid, 6 * HOURS_PER_DAY);
    expect(out.news.some(n => /The O2 opens in London/.test(n.text))).toBe(true);
  });

  it('every listed landmark is a real landmark in some country (or just over its border)', () => {
    const names = new Set([
      ...COUNTRIES.flatMap(c => Object.values(c.landmarks).flatMap(l => Object.values(l))),
      ...COUNTRIES.flatMap(c => geoAbroad(c.code).flatMap(t => Object.values(t.venues))),
    ]);
    Object.keys(VENUE_YEARS).forEach(n => expect(names.has(n)).toBe(true));
  });
});

describe('local fame', () => {
  it('towns you have done proud ask for you more', () => {
    const s = game('GB', 1995);
    s.cityRatings.x = 90;
    s.cityRatings.y = 10;
    expect(localFame(s, 'x')).toBeGreaterThan(1.1);
    expect(localFame(s, 'y')).toBeLessThan(0.9);
    expect(localFame(s, 'unknown')).toBe(1);
  });
});

describe('world tours need a home room', () => {
  it('years with no stadium or arena open post no world tour instead of crashing', async () => {
    const { generateWorldTour } = await import('../tours');
    const s = game('GB', 2003);
    const world = worldOf(s);
    // Close every arena and stadium by renaming them to listed-and-shut landmarks.
    const shut = structuredClone(world);
    shut.cities.forEach(c => c.venues.forEach(v => {
      if (v.kind === 'arena' || v.kind === 'stadium') v.name = 'Wembley Stadium';
    }));
    const rng = createRng(1);
    for (let i = 0; i < 20; i++) expect(() => generateWorldTour(s, shut, rng)).not.toThrow();
  });
});
