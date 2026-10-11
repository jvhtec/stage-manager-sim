import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { actBanned, activeBans, afterBreach, afterDisaster, offerBlocked, venueBanned } from '../blacklist';
import { LATE_TEMPER } from '../receivables';
import type { Gig, TycoonState } from '../types';

const game = (): TycoonState => createTycoonGame({ companyName: 'X', color: '#f00', seed: 7, country: 'GB', startYear: 1995 });
const gig = (act = 'Blur'): Gig => ({ id: 'g', act, venueId: 'v1', cityId: 'c', tier: 2, day: 5, status: 'failed' }) as unknown as Gig;

describe('burnt bridges', () => {
  it('a disaster gets you banned by the act — and by a promoter with no goodwill', () => {
    const s = game();
    afterDisaster(s, gig(), 'The Venue, Town', 0);
    expect(actBanned(s, 'Blur')).toBe(true);
    expect(venueBanned(s, 'v1')).toBe(true);
    expect(offerBlocked(s, { act: 'Oasis', venueId: 'v1' })).toBe(true);
    expect(offerBlocked(s, { act: 'Oasis', venueId: 'v2' })).toBe(false);
    expect(activeBans(s)).toHaveLength(2);
    // A promoter you've built goodwill with keeps the door open.
    const t = game();
    afterDisaster(t, gig(), 'The Venue, Town', 4);
    expect(venueBanned(t, 'v1')).toBe(false);
  });

  it('bans run out', () => {
    const s = game();
    afterDisaster(s, gig(), 'The Venue, Town', 0);
    s.hour += 24 * 800;
    expect(actBanned(s, 'Blur')).toBe(false);
    expect(venueBanned(s, 'v1')).toBe(false);
  });

  it('breaking the same rider twice in a year ends the relationship', () => {
    const s = game();
    afterBreach(s, gig('Pulp'));
    expect(actBanned(s, 'Pulp')).toBe(false);
    s.hour += 24 * 100;
    afterBreach(s, gig('Pulp'));
    expect(actBanned(s, 'Pulp')).toBe(true);
    expect(s.incidents?.some(i => i.causes.some(c => c.id === 'rider-twice'))).toBe(true);
  });

  it('pushy clients pay late more often', () => {
    expect(LATE_TEMPER.pushy).toBeGreaterThan(LATE_TEMPER.easy);
  });
});
