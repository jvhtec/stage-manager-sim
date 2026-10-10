import { describe, expect, it } from 'vitest';
import { createTycoonGame } from '../state';
import { assignVehicle, bookGig, makeDecision } from '../actions';
import { changeChance, clientNote, clientTemper, makeChange, memoryOf, payChance, resolveChange } from '../changes';
import { dealRng } from '../sponsors';
import type { Gig, TycoonState } from '../types';

function booked(): { s: TycoonState; gig: Gig } {
  let s = createTycoonGame({ companyName: 'D', color: '#f00', seed: 77, country: 'GB', startYear: 1995 });
  s = { ...s, company: { ...s.company, cash: 1_000_000 } };
  const v = s.vehicles.find(x => x.owner === 'player')!;
  const gig = s.gigs.find(g => g.status === 'offer' && g.day - s.hour / 24 > 6)!;
  s = bookGig(s, gig.id).state;
  s = assignVehicle(s, v.id, gig.id).state;
  return { s, gig: s.gigs.find(g => g.id === gig.id)! };
}

const always = { chance: () => true, pick: <T,>(a: T[]) => a[0], next: () => 0, nextInt: () => 0 } as never;
const never = { chance: () => false, pick: <T,>(a: T[]) => a[0], next: () => 0.99, nextInt: () => 0 } as never;

describe('change orders', () => {
  it('clients have a fixed temper, hidden until you have history with them', () => {
    expect(clientTemper('Oasis')).toBe(clientTemper('Oasis'));
    const temps = new Set(['Oasis', 'Blur', 'Queen', 'Pulp', 'Suede', 'Elbow', 'Muse', 'Radiohead', 'Coldplay'].map(clientTemper));
    expect(temps.size).toBeGreaterThan(1);
    const { s, gig } = booked();
    expect(clientNote(s, gig.act)).toMatch(/No history/);
  });

  it('giving extras away makes a client ask for more', () => {
    const { s, gig } = booked();
    const base = changeChance(s, gig);
    resolveChange(s, gig, 'hour', 'absorb', always);
    resolveChange(s, gig, 'hour', 'absorb', always);
    expect(memoryOf(s, gig.act).absorbed).toBe(2);
    expect(changeChance(s, gig)).toBeGreaterThan(base);
    expect(clientNote(s, gig.act)).toMatch(/2 extras done for free/);
  });

  it('quoting for it: an agreeable client pays, a refusal costs goodwill, crew morale and cash', () => {
    const { s, gig } = booked();
    const fee = gig.fee;
    const out = resolveChange(s, gig, 'kit', 'charge', always);
    expect(out).toMatch(/agreed to pay/);
    expect(gig.fee).toBeGreaterThan(fee);
    expect(memoryOf(s, gig.act).paid).toBe(1);

    const t = booked();
    const cash = t.s.company.cash;
    const morale = t.s.crewMorale;
    const fee2 = t.gig.fee;
    const refused = resolveChange(t.s, t.gig, 'hour', 'charge', never);
    expect(refused).toMatch(/refused to pay/);
    expect(t.gig.fee).toBe(fee2);
    expect(t.s.company.cash).toBeLessThan(cash);
    expect(t.s.crewMorale).toBeLessThan(morale);
    expect(memoryOf(t.s, t.gig.act).refused).toBe(1);
    expect(payChance(t.s, t.gig)).toBeLessThan(0.95);
    expect(t.gig.trouble?.some(c => c.id === 'change-hour')).toBe(true);
  });

  it('as a decision: the unanswered default is to hold to the contract, and refusing the extra loses a little goodwill', () => {
    const { s, gig } = booked();
    s.artistRelations[gig.act] = 3;
    const made = makeChange(s, gig, always);
    expect(made.defaultOption).toBe('decline');
    s.dilemmas.push({ ...made, id: 'c1', gigId: gig.id, createdHour: s.hour, expiresHour: s.hour + 5 });
    const r = makeDecision(s, 'c1', 'decline');
    expect(r.result.ok).toBe(true);
    expect(r.state.artistRelations[gig.act]).toBe(2);
    expect(dealRng(r.state, 'x')).toBeDefined();
  });
});
