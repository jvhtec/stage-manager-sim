import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { HOURS_PER_DAY } from '../catalog';
import { eventStartDay } from '../events';
import { getWorld } from '../mapgen';
import { getEvent } from '../content/events';
import { SCENARIOS, scenarioProgress } from '../scenarios';
import { goalDeadlineYear, GOALS } from '../scenario';

describe('historic scenarios', () => {
  it('every scenario names a real event, town and country', () => {
    SCENARIOS.forEach(sc => {
      const e = getEvent(sc.event);
      expect(e, sc.id).toBeDefined();
      expect(e!.year).toBe(sc.startYear);
      expect(e!.country).toBe(sc.country);
      expect(getWorld(7, sc.country).cities.some(c => c.name === sc.hq), sc.id).toBe(true);
    });
  });

  it('starts you in the right place and year, with a lot to bid for before the night', () => {
    SCENARIOS.forEach(sc => {
      let s = createTycoonGame({ companyName: 'Hist', color: '#f00', seed: 7, scenario: sc.id });
      expect(s.goal).toBe('scenario');
      expect(s.startYear).toBe(sc.startYear);
      expect(s.country).toBe(sc.country);
      expect(getWorld(7, sc.country).cityById.get(s.company.hqCityId)!.name).toBe(sc.hq);
      expect(goalDeadlineYear(s)).toBe(sc.startYear + sc.years);
      expect(GOALS.scenario.progress(s).done).toBe(false);
      s = advanceHours(s, (eventStartDay(s, getEvent(sc.event)!, sc.startYear) - 30) * HOURS_PER_DAY);
      expect(s.gigs.some(g => g.event?.id === sc.event && !g.event.citywide), sc.id).toBe(true);
      expect(scenarioProgress(s).won).toBe(false);
    });
  });
});
