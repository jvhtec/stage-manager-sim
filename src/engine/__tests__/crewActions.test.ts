import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../state';
import {
  assignCrewToEvent,
  unassignCrewFromEvent,
  hireCrew,
  hireCandidate,
  negotiateCandidateRate,
  fireCrew,
} from '../crewActions';
import { generateEvent, generateCandidate } from '@/lib/gameData';
import { createRng } from '@/lib/rng';
import type { CrewCandidate, CrewMember } from '@/types/game';

function baseState() {
  const state = createNewGameState();
  const event = generateEvent(new Date('2026-08-01'), 'gig', createRng(1), 50);
  return { ...state, events: [...state.events, event] };
}

describe('assignCrewToEvent', () => {
  it('assigns an available crew member to the requested department', () => {
    const state = baseState();
    const event = state.events[state.events.length - 1];
    const crew = state.crew.find(c => c.department === 'audio')!;

    const { state: nextState, result } = assignCrewToEvent(state, event.id, crew.id, 'audio');

    expect(result.success).toBe(true);
    expect(nextState.crew.find(c => c.id === crew.id)?.assignedTo).toBe(event.id);
    expect(nextState.events.find(e => e.id === event.id)?.assignedCrew.audio).toHaveLength(1);
    // Original state is untouched (pure function).
    expect(state.crew.find(c => c.id === crew.id)?.assignedTo).toBeUndefined();
  });

  it('rejects assignment when the company is bankrupt', () => {
    const state = { ...baseState(), isBankrupt: true };
    const event = state.events[state.events.length - 1];
    const crew = state.crew[0];

    const { result } = assignCrewToEvent(state, event.id, crew.id, 'audio');

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/bankrupt/i);
  });

  it('rejects a crew member already assigned to a different event', () => {
    const state = baseState();
    const [eventA, eventB] = [
      generateEvent(new Date('2026-08-05'), 'gig', createRng(2), 50),
      generateEvent(new Date('2026-08-06'), 'gig', createRng(3), 50),
    ];
    const withEvents = { ...state, events: [...state.events, eventA, eventB] };
    const crew = withEvents.crew.find(c => c.department === 'audio')!;

    const first = assignCrewToEvent(withEvents, eventA.id, crew.id, 'audio');
    expect(first.result.success).toBe(true);

    const second = assignCrewToEvent(first.state, eventB.id, crew.id, 'audio');
    expect(second.result.success).toBe(false);
    expect(second.result.reason).toMatch(/already assigned/i);
  });

  it('rejects an over-fatigued crew member', () => {
    const state = baseState();
    const event = state.events[state.events.length - 1];
    const tiredCrew: CrewMember = { ...state.crew[0], fatigue: 90 };
    const withTiredCrew = { ...state, crew: [tiredCrew, ...state.crew.slice(1)] };

    const { result } = assignCrewToEvent(withTiredCrew, event.id, tiredCrew.id, tiredCrew.department);

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/fatigued/i);
  });
});

describe('unassignCrewFromEvent', () => {
  it('frees the crew member and removes them from the event roster', () => {
    const state = baseState();
    const event = state.events[state.events.length - 1];
    const crew = state.crew.find(c => c.department === 'stage')!;

    const { state: assigned } = assignCrewToEvent(state, event.id, crew.id, 'stage');
    const unassigned = unassignCrewFromEvent(assigned, event.id, crew.id);

    expect(unassigned.crew.find(c => c.id === crew.id)?.assignedTo).toBeUndefined();
    expect(unassigned.events.find(e => e.id === event.id)?.assignedCrew.stage).toHaveLength(0);
  });
});

describe('hireCrew', () => {
  it('appends the new crew member without mutating the original list', () => {
    const state = baseState();
    const recruit: CrewMember = {
      ...state.crew[0],
      id: 'crew-new-1',
      name: 'New Recruit',
    };

    const nextState = hireCrew(state, recruit);

    expect(nextState.crew).toHaveLength(state.crew.length + 1);
    expect(nextState.crew.at(-1)?.id).toBe('crew-new-1');
    expect(state.crew).toHaveLength(state.crew.length); // original untouched
  });
});

function candidateState(candidate: CrewCandidate) {
  const state = baseState();
  return { ...state, crewCandidates: [candidate] };
}

