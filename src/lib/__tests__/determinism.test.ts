import { describe, expect, it } from 'vitest';
import { createRng } from '../rng';
import { generateEvent, generateInitialCrew, createInitialCompany } from '../gameData';
import { generateInitialCompetitors } from '../competitors';

// Strips fields that are deliberately NOT seeded (ids carry Date.now() +
// Math.random() for uniqueness only, not a gameplay outcome) so the
// comparison below is about the actual simulation outputs.
function withoutIds<T extends { id: unknown }>(items: T[]): Omit<T, 'id'>[] {
  return items.map(({ id: _id, ...rest }) => rest);
}

describe('seeded RNG determinism', () => {
  it('generates identical events from the same seed', () => {
    const eventsA = Array.from({ length: 5 }, (_, i) => {
      const rng = createRng(42);
      return generateEvent(new Date(`2026-0${(i % 9) + 1}-01`), 'gig', rng);
    });
    const eventsB = Array.from({ length: 5 }, (_, i) => {
      const rng = createRng(42);
      return generateEvent(new Date(`2026-0${(i % 9) + 1}-01`), 'gig', rng);
    });

    eventsA.forEach((event, i) => {
      const { id: _idA, ...restA } = event;
      const { id: _idB, ...restB } = eventsB[i];
      expect(restA).toEqual(restB);
    });
  });

  it('generates different events from different seeds', () => {
    const rngA = createRng(1);
    const rngB = createRng(2);
    const eventA = generateEvent(new Date('2026-08-01'), 'gig', rngA);
    const eventB = generateEvent(new Date('2026-08-01'), 'gig', rngB);

    // At least one of the rolled fields should differ between seeds.
    const differs =
      eventA.name !== eventB.name ||
      eventA.venue !== eventB.venue ||
      eventA.clientPay !== eventB.clientPay ||
      eventA.startHour !== eventB.startHour ||
      eventA.travelHours !== eventB.travelHours;
    expect(differs).toBe(true);
  });

  it('generates identical starting crews from the same seed', () => {
    const referenceDate = new Date('2026-07-09');
    const crewA = generateInitialCrew(createRng(7), referenceDate);
    const crewB = generateInitialCrew(createRng(7), referenceDate);

    expect(withoutIds(crewA)).toEqual(withoutIds(crewB));
  });

  it('generates identical initial competitors from the same seed', () => {
    const company = createInitialCompany();
    const competitorsA = generateInitialCompetitors(company, createRng(99));
    const competitorsB = generateInitialCompetitors(company, createRng(99));

    expect(withoutIds(competitorsA)).toEqual(withoutIds(competitorsB));
  });

  it('a full "day" of rolls replays identically from the same starting seed', () => {
    // Simulates what advanceDay() does with its rng: several sequential
    // draws feeding different systems (new-contract roll, event terms).
    // Two independent rng instances seeded alike must agree on every draw.
    function simulateOneDay(seed: number) {
      const rng = createRng(seed);
      const rolls: unknown[] = [];
      rolls.push(rng.chance(0.3));
      rolls.push(rng.nextInt(14));
      rolls.push(generateEvent(new Date('2026-09-01'), 'gig', rng));
      rolls.push(rng.nextRange(0, 100));
      return { rolls, finalState: rng.getState() };
    }

    const runA = simulateOneDay(555);
    const runB = simulateOneDay(555);

    expect(runA.finalState).toBe(runB.finalState);
    const [chanceA, intA, eventA, rangeA] = runA.rolls as [boolean, number, ReturnType<typeof generateEvent>, number];
    const [chanceB, intB, eventB, rangeB] = runB.rolls as [boolean, number, ReturnType<typeof generateEvent>, number];
    expect(chanceA).toBe(chanceB);
    expect(intA).toBe(intB);
    expect(rangeA).toBe(rangeB);
    const { id: _idA, ...restA } = eventA;
    const { id: _idB, ...restB } = eventB;
    expect(restA).toEqual(restB);
  });
});
