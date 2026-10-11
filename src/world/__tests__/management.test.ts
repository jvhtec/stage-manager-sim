import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { assignVehicle, bookGig, setManager, setSpendLimit } from '../actions';
import { dailyProduction, managerSalaries, MANAGERS, monthlyManagers, pmAnswer } from '../management';
import { projectCoverage } from '../queries';
import { forecastAccuracy } from '../cashflow';
import { pairKey } from '../bonds';
import { pickCrew } from '../people';
import type { CrewMember, Gig, TycoonState } from '../types';

const game = (year = 2005): TycoonState => {
  const s = createTycoonGame({ companyName: 'M', color: '#f00', seed: 7, country: 'GB', startYear: year });
  s.company.cash = 2_000_000;
  s.company.reputation = 70;
  return s;
};

describe('department heads', () => {
  it('hiring puts a salary on the books every month', () => {
    let s = game();
    s = setManager(s, 'production', true).state;
    s = setManager(s, 'finance', true).state;
    expect(managerSalaries(s)).toBe(MANAGERS.production.salary + MANAGERS.finance.salary);
    const cash = s.company.cash;
    monthlyManagers(s);
    expect(s.company.cash).toBe(cash - managerSalaries(s));
    expect(setManager(s, 'production', true).result.ok).toBe(false);
  });

  it('the production manager advances a show: cross-hires to meet the rider within the limit', () => {
    let s = game();
    const offer = s.gigs.find(g => g.status === 'offer' && g.techSpec && g.day - s.hour / 24 > 3)!;
    offer.techSpec = { inputs: 96, consoleFamily: 'DiGiCo' };
    s = bookGig(s, offer.id).state;
    s = assignVehicle(s, s.vehicles.find(v => v.owner === 'player')!.id, offer.id).state;
    s = setManager(s, 'production', true).state;
    s = setSpendLimit(s, 0.35).state;
    const gig = s.gigs.find(g => g.id === offer.id)!;
    gig.fee = 200_000;
    expect(projectCoverage(s, gig).breaches.length).toBeGreaterThan(0);
    s.hour = (gig.day - 3) * 24;
    dailyProduction(s);
    expect(gig.crossHire).toBeDefined();
    expect(projectCoverage(s, gig).breaches.some(b => b.id === 'showfile')).toBe(false);
    expect(gig.pmSpent).toBeLessThanOrEqual(gig.fee * 0.35);
  });

  it('answers change requests: quotes for clients who pay, holds the line with those who don’t', () => {
    const s = game();
    const g = { act: 'X', tier: 2, fee: 1000 } as Gig;
    s.clients = { X: { paid: 8, absorbed: 0, refused: 0, declined: 0 } };
    expect(pmAnswer(s, g, 'hour')).toBe('charge');
    s.clients = { X: { paid: 0, absorbed: 0, refused: 9, declined: 0 } };
    expect(pmAnswer(s, g, 'hour')).toBe('decline');
  });

  it('a crew chief keeps feuding people apart; a finance director sharpens the forecast', () => {
    const s = game();
    const [a, b, c] = s.people;
    s.bonds = { [pairKey(a.id, b.id)]: -45 };
    const pool = [b, c].map(m => ({ ...m, fatigue: 0 })) as CrewMember[];
    const gig = { tier: 2, needs: { audio: 1, console: 1, lighting: 1, video: 0, stage: 0 }, crewNeeded: 3 } as unknown as Gig;
    expect(pickCrew([...pool], gig, 2, [a], { bonds: s.bonds }).map(m => m.id)).toContain(b.id);
    expect(pickCrew([...pool], gig, 2, [a], { bonds: s.bonds, refuseAt: -40 }).map(m => m.id)).not.toContain(b.id);
    const before = forecastAccuracy(s);
    s.managers = { finance: true };
    expect(forecastAccuracy(s)).toBeLessThan(before);
  });
});
