import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { bidEvent, bookGig } from '../actions';
import { HOURS_PER_DAY } from '../catalog';
import { eventStakes, eventStartDay } from '../events';
import { eventRunsIn, getEvent } from '../content/events';
import type { Gig, TycoonState } from '../types';

const liveAid = getEvent('liveaid-uk')!;

function toTender(rep: number): { s: TycoonState; lots: Gig[] } {
  let s = createTycoonGame({ companyName: 'E', color: '#f00', seed: 31, country: 'GB', startYear: 1985 });
  s = { ...s, company: { ...s.company, cash: 5_000_000, reputation: rep } };
  const start = eventStartDay(s, liveAid, 1985);
  s = advanceHours(s, (start - 100) * HOURS_PER_DAY);
  return { s, lots: s.gigs.filter(g => g.event?.id === 'liveaid-uk') };
}

describe('special events', () => {
  it('tender their production department by department, months ahead', () => {
    const { s, lots } = toTender(90);
    expect(lots.map(g => g.event!.lot).sort()).toEqual(['audio', 'lighting', 'stage', 'video']);
    const audio = lots.find(g => g.event!.lot === 'audio')!;
    expect(audio.needs.lighting).toBe(0);
    expect(audio.needs.audio).toBeGreaterThan(16);
    expect(audio.needs.console).toBeGreaterThanOrEqual(4); // broadcast spare
    expect(audio.event!.broadcast).toBe(true);
    expect(bookGig(s, audio.id).result.ok).toBe(false);
    expect(s.news.some(n => /Live Aid 1985/.test(n.text))).toBe(true);
  });

  it('take sealed bids from firms with the standing, decided at the close', () => {
    const low = toTender(30);
    expect(bidEvent(low.s, low.lots[0].id, 'sharp').result.ok).toBe(false);

    const { s: s0, lots } = toTender(95);
    let s = s0;
    s.rivals.forEach(r => (r.reputation = 20));
    lots.forEach(g => (s = bidEvent(s, g.id, 'sharp').state));
    const listFee = lots[0].fee;
    s = advanceHours(s, 80 * HOURS_PER_DAY);
    const won = s.gigs.find(g => g.id === lots[0].id)!;
    expect(won.status).toBe('booked');
    expect(won.fee).toBeLessThan(listFee);
  });

  it('broadcast trouble costs dearly; great nights make careers', () => {
    const gig = { event: { id: 'x', year: 1985, name: 'X', lot: 'audio', broadcast: true, scale: 5 } } as Gig;
    expect(eventStakes(gig, 0.9, true).qualityPenalty).toBeGreaterThan(0);
    expect(eventStakes(gig, 0.95, false).reputation).toBeGreaterThan(5);
    expect(eventStakes(gig, 0.5, true).reputation).toBeLessThan(0);
  });

  it('recurring and citywide events', () => {
    const lp = getEvent('lovep')!;
    expect(eventRunsIn(lp, 1995)).toBe(true);
    expect(eventRunsIn(lp, 2004)).toBe(false);
    expect(eventRunsIn(lp, 2007)).toBe(false);
    let s = createTycoonGame({ companyName: 'E', color: '#f00', seed: 31, country: 'FR', startYear: 1990 });
    const fete = eventStartDay(s, getEvent('fete')!, 1990);
    s = advanceHours(s, (fete - 20) * HOURS_PER_DAY);
    const shows = s.gigs.filter(g => g.event?.id === 'fete');
    expect(shows.length).toBeGreaterThan(5);
    expect(shows.every(g => g.day === fete)).toBe(true);
  });
});
