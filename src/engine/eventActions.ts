import {
  CrewMember,
  EquipmentItem,
  EventPostReport,
  FinancialTransaction,
  GameState,
  MarketNewsItem,
} from '@/types/game';
import {
  calculateEventCost,
  getCrewRecoveryDays,
  getEquipmentWearForEvent,
  isEventEquipmentReady,
  isEventFullyStaffed,
} from '@/lib/gameData';
import { evaluateCrisisOutcomes, rebuildEventCrises } from '@/lib/crisis';
import { applyExperienceGain, ExperienceGainResult } from '@/lib/crewProgression';
import { createTransaction, evaluateFinancialState } from '@/lib/finance';
import { syncCompanyLevel } from '@/lib/reputationTiers';
import type { EventCompletionSummary } from './types';

export function acceptEvent(state: GameState, eventId: string): GameState {
  if (state.isBankrupt) {
    return state;
  }

  const event = state.events.find(e => e.id === eventId);
  if (!event) {
    return state;
  }

  if (!isEventFullyStaffed(event) || !isEventEquipmentReady(event)) {
    return state;
  }

  const updatedEvents = state.events.map(e => {
    if (e.id !== eventId) return e;
    const clearedBids = e.bids.length
      ? e.bids.map(bid => ({ ...bid, status: 'lost' as const, submittedOn: new Date() }))
      : e.bids;
    return { ...e, status: 'planned' as const, bids: clearedBids };
  });
  const updatedEvent = updatedEvents.find(e => e.id === eventId);
  // Crises are only ever generated for planned/in-progress events, and
  // acceptEvent is what makes that transition — so this is the first
  // moment planning-stage (and eventually execution-stage) risk prompts
  // for this show come into existence.
  const updatedCrises = updatedEvent
    ? rebuildEventCrises(
        state.crises,
        updatedEvent,
        state.crew,
        state.equipment,
        state.company.reputation,
        state.company.specialization,
      )
    : state.crises;

  const updatedCompetitors = state.competitors.map(competitor =>
    competitor.activeBids.includes(eventId)
      ? { ...competitor, activeBids: competitor.activeBids.filter(id => id !== eventId) }
      : competitor,
  );

  const acceptanceNews =
    event.bids.length > 0
      ? ({
          id: `market-${Date.now()}-${event.id}-player-win`,
          date: new Date(),
          title: `${state.company.name} locks ${event.name}`,
          summary: `${state.company.name} confirmed the ${event.venue} contract ahead of ${event.bids.length} rival bids.`,
          tone: 'positive' as const,
          eventId: event.id,
        } satisfies MarketNewsItem)
      : undefined;

  const nextNews = acceptanceNews
    ? [acceptanceNews, ...state.marketNews].slice(0, 8)
    : state.marketNews;

  return {
    ...state,
    events: updatedEvents,
    crises: updatedCrises,
    competitors: updatedCompetitors,
    marketNews: nextNews,
  };
}

