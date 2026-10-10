import { describe, expect, it } from 'vitest';
import { venueTraits, traitsOf, UNION_CALL } from '../venueTraits';
import { getWorld } from '../mapgen';

describe('venue character', () => {
  it('is stable for a venue and follows the country', () => {
    const v = { name: 'Test Playhouse', kind: 'theatre' as const };
    expect(venueTraits(v, 'GB')).toEqual(venueTraits(v, 'GB'));
    // Arenas and stadiums always have a dock; pubs load in from the street.
    expect(venueTraits({ name: 'X Arena', kind: 'arena' }, 'ES').loadIn).toBe('dock');
    expect(venueTraits({ name: 'The Fox', kind: 'pub' }, 'GB').loadIn).toBe('street');
    // Union houses are an American (and some British theatre) thing.
    const usUnion = Array.from({ length: 40 }, (_, i) => venueTraits({ name: `Hall ${i}`, kind: 'theatre' }, 'US').union).filter(Boolean).length;
    const esUnion = Array.from({ length: 40 }, (_, i) => venueTraits({ name: `Hall ${i}`, kind: 'theatre' }, 'ES').union).filter(Boolean).length;
    expect(usUnion).toBeGreaterThan(20);
    expect(esUnion).toBe(0);
    expect(UNION_CALL).toBeGreaterThan(0);
    // German rooms are strict about noise.
    const deNoise = Array.from({ length: 40 }, (_, i) => venueTraits({ name: `Halle ${i}`, kind: 'arena' }, 'DE').noiseDb).filter(Boolean).length;
    expect(deNoise).toBeGreaterThan(15);
  });

  it('a town abroad keeps its own country’s habits', () => {
    const w = getWorld(7, 'US');
    const toronto = w.abroad.find(c => c.name === 'Toronto')!;
    const v = toronto.venues[0];
    expect(traitsOf(w, v)).toEqual(venueTraits(v, 'CA'));
  });
});
