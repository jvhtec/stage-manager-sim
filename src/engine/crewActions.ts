import { CrewMember, Department, GameState } from '@/types/game';
import { getEventTimeWindow } from '@/lib/gameData';
import { rebuildEventCrises } from '@/lib/crisis';
import { createMoraleShift } from '@/lib/crewProgression';
import { createTransaction } from '@/lib/finance';
import { WEEKLY_RETAINER_HOURS_PER_CREW_MEMBER } from '@/lib/economy';
import type { Rng } from '@/lib/rng';
import type { ActionResult } from './types';

export function hireCrew(state: GameState, crew: CrewMember): GameState {
  return {
    ...state,
    crew: [...state.crew, crew],
  };
}

/** Hires a candidate from the current weekly pool, charging their signing bonus upfront. */
export function hireCandidate(
  state: GameState,
  candidateId: string,
): { state: GameState; result: ActionResult } {
  if (state.isBankrupt) {
    return {
      state,
      result: { success: false, reason: 'Company is bankrupt and cannot make new hires.' },
    };
  }

  const candidate = state.crewCandidates.find(c => c.id === candidateId);
  if (!candidate) {
    return { state, result: { success: false, reason: 'Candidate not found.' } };
  }

  if (state.company.balance < candidate.signingBonus) {
    return {
      state,
      result: {
        success: false,
        reason: `Need $${candidate.signingBonus} for ${candidate.name}'s signing bonus.`,
      },
    };
  }

  const newCrew: CrewMember = {
    id: `crew-${Date.now()}-${Math.random()}`,
    name: candidate.name,
    department: candidate.department,
    skillLevel: candidate.skillLevel,
    hourlyRate: candidate.askingRate,
    fatigue: 0,
    morale: 75,
    availableOn: new Date(state.currentDate),
    experience: candidate.experience,
    certifications: candidate.certifications,
  };

  const transaction = createTransaction(
    state.currentDate,
    'expense',
    candidate.signingBonus,
    `Signing bonus for ${candidate.name}`,
    'operations',
  );

  return {
    state: {
      ...state,
      crew: [...state.crew, newCrew],
      crewCandidates: state.crewCandidates.filter(c => c.id !== candidateId),
      company: { ...state.company, balance: state.company.balance - candidate.signingBonus },
      finances: {
        ...state.finances,
        transactions: [...state.finances.transactions, transaction],
      },
    },
    result: { success: true },
  };
}

/**
 * A single negotiation attempt per candidate. Reputation makes the company
 * a safer bet to push on; on success the candidate's terms improve, on a
 * clean failure they hold firm, and on a bad failure they walk away from
 * the table entirely — a real downside to pushing, not just a coin flip
 * with no cost. This is a manual, on-demand UI action outside the day-tick
 * simulation loop, so a one-off rng (created by the caller) is expected
 * here rather than the seeded sim state — same exception already made for
 * the "hire a candidate" skill roll in Crew.tsx.
 */
export function negotiateCandidateRate(
  state: GameState,
  candidateId: string,
  rng: Rng,
): { state: GameState; result: ActionResult } {
  const candidate = state.crewCandidates.find(c => c.id === candidateId);
  if (!candidate) {
    return { state, result: { success: false, reason: 'Candidate not found.' } };
  }

  if (candidate.negotiated) {
    return {
      state,
      result: {
        success: false,
        reason: `${candidate.name} already negotiated once this week.`,
      },
    };
  }

  const successChance = Math.min(0.85, 0.45 + state.company.reputation / 250);

  if (rng.chance(successChance)) {
    const rateCut = 0.08 + rng.next() * 0.12; // 8-20% off asking rate
    const bonusCut = 0.15 + rng.next() * 0.15; // 15-30% off signing bonus
    const updatedCandidate = {
      ...candidate,
      askingRate: Math.round(candidate.askingRate * (1 - rateCut)),
      signingBonus: Math.round(candidate.signingBonus * (1 - bonusCut)),
      negotiated: true,
    };
    return {
      state: {
        ...state,
        crewCandidates: state.crewCandidates.map(c => (c.id === candidateId ? updatedCandidate : c)),
      },
      result: { success: true, reason: `${candidate.name} agreed to better terms.` },
    };
  }

  if (rng.chance(0.25)) {
    return {
      state: {
        ...state,
        crewCandidates: state.crewCandidates.filter(c => c.id !== candidateId),
      },
      result: { success: false, reason: `${candidate.name} walked away from the table.` },
    };
  }

  return {
    state: {
      ...state,
      crewCandidates: state.crewCandidates.map(c =>
        c.id === candidateId ? { ...c, negotiated: true } : c,
      ),
    },
    result: { success: false, reason: `${candidate.name} wouldn't budge on terms.` },
  };
}

/**
 * Lays off a crew member. They must be released from any active show first
 * — firing mid-assignment would silently strand the event's staffing. A
 * two-week retainer's worth of severance is charged, and the rest of the
 * roster takes a small morale hit (a layoff unsettles everyone, not just
 * the person let go).
 */
export function fireCrew(
  state: GameState,
  crewId: string,
): { state: GameState; result: ActionResult } {
  const crew = state.crew.find(c => c.id === crewId);
  if (!crew) {
    return { state, result: { success: false, reason: 'Crew member not found.' } };
  }

  if (crew.assignedTo) {
    return {
      state,
      result: {
        success: false,
        reason: `${crew.name} is assigned to an active show — unassign them first.`,
      },
    };
  }

  const severance = Math.round(crew.hourlyRate * WEEKLY_RETAINER_HOURS_PER_CREW_MEMBER * 2);
  const transaction = createTransaction(
    state.currentDate,
    'expense',
    severance,
    `Severance for ${crew.name}`,
    'payroll',
  );

  const remainingCrew = state.crew
    .filter(c => c.id !== crewId)
    .map(c => ({
      ...c,
      morale: Math.max(0, c.morale - 5),
      recentMoraleShift: {
        ...createMoraleShift(`Unsettled by ${crew.name}'s departure`, -5, 'negative'),
        date: new Date(state.currentDate),
      },
    }));

  return {
    state: {
      ...state,
      crew: remainingCrew,
      company: { ...state.company, balance: state.company.balance - severance },
      finances: {
        ...state.finances,
        transactions: [...state.finances.transactions, transaction],
      },
    },
    result: { success: true },
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
