import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { bookRun } from '../actions';
import { RUN_BONUS_CAP, RUN_MIN_QUALITY, planRun, runBonusRate, runCandidates, settleRuns } from '../runs';
import type { TycoonState } from '../types';

const game = (): TycoonState => {
  let s = createTycoonGame({ companyName: 'R', color: '#f00', seed: 31, country: 'GB', startYear: 1995 });
  s = { ...s, company: { ...s.company, cash: 2_000_000, reputation: 45 } };
  return advanceHours(s, 24 * 14);
};
/** Up to n compatible candidate shows (different days, a plan that works). */
function pickRun(s: TycoonState, n: number) {
  const v = s.vehicles.find(x => x.owner === 'player')!;
  const chosen: string[] = [];
  for (const g of runCandidates(s, v)) {
    const trial = planRun(s, v, [...chosen, g.id]);
    if (trial.feasible) chosen.push(g.id);
    if (chosen.length === n) break;
  }
  return { v, ids: chosen };
}

describe('road runs', () => {
  it('bonus grows with dates up to a cap', () => {
    expect(runBonusRate(1)).toBe(0);
    expect(runBonusRate(2)).toBeCloseTo(0.03);
    expect(runBonusRate(4)).toBeCloseTo(0.09);
    expect(runBonusRate(20)).toBe(RUN_BONUS_CAP);
  });

  it('plans a run: legs, spare hours, costs and a net', () => {
    const s = game();
    const { v, ids } = pickRun(s, 3);
    expect(ids.length).toBeGreaterThanOrEqual(2);
    const plan = planRun(s, v, ids);
    expect(plan.feasible).toBe(true);
    expect(plan.stops).toHaveLength(ids.length);
    expect(plan.fees).toBe(plan.stops.reduce((a, b) => a + b.gig.fee, 0));
    expect(plan.distance).toBeGreaterThan(0);
    expect(plan.bonus).toBe(Math.round(plan.fees * plan.bonusRate));
    expect(plan.net).toBe(plan.fees + plan.bonus - plan.fuel - plan.travel);
    // Stops are in date order.
    for (let i = 1; i < plan.stops.length; i++) expect(plan.stops[i].gig.day).toBeGreaterThanOrEqual(plan.stops[i - 1].gig.day);
  });

  it('flags a stop the truck cannot reach in time', () => {
    const s = game();
    const { v, ids } = pickRun(s, 1);
    const g = s.gigs.find(x => x.id === ids[0])!;
    // Squeeze a second show into the same morning, far away.
    const far = s.gigs.find(x => x.status === 'offer' && x.cityId !== g.cityId && !x.tourId && !x.festival && !x.event)!;
    const clash = { ...far, id: 'clash', day: g.day, cityId: far.cityId };
    s.gigs.push(clash);
    const plan = planRun(s, v, [g.id, 'clash']);
    expect(plan.stops.some(st => st.spare < 0)).toBe(true);
    expect(plan.feasible).toBe(false);
  });

  it('books everything onto the truck and opens a run, or nothing at all', () => {
    const s = game();
    const { v, ids } = pickRun(s, 3);
    const out = bookRun(s, v.id, ids);
    expect(out.result.ok).toBe(true);
    ids.forEach(id => expect(out.state.gigs.find(g => g.id === id)!.status).toBe('booked'));
    expect(out.state.vehicles.find(x => x.id === v.id)!.orders).toEqual(expect.arrayContaining(ids));
    expect(out.state.runs).toHaveLength(ids.length > 1 ? 1 : 0);

    const broken = { ...s, company: { ...s.company, reputation: 0 } };
    const fail = bookRun(broken, v.id, ids);
    expect(fail.result.ok).toBe(false);
    ids.forEach(id => expect(fail.state.gigs.find(g => g.id === id)!.status).toBe('offer'));
    expect(fail.state.runs).toHaveLength(0);
  });

  it('pays the bonus when every date lands well, and not otherwise', () => {
    const s = game();
    const { v, ids } = pickRun(s, 3);
    const booked = bookRun(s, v.id, ids).state;
    // All delivered cleanly.
    const good = structuredClone(booked);
    good.gigs.forEach(g => {
      if (ids.includes(g.id)) {
        g.status = 'done';
        g.result = { quality: 0.8, payout: g.fee, lateHours: 0, gearCoverage: 1, crewCoverage: 1 } as never;
      }
    });
    const cash = good.company.cash;
    settleRuns(good);
    expect(good.runs[0].status).toBe('paid');
    expect(good.company.cash - cash).toBe(good.runs[0].bonus);
    expect(good.ledger[1995]?.bonuses ?? good.ledger[1996]?.bonuses ?? 0).toBeGreaterThan(0);

    // One rough night: no bonus.
    const rough = structuredClone(booked);
    rough.gigs.forEach(g => {
      if (ids.includes(g.id)) {
        g.status = 'done';
        g.result = { quality: g.id === ids[0] ? RUN_MIN_QUALITY - 0.1 : 0.9, payout: g.fee } as never;
      }
    });
    const cash2 = rough.company.cash;
    settleRuns(rough);
    expect(rough.runs[0].status).toBe('broken');
    expect(rough.company.cash).toBe(cash2);
  });

  it('waits while any date is still to play', () => {
    const s = game();
    const { v, ids } = pickRun(s, 2);
    const booked = bookRun(s, v.id, ids).state;
    settleRuns(booked);
    expect(booked.runs[0].status).toBe('active');
  });
});
