import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { HOURS_PER_DAY } from '../catalog';
import { loadOutDoneHour, showEndHour } from '../core';
import { festivalStartDay } from '../festivals';
import { getFestival, festivalSize } from '../content/festivals';
import type { TycoonState } from '../types';

const glasto = getFestival('glastonbury')!;
const rich = (s: TycoonState) => ({ ...s, company: { ...s.company, cash: 10_000_000 } });

describe('festivals', () => {
  it('tender their stages two months out, as multi-day contracts', () => {
    let s = rich(createTycoonGame({ companyName: 'F', color: '#f00', seed: 5, country: 'GB', startYear: 1985 }));
    const start = festivalStartDay(s, glasto, 1985);
    s = advanceHours(s, (start - 55) * HOURS_PER_DAY);
    const stages = s.gigs.filter(g => g.festival?.id === 'glastonbury');
    expect(stages.map(g => g.festival!.stage).sort()).toEqual(['Other Stage', 'Pyramid Stage']);
    const main = stages.find(g => g.festival!.main)!;
    const second = stages.find(g => !g.festival!.main)!;
    expect(main.days).toBe(3);
    expect(main.tier).toBe(4);
    expect(second.tier).toBe(3);
    expect(showEndHour(main) - main.day * HOURS_PER_DAY).toBeGreaterThan(2 * HOURS_PER_DAY);
    expect(loadOutDoneHour(main)).toBeGreaterThan(showEndHour(main));
    expect(s.news.some(n => /Glastonbury Festival 1985/.test(n.text))).toBe(true);

    // Nobody booked it: at the close, a rival in the right league takes the stage.
    s = advanceHours(s, 40 * HOURS_PER_DAY);
    const after = s.gigs.find(g => g.id === main.id)!;
    expect(['rival', 'expired']).toContain(after.status);
  });

  it('skips fallow years and the pandemic', () => {
    expect(festivalSize(glasto, 1988)).toBe(0);
    expect(festivalSize(glasto, 1987)).toBe(4);
    let s = rich(createTycoonGame({ companyName: 'F', color: '#f00', seed: 5, country: 'GB', startYear: 2010 }));
    const start = festivalStartDay(s, glasto, 2020);
    s = { ...s, hour: (start - 70) * HOURS_PER_DAY };
    s = advanceHours(s, 20 * HOURS_PER_DAY);
    expect(s.gigs.some(g => g.festival?.id === 'glastonbury' && g.festival.year === 2020 && g.status === 'offer')).toBe(false);
    expect(s.news.some(n => /Glastonbury Festival 2020 is cancelled/.test(n.text))).toBe(true);
  });
});
