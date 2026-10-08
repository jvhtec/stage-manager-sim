import { describe, expect, it } from 'vitest';
import { createRng } from '@/lib/rng';
import { createTycoonGame } from '../state';
import { advanceHours } from '../sim';
import { buyGear, refurbishGear, sellGear, setPolicy } from '../actions';
import { evaluateGear } from '../loading';
import { HOURS_PER_DAY } from '../catalog';
import { condition, failureChance, ownedStock, rollFailure, wearFromShow } from '../wear';
import type { Gig, TycoonState } from '../types';

const game = (): TycoonState => {
  const s = createTycoonGame({ companyName: 'W', color: '#f00', seed: 6, country: 'GB', startYear: 1990 });
  return { ...s, company: { ...s.company, cash: 1_000_000 } };
};
const someProduct = (s: TycoonState) => Object.keys(s.depots[0].gear)[0];

describe('gear wear', () => {
  it('shows wear kit down; the workshop brings it back, at a monthly cost', () => {
    let s = game();
    const id = someProduct(s);
    wearFromShow(s, { [id]: ownedStock(s)[id] }, 5, false);
    expect(condition(s, id)).toBeLessThan(90);
    const worn = condition(s, id);

    const idle = advanceHours(setPolicy(s, 'workshop', 'none').state, 20 * HOURS_PER_DAY);
    expect(condition(idle, id)).toBeCloseTo(worn, 5);
    s = advanceHours(setPolicy(s, 'workshop', 'full').state, 40 * HOURS_PER_DAY);
    expect(condition(s, id)).toBeGreaterThan(worn + 5);
    expect(s.ledger[1990]?.workshop ?? 0).toBeLessThan(0);
  });

  it('worn kit performs worse and is likelier to fail', () => {
    const s = game();
    const id = someProduct(s);
    const gig = { tier: 1, needs: { audio: 1, console: 1, lighting: 1, video: 0, stage: 1 } } as unknown as Gig;
    const fresh = evaluateGear({ [id]: 1 }, gig, 1990);
    const tired = evaluateGear({ [id]: 1 }, gig, 1990, { [id]: 20 });
    expect(tired.quality).toBeLessThan(fresh.quality);
    expect(failureChance(30)).toBeGreaterThan(failureChance(90) * 10);
    const rng = createRng(1);
    const delivered = { [id]: 5 };
    let failed = 0;
    for (let i = 0; i < 200; i++) if (rollFailure({ ...s, gearCondition: { [id]: 5 } }, { ...delivered }, rng)) failed++;
    expect(failed).toBeGreaterThan(60);
  });

  it('new units lift the average; refurbishing restores it; worn kit sells for less', () => {
    let s = game();
    const id = someProduct(s);
    wearFromShow(s, { [id]: ownedStock(s)[id] }, 10, true);
    const worn = condition(s, id);
    const cashBefore = s.company.cash;
    const soldWorn = sellGear(s, s.depots[0].id, id).state.company.cash - cashBefore;
    s = buyGear(s, s.depots[0].id, id, ownedStock(s)[id]).state;
    expect(condition(s, id)).toBeGreaterThan(worn);
    const out = refurbishGear(s, id);
    expect(out.result.ok).toBe(true);
    expect(condition(out.state, id)).toBe(100);
    const soldNew = sellGear(out.state, s.depots[0].id, id).state.company.cash - out.state.company.cash;
    expect(soldNew).toBeGreaterThan(soldWorn);
  });
});