describe('hireCandidate', () => {
  it('converts the candidate into a crew member and charges the signing bonus', () => {
    const candidate = generateCandidate('audio', createRng(10), new Date('2026-08-01'), 50);
    const state = candidateState(candidate);
    const startingBalance = state.company.balance;

    const { state: nextState, result } = hireCandidate(state, candidate.id);

    expect(result.success).toBe(true);
    expect(nextState.crewCandidates).toHaveLength(0);
    expect(nextState.crew.at(-1)?.name).toBe(candidate.name);
    expect(nextState.crew.at(-1)?.hourlyRate).toBe(candidate.askingRate);
    expect(nextState.company.balance).toBe(startingBalance - candidate.signingBonus);
  });

  it('rejects hiring when the company cannot afford the signing bonus', () => {
    const candidate = generateCandidate('audio', createRng(10), new Date('2026-08-01'), 50);
    const state = {
      ...candidateState(candidate),
      company: { ...candidateState(candidate).company, balance: 0 },
    };

    const { result } = hireCandidate(state, candidate.id);

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/signing bonus/i);
  });

  it('rejects hiring while bankrupt', () => {
    const candidate = generateCandidate('audio', createRng(10), new Date('2026-08-01'), 50);
    const state = { ...candidateState(candidate), isBankrupt: true };

    const { result } = hireCandidate(state, candidate.id);

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/bankrupt/i);
  });
});

describe('negotiateCandidateRate', () => {
  it('improves terms and marks the candidate as negotiated on success', () => {
    const candidate = generateCandidate('audio', createRng(10), new Date('2026-08-01'), 50);
    const state = candidateState(candidate);
    // Rigged rng: chance() always true for the success roll and the rate/bonus rolls.
    const rng = { ...createRng(1), chance: () => true, next: () => 0.5 };

    const { state: nextState, result } = negotiateCandidateRate(state, candidate.id, rng);

    expect(result.success).toBe(true);
    const updated = nextState.crewCandidates[0];
    expect(updated.negotiated).toBe(true);
    expect(updated.askingRate).toBeLessThan(candidate.askingRate);
    expect(updated.signingBonus).toBeLessThan(candidate.signingBonus);
  });

  it('removes the candidate when a failed negotiation makes them walk', () => {
    const candidate = generateCandidate('audio', createRng(10), new Date('2026-08-01'), 50);
    const state = candidateState(candidate);
    // First chance() call is the negotiation roll (fails), second is the
    // walk-away roll (succeeds).
    let calls = 0;
    const rng = { ...createRng(1), chance: () => { calls += 1; return calls === 2; } };

    const { state: nextState, result } = negotiateCandidateRate(state, candidate.id, rng);

    expect(result.success).toBe(false);
    expect(nextState.crewCandidates).toHaveLength(0);
  });

  it('rejects a second negotiation attempt on the same candidate', () => {
    const candidate = generateCandidate('audio', createRng(10), new Date('2026-08-01'), 50);
    const alreadyNegotiated = { ...candidate, negotiated: true };
    const state = candidateState(alreadyNegotiated);

    const { result } = negotiateCandidateRate(state, candidate.id, createRng(1));

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/already negotiated/i);
  });
});

describe('fireCrew', () => {
  it('removes the crew member, charges severance, and dents remaining morale', () => {
    const state = baseState();
    const target = state.crew[0];
    const startingBalance = state.company.balance;
    const otherMoraleBefore = state.crew[1].morale;

    const { state: nextState, result } = fireCrew(state, target.id);

    expect(result.success).toBe(true);
    expect(nextState.crew.find(c => c.id === target.id)).toBeUndefined();
    expect(nextState.crew).toHaveLength(state.crew.length - 1);
    expect(nextState.company.balance).toBeLessThan(startingBalance);
    const remaining = nextState.crew.find(c => c.id === state.crew[1].id)!;
    expect(remaining.morale).toBe(Math.max(0, otherMoraleBefore - 5));
  });

  it('refuses to fire a crew member currently assigned to a show', () => {
    const state = baseState();
    const event = state.events[state.events.length - 1];
    const crew = state.crew.find(c => c.department === 'audio')!;
    const { state: assigned } = assignCrewToEvent(state, event.id, crew.id, 'audio');

    const { result } = fireCrew(assigned, crew.id);

    expect(result.success).toBe(false);
    expect(result.reason).toMatch(/unassign/i);
  });
});
