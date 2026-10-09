import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { assignVehicle, bookGig, makeDecision } from '../actions';
import { HOURS_PER_DAY } from '../catalog';
import { breakdownDilemma, dailyCrewDilemmas, hourlyCrises, recoveryCost, resolveDilemma } from '../dilemmas';
import { dayRate } from '../people';
import { loadInHour } from '../core';
import { rollWeather } from '../incidents';
import type { Gig, TycoonState } from '../types';

const yes = { next: () => 0, chance: () => true, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;

/** A booked show with the first truck assigned, ready to go wrong. */
function scenario(): { s: TycoonState; gig: Gig } {
  let s = createTycoonGame({ companyName: 'D', color: '#f00', seed: 77, country: 'GB', startYear: 1995 });
  s = { ...s, company: { ...s.company, cash: 1_000_000 } };
  const v = s.vehicles.find(x => x.owner === 'player')!;
  const gig = s.gigs.find(g => g.status === 'offer' && g.day - s.hour / 24 > 6) ?? s.gigs.find(g => g.status === 'offer')!;
  s = bookGig(s, gig.id).state;
  s = assignVehicle(s, v.id, gig.id).state;
  return { s, gig: s.gigs.find(g => g.id === gig.id)! };
}

describe('on-the-day decisions', () => {
  it('a breakdown with a show waiting asks what to do; recovery gets the truck moving', () => {
    const { s } = scenario();
    const v = s.vehicles.find(x => x.owner === 'player')!;
    v.status = 'broken';
    v.brokenUntil = s.hour + 30;
    breakdownDilemma(s, v);
    expect(s.dilemmas).toHaveLength(1);
    const cash = s.company.cash;
    const d = s.dilemmas[0];
    const r = makeDecision(s, d.id, 'recovery');
    expect(r.result.ok).toBe(true);
    expect(r.state.dilemmas).toHaveLength(0);
    expect(r.state.vehicles.find(x => x.id === v.id)!.brokenUntil!).toBeLessThanOrEqual(s.hour + 1);
    expect(cash - r.state.company.cash).toBe(recoveryCost(v));
  });

  it('a breakdown with nothing booked is just a breakdown', () => {
    const s = createTycoonGame({ companyName: 'D', color: '#f00', seed: 77, country: 'GB', startYear: 1995 });
    const v = s.vehicles.find(x => x.owner === 'player')!;
    breakdownDilemma(s, v);
    expect(s.dilemmas).toHaveLength(0);
  });

  it('unanswered problems fall back to the default at the deadline', () => {
    const { s, gig } = scenario();
    s.hour = loadInHour(gig);
    hourlyCrises(s, yes);
    expect(s.dilemmas.length).toBe(1);
    const d = s.dilemmas[0];
    s.hour = d.expiresHour;
    hourlyCrises(s, { ...(yes as object), chance: () => false } as never);
    expect(s.dilemmas).toHaveLength(0);
    expect(s.news[0].text).toMatch(/No answer/);
  });

  it('venue choices become show modifiers', () => {
    const { s, gig } = scenario();
    s.dilemmas.push({
      id: 'x',
      kind: 'power',
      title: 't',
      text: 't',
      options: [{ id: 'house', label: 'House power', detail: '' }],
      defaultOption: 'house',
      gigId: gig.id,
      createdHour: s.hour,
      expiresHour: s.hour + 5,
    });
    resolveDilemma(s, 'x', 'house');
    const g = s.gigs.find(x => x.id === gig.id)!;
    expect(g.mods?.quality).toBeLessThan(0);
    expect(g.mods?.failureFactor).toBeGreaterThan(1);
  });

  it('ballast cuts the odds of a storm', () => {
    const { s, gig } = scenario();
    const g = { ...gig, festival: { id: 'f', year: 1995, stage: 'Main', main: true }, days: 3 } as Gig;
    const rng = { next: () => 0.1, chance: () => false, pick: <T,>(a: T[]) => a[0], nextInt: () => 0, nextRange: (a: number) => a } as never;
    expect(rollWeather(s, g, rng)).toBeNull();
    const odds: number[] = [];
    const spy = { ...(rng as object), chance: (p: number) => (odds.push(p), false) } as never;
    rollWeather(s, g, spy);
    const plain = odds[0];
    odds.length = 0;
    rollWeather(s, { ...g, mods: { stormFactor: 0.35 } }, spy);
    expect(odds[0]).toBeCloseTo(plain * 0.35, 5);
  });

  it('the clock stops when a new decision appears', () => {
    const { s, gig } = scenario();
    const jumped = advanceHours(s, (gig.day + 3) * HOURS_PER_DAY - s.hour, true);
    // Either something came up and we stopped early, or the run was quiet — never skipped past an open decision.
    if (jumped.dilemmas.length) expect(jumped.hour).toBeLessThan((gig.day + 3) * HOURS_PER_DAY);
  });

  it('overseas rigs get held at customs: broker, partial release or wait', () => {
    const { s, gig } = scenario();
    const g = s.gigs.find(x => x.id === gig.id)!;
    g.overseas = { regionId: 'europe', stops: [{ city: 'Paris', country: 'France', venue: 'Bercy', day: g.day }] };
    s.hour = loadInHour(g);
    hourlyCrises(s, yes);
    expect(s.dilemmas[0]?.kind).toBe('customs');
    const d = s.dilemmas[0];
    expect(d.options.map(o => o.id)).toEqual(['broker', 'partial', 'wait']);
    const cash = s.company.cash;
    const broker = makeDecision(s, d.id, 'broker').state;
    expect(cash - broker.company.cash).toBe(Math.round(g.fee * 0.03));
    expect(broker.gigs.find(x => x.id === g.id)!.mods?.quality ?? 0).toBe(0);
    const waited = makeDecision(s, d.id, 'wait').state;
    expect(waited.gigs.find(x => x.id === g.id)!.mods!.quality).toBeLessThan(0);
    expect(waited.company.cash).toBe(cash);
  });

  describe('crew on the road', () => {
    /** A booked show with the truck loaded: a star and an exhausted tech aboard. */
    function aboardScenario() {
      const { s } = scenario();
      const v = s.vehicles.find(x => x.owner === 'player')!;
      const star = s.people[0];
      const tired = s.people[1];
      star.skills[star.primary] = 4;
      tired.fatigue = 90;
      tired.skills[tired.primary] = 2;
      [star, tired].forEach(m => {
        m.vehicleId = v.id;
        m.depotId = undefined;
      });
      return { s, v, star, tired };
    }

    it('a star on the road can ask for a raise: accept, bonus or lose them', () => {
      const { s, star } = aboardScenario();
      dailyCrewDilemmas(s, yes, 40);
      const d = s.dilemmas.find(x => x.kind === 'raise' && x.personId === star.id)!;
      expect(d).toBeTruthy();
      expect(d.options.map(o => o.id)).toEqual(['raise', 'bonus', 'refuse']);
      expect(d.defaultOption).toBe('bonus');

      const before = dayRate(star);
      const raised = makeDecision(s, d.id, 'raise').state;
      const m = raised.people.find(p => p.id === star.id)!;
      expect(dayRate(m)).toBeCloseTo(before * 1.15, 5);
      expect(m.loyalUntil).toBeGreaterThan(s.hour);

      const cash = s.company.cash;
      const bonus = makeDecision(s, d.id, 'bonus').state;
      expect(cash - bonus.company.cash).toBe(d.options[1].cost);
      expect(bonus.people.some(p => p.id === star.id)).toBe(true);

      const walked = makeDecision(s, d.id, 'refuse').state;
      expect(walked.people.some(p => p.id === star.id)).toBe(false);
      expect(walked.news[0].text).toMatch(/quit mid-tour/);
    });

    it('exhausted people can burn out: send home or push through', () => {
      const { s, tired, v } = aboardScenario();
      dailyCrewDilemmas(s, yes, 80);
      const d = s.dilemmas.find(x => x.kind === 'burnout' && x.personId === tired.id)!;
      expect(d).toBeTruthy();
      const home = makeDecision(s, d.id, 'rest').state;
      const p = home.people.find(x => x.id === tired.id)!;
      expect(p.vehicleId).toBeUndefined();
      expect(p.depotId).toBeTruthy();
      expect(home.vehicles.find(x => x.id === v.id)!.crew).toBeLessThan(2);
      const pushed = makeDecision(s, d.id, 'push').state;
      expect(pushed.people.find(x => x.id === tired.id)!.vehicleId).toBe(v.id);
      expect(pushed.gigs.find(g => g.id === d.gigId)!.mods!.quality).toBeLessThan(0);
    });

    it('asks at most once per person, never for rested juniors at home, and not while loyal', () => {
      const { s, star, tired } = aboardScenario();
      dailyCrewDilemmas(s, yes, 40);
      const n = s.dilemmas.length;
      dailyCrewDilemmas(s, yes, 40);
      expect(s.dilemmas.length).toBe(n);
      s.dilemmas = [];
      star.loyalUntil = s.hour + 100;
      tired.fatigue = 0;
      dailyCrewDilemmas(s, yes, 40);
      expect(s.dilemmas).toHaveLength(0);
      const home = scenario().s;
      dailyCrewDilemmas(home, yes, 40);
      expect(home.dilemmas.filter(x => x.kind === 'raise' || x.kind === 'burnout')).toHaveLength(0);
    });
  });
});
