import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { SERVICE_COST, SERVICE_INTERVAL_DAYS, HOURS_PER_DAY } from '../catalog';
import { breakdownCauses, canAfford, chainText, deferService, deferWorkshop, findIncident, nightCauses, postMortem, recordBreakdown, serviceCleared } from '../consequences';
import { dailyReceivables, LATE_RISK } from '../receivables';
import { dailyWorkshop } from '../wear';
import type { Gig, TycoonState } from '../types';

const game = (): TycoonState => createTycoonGame({ companyName: 'C', color: '#f00', seed: 7, country: 'GB', startYear: 1995 });
const fakeGig = (s: TycoonState, extra: Partial<Gig> = {}): Gig =>
  ({ id: 'g1', act: 'Blur', venueId: 'v', cityId: s.company.hqCityId, tier: 2, day: 10, status: 'booked', ...extra }) as unknown as Gig;

describe('cause and effect', () => {
  it('a cash squeeze defers the service and records why, naming the invoices', () => {
    const s = game();
    s.receivables.push({ id: 'i1', gigId: 'x', act: 'Oasis', amount: 40000, dueDay: 20, tier: 3, insured: false, slipped: true });
    s.company.cash = SERVICE_COST * 2;
    expect(canAfford(s, SERVICE_COST)).toBe(false);
    const v = s.vehicles.find(x => x.owner === 'player')!;
    deferService(s, v);
    const inc = findIncident(s, v.serviceSkipped!.incidentId)!;
    expect(inc.kind).toBe('cash');
    expect(inc.causes[0].id).toBe('unpaid-invoices');
    expect(inc.causes[0].detail).toMatch(/already late/);
    // Idempotent until it's paid.
    deferService(s, v);
    expect(s.incidents).toHaveLength(1);
    serviceCleared(v);
    expect(v.serviceSkipped).toBeUndefined();
  });

  it('a breakdown on a skipped service traces back to the cash squeeze', () => {
    const s = game();
    s.receivables.push({ id: 'i1', gigId: 'x', act: 'Oasis', amount: 40000, dueDay: 20, tier: 3, insured: false });
    s.company.cash = SERVICE_COST;
    const v = s.vehicles.find(x => x.owner === 'player')!;
    v.lastServiceHour = s.hour - (SERVICE_INTERVAL_DAYS + 25) * HOURS_PER_DAY;
    deferService(s, v);
    const gig = fakeGig(s);
    s.gigs.push(gig);
    v.orders = [gig.id];
    const bd = recordBreakdown(s, v, false);
    expect(bd.causes[0].id).toBe('overdue');
    expect(bd.causes[0].link).toBe(v.serviceSkipped!.incidentId);
    expect(gig.trouble?.[0].link).toBe(bd.id);
    // The late load-in names the breakdown, which names the missed service.
    const causes = nightCauses(s, gig, { lateHours: 5, failedKit: [], avgCondition: 90, crewCoverage: 1, crewFatigue: 10, forgotten: 0, unrehearsed: false, missingTickets: 0, venueNotes: [], present: true, workshop: 'basic', noKit: false });
    const why = postMortem(s, gig, 'The Forum', 0.45, false, causes);
    expect(why).toMatch(/Why:/);
    expect(why).toMatch(/Truck broke down|late/i);
    const late = causes.find(c => c.id === 'late')!;
    expect(chainText(s, late)).toMatch(/service deferred/);
  });

  it('a sound truck that breaks down is put down to bad luck, not blamed on you', () => {
    const s = game();
    const v = s.vehicles.find(x => x.owner === 'player')!;
    v.reliability = 99;
    v.lastServiceHour = s.hour;
    expect(breakdownCauses(s, v, false)[0].id).toBe('bad-luck');
  });

  it('an unpaid workshop bill leaves the benches idle until cash returns', () => {
    const s = game();
    s.policies.workshop = 'full';
    s.gearCondition = { [Object.keys(s.depots[0].gear)[0]]: 40 };
    const id = Object.keys(s.gearCondition)[0];
    s.company.cash = 100;
    expect(deferWorkshop(s, 5000)).toBe(true);
    expect(s.lapses?.workshop).toBeDefined();
    dailyWorkshop(s);
    expect(s.gearCondition[id]).toBe(40);
    s.company.cash = 1_000_000;
    expect(deferWorkshop(s, 5000)).toBe(false);
    expect(s.lapses?.workshop).toBeUndefined();
  });

  it('promoters sometimes pay late, and the delay is announced', () => {
    const s = game();
    s.receivables.push({ id: 'i1', gigId: 'x', act: 'Oasis', amount: 9000, dueDay: 5, tier: 3, insured: false });
    s.hour = 6 * HOURS_PER_DAY;
    const always = { chance: () => true, nextInt: () => 5, next: () => 0.5 } as never;
    dailyReceivables(s, always);
    expect(s.receivables[0].dueDay).toBeGreaterThan(5);
    expect(s.receivables[0].slipped).toBe(true);
    expect(s.news.some(n => /late paying/.test(n.text))).toBe(true);
    expect(LATE_RISK[3]).toBeGreaterThan(0);
  });
});
