import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { MAX_RELATION, recordVenueNight, relationFeeBonus, relationLabel, relationOfferWeight, venueRelation } from '../promoters';
import { generateOffer } from '../offers';
import { worldOf } from '../mapgen';
import { createRng } from '@/lib/rng';

const game = () => createTycoonGame({ companyName: 'P', color: '#f00', seed: 4, country: 'GB', startYear: 1995 });

describe('promoter relationships', () => {
  it('build with great nights and fall with bad ones, within 0-8', () => {
    const s = game();
    recordVenueNight(s, 'v', 0.9, false);
    recordVenueNight(s, 'v', 0.9, false);
    recordVenueNight(s, 'v', 0.75, false);
    expect(venueRelation(s, 'v')).toBe(2.5);
    recordVenueNight(s, 'v', 0.4, false);
    expect(venueRelation(s, 'v')).toBe(1.5);
    recordVenueNight(s, 'v', 0.2, true);
    expect(venueRelation(s, 'v')).toBe(0);
    for (let i = 0; i < 20; i++) recordVenueNight(s, 'v', 1, false);
    expect(venueRelation(s, 'v')).toBe(MAX_RELATION);
  });

  it('friendly promoters call more often and pay a bit more', () => {
    const s = game();
    expect(relationOfferWeight(s, 'v')).toBe(1);
    expect(relationFeeBonus(s, 'v')).toBe(1);
    s.venueRelations.v = 6;
    expect(relationOfferWeight(s, 'v')).toBeGreaterThan(2);
    expect(relationFeeBonus(s, 'v')).toBeCloseTo(1.1);
    s.venueRelations.v = 8;
    expect(relationFeeBonus(s, 'v')).toBeCloseTo(1.1); // capped
  });

  it('skew which venue in town gets the offers', () => {
    const s = game();
    const world = worldOf(s);
    const city = world.cities.find(c => c.venues.filter(v => v.kind !== 'airport' && v.tier === 1).length >= 2)!;
    const [a, b] = city.venues.filter(v => v.kind !== 'airport' && v.tier === 1);
    s.venueRelations[a.id] = 8;
    const count = { a: 0, b: 0 };
    for (let i = 0; i < 400; i++) {
      const g = generateOffer(s, world, city, createRng(i + 1), { maxTier: 1 });
      if (g?.venueId === a.id) count.a++;
      if (g?.venueId === b.id) count.b++;
    }
    expect(count.a).toBeGreaterThan(count.b * 1.5);
  });

  it('labels', () => {
    expect(relationLabel(0)).toBe('Strangers');
    expect(relationLabel(7)).toBe('Family');
  });
});
