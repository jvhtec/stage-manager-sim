import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createTycoonGame, starterFleet, starterKit } from '../state';
import { worldOf } from '../mapgen';
import { generateOffer } from '../offers';
import { updateRivals } from '../sim';
import { getProduct } from '../content/gear';
import { START_YEARS } from '../catalog';

describe('start years', () => {
  it('gives every era a period-correct rig and fleet', () => {
    START_YEARS.forEach(year => {
      const kit = starterKit(year);
      Object.keys(kit).forEach(id => expect(getProduct(id).introYear).toBeLessThanOrEqual(year));
      expect(starterFleet(year)).toHaveLength(2);
    });
    expect(starterFleet(1975)).toContain('bedford-tk');
  });

  it('meets the 1970s US sound companies, then watches them change', () => {
    const s = createTycoonGame({ companyName: 'T', color: '#f00', seed: 5, country: 'US', startYear: 1975 });
    expect(s.startYear).toBe(1975);
    const names = () => s.rivals.map(r => r.name);
    expect(names()).toContain('Tycobrahe Sound');
    expect(names()).toContain('Silverfish Audio');
    expect(names()).toContain('Showco');
    const world = worldOf(s);
    // Firms set up in their real home town when it's on the map (and isn't yours).
    const dallas = world.cities.find(c => c.name === 'Dallas')!;
    if (dallas.id !== s.company.hqCityId) expect(s.rivals.find(r => r.id === 'showco')!.hqCityId).toBe(dallas.id);
    updateRivals(s, world, 1984);
    expect(names()).not.toContain('Tycobrahe Sound');
    expect(names()).toContain('Sound Image');
  });

  it('nobody asks for video screens before they exist', () => {
    const s = createTycoonGame({ companyName: 'T', color: '#f00', seed: 6, country: 'GB', startYear: 1975 });
    const world = worldOf(s);
    const rng = createRng(2);
    for (let i = 0; i < 60; i++) {
      const g = generateOffer(s, world, rng.pick(world.cities), rng);
      if (g) expect(g.needs.video).toBe(0);
    }
  });
});