export function completeEvent(
  state: GameState,
  eventId: string,
  satisfaction: number,
): { state: GameState; result: EventCompletionSummary | undefined } {
  // Deliberately NOT blocked by isBankrupt: a show already staffed and
  // rented is a sunk cost either way, and finishing it to collect payment
  // is one of the few ways out of a cash crunch. Only a genuine game over
  // stops it.
  if (state.isGameOver) {
    return { state, result: undefined };
  }

  const event = state.events.find(e => e.id === eventId);
  if (!event) {
    return { state, result: undefined };
  }

  const cost = calculateEventCost(event);
  const eventCrises = state.crises.filter(crisis => crisis.eventId === eventId);
  const { satisfactionDelta, additionalExpenses, outcomes } = evaluateCrisisOutcomes(
    event,
    eventCrises,
  );
  const finalSatisfaction = Math.max(0, Math.min(100, satisfaction + satisfactionDelta));
  const reputationGain = Math.floor((finalSatisfaction / 100) * 5);

  const transactions: FinancialTransaction[] = [...state.finances.transactions];

  const assignedEquipmentIds = new Set<string>(Object.values(event.assignedEquipment).flat());
  const wearAmount = getEquipmentWearForEvent(event);
  const equipmentWearResults: EventCompletionSummary['equipmentResults'] = [];

  const recoveryDays = getCrewRecoveryDays(event);
  const updatedCrewMap = new Map<string, CrewMember>();
  const crewResults: ExperienceGainResult[] = [];

  if (cost > 0) {
    transactions.push(
      createTransaction(state.currentDate, 'expense', cost, `Crew payroll for ${event.name}`, 'payroll', event.id),
    );
  }

  transactions.push(
    createTransaction(
      state.currentDate,
      'income',
      event.clientPay,
      `Client payment for ${event.name}`,
      'contracts',
      event.id,
    ),
  );

  if (additionalExpenses > 0) {
    transactions.push(
      createTransaction(
        state.currentDate,
        'expense',
        additionalExpenses,
        `Crisis fallout for ${event.name}`,
        'operations',
        event.id,
      ),
    );
  } else if (additionalExpenses < 0) {
    transactions.push(
      createTransaction(
        state.currentDate,
        'income',
        Math.abs(additionalExpenses),
        `Crisis contingency savings for ${event.name}`,
        'operations',
        event.id,
      ),
    );
  }

  const totalExpenses = cost + Math.max(additionalExpenses, 0);
  const totalIncome = event.clientPay + Math.max(-additionalExpenses, 0);
  const net = totalIncome - totalExpenses;
  const newBalance = state.company.balance + net;
  const { overdraftDays, isBankrupt } = evaluateFinancialState(state.finances, newBalance);

  const updatedCrewList = state.crew.map(c => {
    const wasAssigned = Object.values(event.assignedCrew).flat().some(ec => ec.id === c.id);
    if (wasAssigned) {
      const availability = new Date(event.date);
      availability.setDate(availability.getDate() + recoveryDays);
      availability.setHours(8, 0, 0, 0);

      const baseFatigue = 20 + Math.floor(event.travelHours / 2);
      const fatigueAdjustment =
        state.company.specialization === 'stage' && c.department === 'stage' ? -6 : 0;
      const appliedFatigue = Math.max(8, baseFatigue + fatigueAdjustment);

      const baseCrew: CrewMember = {
        ...c,
        assignedTo: undefined,
        fatigue: Math.min(100, c.fatigue + appliedFatigue),
        availableOn: availability,
      };

      const { updatedCrew, result } = applyExperienceGain(baseCrew, event, finalSatisfaction);

      updatedCrewMap.set(c.id, updatedCrew);
      crewResults.push(result);
      return updatedCrew;
    }
    return c;
  });

  const updatedEquipmentList = state.equipment.map(eq => {
    if (!assignedEquipmentIds.has(eq.id)) {
      return eq;
    }

    const conditionBefore = eq.condition;
    const wearReduction =
      state.company.specialization === 'lighting' && eq.department === 'lighting' ? 3 : 0;
    const appliedWear = Math.max(1, wearAmount - wearReduction);
    const conditionAfter = Math.max(0, conditionBefore - appliedWear);
    const maintenanceDue = new Date(eq.maintenanceDue);

    if (conditionAfter < 60) {
      const soonerDue = new Date(event.date);
      soonerDue.setDate(soonerDue.getDate() + 14);
      if (maintenanceDue.getTime() > soonerDue.getTime()) {
        maintenanceDue.setTime(soonerDue.getTime());
      }
    }

    equipmentWearResults.push({
      equipmentId: eq.id,
      name: eq.name,
      conditionBefore,
      conditionAfter,
    });

    return {
      ...eq,
      condition: conditionAfter,
      status: 'available' as const,
      assignedToEvent: undefined,
      maintenanceDue,
      maintenanceCompleteOn: undefined,
    } satisfies EquipmentItem;
  });

  const summary: EventCompletionSummary = {
    eventId,
    satisfaction: finalSatisfaction,
    crewResults,
    financial: {
      income: totalIncome,
      expense: totalExpenses,
      net,
      newBalance,
      isBankrupt,
    },
    equipmentResults: equipmentWearResults,
    crisisOutcomes: outcomes,
  };

  const nextState: GameState = {
    ...state,
    company: syncCompanyLevel({
      ...state.company,
      balance: newBalance,
      reputation: Math.min(100, state.company.reputation + reputationGain),
    }),
    events: state.events.map(e => {
      if (e.id === eventId) {
        const postEventReport: EventPostReport = {
          completedOn: new Date(state.currentDate),
          satisfaction: finalSatisfaction,
          financial: {
            income: totalIncome,
            expense: totalExpenses,
            net,
            balanceAfter: newBalance,
          },
          equipment: equipmentWearResults.map(result => ({
            equipmentId: result.equipmentId,
            name: result.name,
            conditionBefore: result.conditionBefore,
            conditionAfter: result.conditionAfter,
          })),
        };

        return {
          ...e,
          status: 'completed' as const,
          clientSatisfaction: finalSatisfaction,
          postEventReport,
          assignedCrew: {
            audio: e.assignedCrew.audio.map(crew => updatedCrewMap.get(crew.id) ?? crew),
            lighting: e.assignedCrew.lighting.map(crew => updatedCrewMap.get(crew.id) ?? crew),
            video: e.assignedCrew.video.map(crew => updatedCrewMap.get(crew.id) ?? crew),
            stage: e.assignedCrew.stage.map(crew => updatedCrewMap.get(crew.id) ?? crew),
          },
        };
      }
      return e;
    }),
    crew: updatedCrewList,
    equipment: updatedEquipmentList,
    finances: {
      ...state.finances,
      transactions,
      overdraftDays,
    },
    crises: state.crises.filter(crisis => crisis.eventId !== eventId),
    isBankrupt,
  };

  return { state: nextState, result: summary };
}
