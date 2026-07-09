import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../state';
import { assignCrewToEvent, unassignCrewFromEvent, hireCrew } from '../crewActions';
import { generateEvent } from '@/lib/gameData';
import { createRng } from '@/lib/rng';
import type { CrewMember } from '@/types/game';

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
