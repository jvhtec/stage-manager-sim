import { describe, expect, it } from 'vitest';
import { CITY_COORDS, HOME_HUB, LAND } from '../content/worldmap';
import { COUNTRIES } from '../content/countries';
import { REGIONS } from '../content/world';

describe('world tour map data', () => {
  it('has coordinates for every overseas city, in range', () => {
    REGIONS.forEach(r =>
      r.cities.forEach(c => {
        const at = CITY_COORDS[c.city];
        expect(at, c.city).toBeDefined();
        expect(Math.abs(at[0])).toBeLessThanOrEqual(180);
        expect(Math.abs(at[1])).toBeLessThanOrEqual(90);
      }),
    );
  });

  it('has a home airport for every playable country', () => {
    COUNTRIES.forEach(c => expect(HOME_HUB[c.code], c.code).toBeDefined());
  });

  it('draws closed, sensible land outlines', () => {
    expect(LAND.length).toBeGreaterThan(10);
    LAND.forEach(l => {
      expect(l.ring.length, l.id).toBeGreaterThanOrEqual(4);
      l.ring.forEach(([lo, la]) => {
        expect(Math.abs(lo)).toBeLessThanOrEqual(180);
        expect(Math.abs(la)).toBeLessThanOrEqual(90);
      });
    });
    expect(new Set(LAND.map(l => l.id)).size).toBe(LAND.length);
  });

  it('every overseas city sits on a land outline (and Tokyo is not in Africa)', () => {
    const inside = (pt: [number, number], ring: [number, number][]) => {
      let c = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > pt[1] !== yj > pt[1] && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    };
    Object.entries(CITY_COORDS).forEach(([name, at]) => expect(LAND.some(l => inside(at, l.ring)), name).toBe(true));
    expect(inside(CITY_COORDS.Tokyo, LAND.find(l => l.id === 'africa')!.ring)).toBe(false);
  });
});
