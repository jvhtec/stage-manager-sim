import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { buildGig } from '../offers';
import { requiredCerts } from '../certs';
import { paymentDays } from '../receivables';
import { councilBooked, isFiestaSeason, isRightToWork, needsMeister, needsReliefCrew, INTERMITTENTS, COUNCIL_PAYMENT_DAYS } from '../rules';
import { hasStagehandUnions, venueTraits } from '../venueTraits';
import { worldOf } from '../mapgen';
import { createRng } from '@/lib/rng';
import { dayOf } from '../core';

const game = (country: 'ES' | 'GB' | 'US' | 'DE' | 'FR' | 'IT', startYear: number) =>
  createTycoonGame({ companyName: 'R', color: '#f00', seed: 9, country, startYear });

describe('national rules', () => {
  it('Spanish fiestas: small towns, July to September, paid by the council late', () => {
    expect(isFiestaSeason(new Date(Date.UTC(2000, 7, 15)))).toBe(true);
    expect(isFiestaSeason(new Date(Date.UTC(2000, 2, 15)))).toBe(false);
    expect(councilBooked('ES', 'village', new Date(Date.UTC(2000, 7, 15)), 1)).toBe(true);
    expect(councilBooked('ES', 'metropolis', new Date(Date.UTC(2000, 7, 15)), 1)).toBe(false);
    expect(councilBooked('GB', 'village', new Date(Date.UTC(2000, 7, 15)), 1)).toBe(false);
    expect(paymentDays({ tier: 1, council: true })).toBe(COUNCIL_PAYMENT_DAYS);
    expect(paymentDays({ tier: 1 })).toBe(0);
    // A real built offer carries the flag.
    const s = game('ES', 1995);
    const w = worldOf(s);
    const town = w.cities.find(c => c.size === 'village')!;
    const venue = town.venues[0];
    const august = Math.floor((Date.UTC(1995, 7, 10) - Date.UTC(1995, 0, 1)) / 86400000);
    const gig = buildGig(s, createRng(3), { venue, day: august, act: 'Banda del Pueblo', real: false });
    expect(gig.council).toBe(true);
  });

  it('Germany wants a Meister on big shows from 1995', () => {
    expect(needsMeister('DE', 1994, 3)).toBe(false);
    expect(needsMeister('DE', 1995, 3)).toBe(true);
    expect(needsMeister('DE', 1995, 1)).toBe(false);
    expect(needsMeister('FR', 2000, 4)).toBe(false);
    expect(requiredCerts({ tier: 3, meister: true }).rigging).toBe(requiredCerts({ tier: 3 }).rigging + 1);
  });

  it('Britain after 1998: relief crew on big or multi-day shows', () => {
    expect(needsReliefCrew('GB', 1997, 3, 1)).toBe(false);
    expect(needsReliefCrew('GB', 1998, 3, 1)).toBe(true);
    expect(needsReliefCrew('GB', 1998, 1, 3)).toBe(true);
    expect(needsReliefCrew('GB', 1998, 1, 1)).toBe(false);
    expect(needsReliefCrew('ES', 2010, 4, 3)).toBe(false);
  });

  it('France keeps a cheap deep freelance pool', () => {
    expect(INTERMITTENTS.rate).toBeLessThan(1);
    expect(INTERMITTENTS.pool).toBeGreaterThan(1);
  });

  it('American unions: yes in the north-east, no in right-to-work states', () => {
    expect(isRightToWork('Dallas')).toBe(true);
    expect(isRightToWork('New York')).toBe(false);
    expect(hasStagehandUnions('US', 'Houston')).toBe(false);
    expect(hasStagehandUnions('US', 'Chicago')).toBe(true);
    expect(hasStagehandUnions('ES')).toBe(false);
    const union = (town: string) => Array.from({ length: 30 }, (_, i) => venueTraits({ name: `Hall ${i}`, kind: 'theatre' }, 'US', town).union).filter(Boolean).length;
    expect(union('Houston')).toBe(0);
    expect(union('New York')).toBeGreaterThan(15);
  });

  it('Spanish rooms are strict about curfews and noise', () => {
    const count = (country: string, pick: (t: ReturnType<typeof venueTraits>) => unknown) =>
      Array.from({ length: 60 }, (_, i) => pick(venueTraits({ name: `Sala ${i}`, kind: 'club' }, country))).filter(Boolean).length;
    expect(count('ES', t => t.curfew)).toBeGreaterThan(count('IT', t => t.curfew));
    expect(count('ES', t => t.noiseDb)).toBeGreaterThan(count('IT', t => t.noiseDb));
    expect(dayOf(0)).toBe(0);
  });
});
