import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { headhunt } from '../actions';
import { HEADHUNT_COOLDOWN_DAYS, HEADHUNT_PAY_BUMP, headhuntFee, headhuntTarget } from '../headhunt';
import { levelOf, hireFee } from '../people';
import { rivalHealth } from '../rivals';
import type { TycoonState } from '../types';

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'A', color: '#f00', seed: 11, country: 'GB', startYear: 1995 });
  s.company.cash = 1_000_000;
  s.rivals.forEach(r => (r.health = 80));
  return s;
};

describe('headhunting', () => {
  it('each rival carries a stable star, better at better firms', () => {
    const s = game();
    const r = s.rivals[0];
    expect(headhuntTarget(s, r).name).toBe(headhuntTarget(s, r).name);
    expect(levelOf(headhuntTarget(s, r))).toBeGreaterThanOrEqual(3);
    r.reputation = 90;
    expect(levelOf(headhuntTarget(s, r))).toBe(5);
    expect(headhuntFee(headhuntTarget(s, r))).toBe(hireFee(headhuntTarget(s, r)) * 3);
  });

  it('costs a premium, drains the rival, and the star arrives expecting a raise', () => {
    const s = game();
    const r = s.rivals[0];
    const star = headhuntTarget(s, r);
    const people = s.people.length;
    const rep = s.company.reputation;
    const out = headhunt(s, r.id);
    expect(out.result.ok).toBe(true);
    expect(out.state.people.length).toBe(people + 1);
    const hired = out.state.people[out.state.people.length - 1];
    expect(hired.name).toBe(star.name);
    expect(hired.payBump).toBe(HEADHUNT_PAY_BUMP);
    expect(hired.depotId).toBeTruthy();
    expect(s.company.cash - out.state.company.cash).toBe(headhuntFee(star));
    expect(rivalHealth(out.state.rivals[0])).toBeLessThan(rivalHealth(r));
    expect(out.state.company.reputation).toBeLessThan(rep);
  });

  it('refuses a repeat raid within the cooldown, and when broke', () => {
    const s = game();
    const r = s.rivals[0];
    const first = headhunt(s, r.id).state;
    expect(headhunt(first, r.id).result.ok).toBe(false);
    first.hour += 24 * HEADHUNT_COOLDOWN_DAYS;
    expect(headhunt(first, r.id).result.ok).toBe(true);
    s.company.cash = 10;
    expect(headhunt(s, s.rivals[1].id).result.ok).toBe(false);
    expect(headhunt(s, 'nobody').result.ok).toBe(false);
  });
});
