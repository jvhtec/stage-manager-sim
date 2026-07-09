import { CrewMember, Department, GameState } from '@/types/game';
import { getEventTimeWindow } from '@/lib/gameData';
import { rebuildEventCrises } from '@/lib/crisis';
import type { ActionResult } from './types';

export function hireCrew(state: GameState, crew: CrewMember): GameState {
  return {
    ...state,
    crew: [...state.crew, crew],
  };
}

export function assignCrewToEvent(
  state: GameState,
  eventId: string,
  crewId: string,
  department: Department,
): { state: GameState; result: ActionResult } {
  if (state.isBankrupt) {
    return {
      state,
      result: { success: false, reason: 'Company is bankrupt. Resolve finances before assigning crew.' },
    };
  }

  const event = state.events.find(e => e.id === eventId);
  const crew = state.crew.find(c => c.id === crewId);
  if (!event || !crew) {
    return { state, result: { success: false, reason: 'Crew or event not found' } };
  }

  if (event.status === 'failed') {
    return {
      state,
      result: { success: false, reason: 'This contract has already been awarded to a competitor.' },
    };
  }

  if (crew.assignedTo && crew.assignedTo !== eventId) {
    return {
      state,
      result: { success: false, reason: `${crew.name} is already assigned to another event.` },
    };
  }

  const departmentAssignments = event.assignedCrew[department];
  if (departmentAssignments.some(c => c.id === crewId)) {
    return {
      state,
      result: { success: false, reason: `${crew.name} is already on this team's roster.` },
    };
  }

  const { eventStart } = getEventTimeWindow(event);
  const crewAvailable = new Date(crew.availableOn);
  if (crewAvailable > eventStart) {
    return {
      state,
      result: {
        success: false,
        reason: `${crew.name} is traveling or resting until ${crewAvailable.toLocaleDateString()}.`,
      },
    };
  }

  if (crew.fatigue >= 85) {
    return {
      state,
      result: { success: false, reason: `${crew.name} is too fatigued to take on another show.` },
    };
  }

  const updatedCrewMember: CrewMember = {
    ...crew,
    assignedTo: eventId,
  };

  const updatedCrewList = state.crew.map(c => (c.id === crewId ? updatedCrewMember : c));
  const updatedEvents = state.events.map(e => {
    if (e.id === eventId) {
      return {
        ...e,
        assignedCrew: {
          ...e.assignedCrew,
          [department]: [...e.assignedCrew[department], updatedCrewMember],
        },
      };
    }
    return e;
  });
  const updatedEvent = updatedEvents.find(e => e.id === eventId) ?? event;
  const updatedCrises = rebuildEventCrises(
    state.crises,
    updatedEvent,
    updatedCrewList,
    state.equipment,
    state.company.reputation,
    state.company.specialization,
  );

  return {
    state: {
      ...state,
      crew: updatedCrewList,
      events: updatedEvents,
      crises: updatedCrises,
    },
    result: { success: true },
  };
}

export function unassignCrewFromEvent(
  state: GameState,
  eventId: string,
  crewId: string,
): GameState {
  const updatedCrewList = state.crew.map(c =>
    c.id === crewId ? { ...c, assignedTo: undefined } : c,
  );
  const updatedEvents = state.events.map(e => {
    if (e.id === eventId) {
      return {
        ...e,
        assignedCrew: {
          audio: e.assignedCrew.audio.filter(c => c.id !== crewId),
          lighting: e.assignedCrew.lighting.filter(c => c.id !== crewId),
          video: e.assignedCrew.video.filter(c => c.id !== crewId),
          stage: e.assignedCrew.stage.filter(c => c.id !== crewId),
        },
      };
    }
    return e;
  });
  const updatedEvent = updatedEvents.find(e => e.id === eventId);
  const updatedCrises = updatedEvent
    ? rebuildEventCrises(
        state.crises,
        updatedEvent,
        updatedCrewList,
        state.equipment,
        state.company.reputation,
        state.company.specialization,
      )
    : state.crises;

  return {
    ...state,
    crew: updatedCrewList,
    events: updatedEvents,
    crises: updatedCrises,
  };
}
