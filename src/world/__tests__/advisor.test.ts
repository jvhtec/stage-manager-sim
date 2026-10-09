import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { attentionCount, briefing, monthlyBurn } from '../advisor';
import { dayOf } from '../core';
import type { Gig, TycoonState } from '../types';

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 99, country: 'GB', startYear: 1995 });
  s.company.cash = 3_000_000;
  s.dilemmas = [];
  return s;
};
const booked = (s: TycoonState, extra: Partial<Gig> = {}) => {
  const g = { id: 'g' + s.gigs.length, act: 'The Band', status: 'booked', tier: 1, fee: 5000, day: dayOf(s.hour) + 3, cityId: s.depots[0].cityId, venueId: 'v', needs: { audio: 1, console: 0, lighting: 0, video: 0, stage: 0 }, ...extra } as Gig;
  s.gigs.push(g);
  return g;
};
const ids = (s: TycoonState) => briefing(s).map(a => a.id);

describe('briefing', () => {
  it('a quiet, healthy company has little to say', () => {
    const s = game();
    expect(briefing(s).filter(a => a.tone !== 'info')).toEqual([]);
  });

  it('flags a show with no truck as it gets close', () => {
    const s = game();
    const g = booked(s);
    expect(ids(s)).toContain(`unassigned-${g.id}`);
    s.vehicles.find(v => v.owner === 'player')!.orders.push(g.id);
    expect(ids(s)).not.toContain(`unassigned-${g.id}`);
    const far = booked(s, { day: dayOf(s.hour) + 20 });
    expect(ids(s)).not.toContain(`unassigned-${far.id}`);
  });

  it('flags required rehearsals and ticketed crew', () => {
    const s = game();
    s.people.forEach(m => (m.certs = []));
    const g = booked(s, { tier: 3 });
    const list = ids(s);
    expect(list).toContain(`rehearse-${g.id}`);
    expect(list).toContain(`tickets-${g.id}`);
    g.rehearsed = 1;
    expect(ids(s)).not.toContain(`rehearse-${g.id}`);
  });

  it('flags decisions, thin cash and no insurance on a big stock', () => {
    const s = game();
    s.dilemmas.push({ id: 'd', kind: 'charity', title: 't', text: 't', options: [], defaultOption: 'x', createdHour: 0, expiresHour: 1 } as never);
    expect(ids(s)).toContain('decisions');
    const burn = monthlyBurn(s);
    expect(burn).toBeGreaterThan(0);
    s.company.cash = Math.round(burn * 0.5);
    expect(ids(s)).toContain('cash-low');
    s.company.cash = Math.round(burn * 2);
    expect(ids(s)).toContain('cash-thin');
    expect(ids(s)).not.toContain('cash-low');
  });

  it('puts the urgent first and counts only what needs attention', () => {
    const s = game();
    booked(s);
    s.company.cash = 100;
    s.policies.insurance = 'none';
    const list = briefing(s);
    const order = list.map(a => a.tone);
    expect(order).toEqual([...order].sort((a, b) => ['bad', 'warn', 'info'].indexOf(a) - ['bad', 'warn', 'info'].indexOf(b)));
    expect(attentionCount(list)).toBe(list.filter(a => a.tone !== 'info').length);
    expect(attentionCount(list)).toBeGreaterThan(0);
  });

  it('only suggests a festival in spring', () => {
    const s = game();
    s.company.reputation = 60;
    s.hour = 24 * 30;
    expect(ids(s)).toContain('festival');
    s.hour = 24 * 200;
    expect(ids(s)).not.toContain('festival');
  });
});
