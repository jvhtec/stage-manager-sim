import { describe, expect, it } from 'vitest';
import { createNewGameState } from '../state';
import { assignCrewToEvent } from '../crewActions';
import { assignEquipmentToEvent } from '../equipmentActions';
import { acceptEvent, completeEvent } from '../eventActions';
import { generateEvent, isEventEquipmentReady, isEventFullyStaffed } from '@/lib/gameData';
import { createRng } from '@/lib/rng';
import type { Department } from '@/types/game';

function fullyStaffedAndEquippedState() {
  const state = createNewGameState();
  const event = generateEvent(new Date('2026-08-01'), 'gig', createRng(1), 50);
  let working = { ...state, events: [...state.events, event] };

  (['audio', 'lighting', 'video', 'stage'] as Department[]).forEach(dept => {
    const required = event.requirements[dept];
    const candidates = working.crew.filter(c => c.department === dept && !c.assignedTo);
    for (let i = 0; i < required; i++) {
      const crew = candidates[i];
      const outcome = assignCrewToEvent(working, event.id, crew.id, dept);
      working = outcome.state;
    }
  });

  (['audio', 'lighting', 'video', 'stage'] as Department[]).forEach(dept => {
    const requirements = event.equipmentRequirements[dept] ?? [];
    const requiredCount = requirements.reduce((sum, req) => sum + req.quantity, 0);
    const candidates = working.equipment.filter(eq => eq.department === dept && eq.status === 'available');
    for (let i = 0; i < requiredCount; i++) {
      const item = candidates[i];
      const outcome = assignEquipmentToEvent(working, event.id, item.id, dept);
      working = outcome.state;
    }
  });

  return { state: working, eventId: event.id };
}

describe('acceptEvent', () => {
  it('moves a fully staffed and equipped event to planned', () => {
    const { state, eventId } = fullyStaffedAndEquippedState();
    const event = state.events.find(e => e.id === eventId)!;
    expect(isEventFullyStaffed(event)).toBe(true);
    expect(isEventEquipmentReady(event)).toBe(true);

    const nextState = acceptEvent(state, eventId);

    expect(nextState.events.find(e => e.id === eventId)?.status).toBe('planned');
  });

  it('leaves an understaffed event untouched', () => {
    const state = createNewGameState();
    const event = generateEvent(new Date('2026-08-01'), 'gig', createRng(1), 50);
    const withEvent = { ...state, events: [...state.events, event] };

    const nextState = acceptEvent(withEvent, event.id);

    expect(nextState.events.find(e => e.id === event.id)?.status).toBe('available');
  });

  it('generates risk/crisis prompts for the event now that it is planned', () => {
    // Regression test: crises are only ever generated for planned/in-progress
    // events, and acceptEvent is what makes that transition. A prior refactor
    // silently dropped this, which meant no accepted show ever got a crisis
    // prompt (not even the always-on "spot check" fallback) for the entire
    // pre-show risk panel and show-day flow.
    const { state, eventId } = fullyStaffedAndEquippedState();
    const nextState = acceptEvent(state, eventId);

    const eventCrises = nextState.crises.filter(c => c.eventId === eventId);
    expect(eventCrises.length).toBeGreaterThan(0);
  });
});

describe('completeEvent', () => {
  it('pays out client income minus payroll, and returns a summary', () => {
    const { state, eventId } = fullyStaffedAndEquippedState();
    const accepted = acceptEvent(state, eventId);
    const event = accepted.events.find(e => e.id === eventId)!;

    const { state: nextState, result } = completeEvent(accepted, eventId, 80);

    expect(result).toBeDefined();
    expect(result!.eventId).toBe(eventId);
    expect(result!.financial.income).toBeGreaterThanOrEqual(event.clientPay);
    expect(nextState.events.find(e => e.id === eventId)?.status).toBe('completed');
    expect(nextState.company.balance).toBe(result!.financial.newBalance);

    // Crew assigned to the show are released and sent into recovery.
    const assignedCrewIds = new Set(
      Object.values(event.assignedCrew).flat().map(c => c.id),
    );
    nextState.crew
      .filter(c => assignedCrewIds.has(c.id))
      .forEach(c => expect(c.assignedTo).toBeUndefined());
  });

  it('does nothing for an unknown event id', () => {
    const state = createNewGameState();
    const { state: nextState, result } = completeEvent(state, 'not-a-real-event', 80);

    expect(result).toBeUndefined();
    expect(nextState).toBe(state);
  });

  it('still allows finishing an already-committed show while bankrupt — it is a way out, not blocked', () => {
    const { state, eventId } = fullyStaffedAndEquippedState();
    const accepted = { ...acceptEvent(state, eventId), isBankrupt: true };

    const { result } = completeEvent(accepted, eventId, 80);

    expect(result).toBeDefined();
  });

  it('refuses to complete anything once the game is truly over', () => {
    const { state, eventId } = fullyStaffedAndEquippedState();
    const accepted = { ...acceptEvent(state, eventId), isGameOver: true };

    const { result } = completeEvent(accepted, eventId, 80);

    expect(result).toBeUndefined();
  });

  it('bumps company.level when reputation gains cross a tier boundary', () => {
    const { state, eventId } = fullyStaffedAndEquippedState();
    const nearTierThree = {
      ...acceptEvent(state, eventId),
      company: { ...state.company, reputation: 59, level: 2 }, // tier 3 starts at 60
    };

    const { state: nextState } = completeEvent(nearTierThree, eventId, 100);

    expect(nextState.company.reputation).toBeGreaterThanOrEqual(60);
    expect(nextState.company.level).toBe(3);
  });
});
