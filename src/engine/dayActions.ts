import { EquipmentItem, GameState } from '@/types/game';
import { applyEventLifecycle, generateEvent } from '@/lib/gameData';
import { applyDailyMoraleDrift } from '@/lib/crewProgression';
import { getEquipmentDefinition } from '@/lib/equipment';
import { rebuildAllPlannedCrises } from '@/lib/crisis';
import { evaluateFinancialState } from '@/lib/finance';
import {
  progressCompetitorSchedules,
  simulateCompetitorBidding,
} from '@/lib/competitors';
import { createRng } from '@/lib/rng';
import { buildReputationSnapshot } from './state';

export function advanceDay(state: GameState): GameState {
  if (state.isBankrupt) return state;

  const newDate = new Date(state.currentDate);
  newDate.setDate(newDate.getDate() + 1);

  const rng = createRng(state.rngState);

  // Generate new events occasionally
  const eventsWithNewContracts = [...state.events];
  if (rng.chance(0.3)) {
    const futureDate = new Date(newDate);
    futureDate.setDate(futureDate.getDate() + rng.nextInt(14) + 7);
    eventsWithNewContracts.push(generateEvent(futureDate, 'gig', rng));
  }

  const expiredRentalIds: string[] = [];
  const updatedEquipment: EquipmentItem[] = [];

  state.equipment.forEach(item => {
    let updatedItem: EquipmentItem = item;

    if (item.status === 'maintenance' && item.maintenanceCompleteOn) {
      if (item.maintenanceCompleteOn <= newDate) {
        const definition = getEquipmentDefinition(item.type);
        const refreshedCondition = Math.min(100, item.condition + 15);
        const nextDue = new Date(newDate);
        nextDue.setDate(nextDue.getDate() + definition.maintenanceIntervalDays);

        updatedItem = {
          ...item,
          status: 'available',
          condition: refreshedCondition,
          maintenanceCompleteOn: undefined,
          maintenanceDue: nextDue,
          lastServicedOn: new Date(newDate),
        };
      }
    } else if (item.maintenanceDue < newDate) {
      updatedItem = {
        ...item,
        condition: Math.max(0, item.condition - 1),
      };
    }

    if (
      updatedItem.rentalInfo &&
      updatedItem.rentalInfo.returnDate < newDate &&
      !updatedItem.assignedToEvent
    ) {
      expiredRentalIds.push(updatedItem.id);
      return;
    }

    updatedEquipment.push(updatedItem);
  });

  const expiredSet = new Set(expiredRentalIds);
  const cleanedEvents = expiredSet.size
    ? eventsWithNewContracts.map(event => {
        const updatedAssignments = {
          audio: event.assignedEquipment.audio.filter(id => !expiredSet.has(id)),
          lighting: event.assignedEquipment.lighting.filter(id => !expiredSet.has(id)),
          video: event.assignedEquipment.video.filter(id => !expiredSet.has(id)),
          stage: event.assignedEquipment.stage.filter(id => !expiredSet.has(id)),
        };

        const changed =
          updatedAssignments.audio.length !== event.assignedEquipment.audio.length ||
          updatedAssignments.lighting.length !== event.assignedEquipment.lighting.length ||
          updatedAssignments.video.length !== event.assignedEquipment.video.length ||
          updatedAssignments.stage.length !== event.assignedEquipment.stage.length;

        if (!changed) {
          return event;
        }

        return {
          ...event,
          assignedEquipment: updatedAssignments,
        };
      })
    : eventsWithNewContracts;

  const refreshedCrew = state.crew.map(c => {
    const recovered = {
      ...c,
      fatigue: Math.max(0, c.fatigue - 5),
    };
    return applyDailyMoraleDrift(recovered, newDate, rng);
  });

  const scheduleProgress = progressCompetitorSchedules(state.competitors, newDate, rng);
  const biddingWithSchedule = simulateCompetitorBidding({
    events: cleanedEvents,
    competitors: scheduleProgress.competitors,
    currentDate: newDate,
    playerCompany: state.company,
    rng,
  });

  // Runs after competitor bidding so contracts get one last day of
  // interest before an unclaimed offer expires; also flips planned
  // shows into in-progress on their date and auto-fails no-shows.
  const lifecycle = applyEventLifecycle(
    biddingWithSchedule.events,
    refreshedCrew,
    updatedEquipment,
    newDate,
    state.company.name,
  );

  const newBalance =
    state.company.balance -
    lifecycle.transactions.reduce(
      (sum, txn) => sum + (txn.type === 'expense' ? txn.amount : -txn.amount),
      0,
    );
  const { overdraftDays, isBankrupt } = evaluateFinancialState(state.finances, newBalance);
  const newReputation = Math.max(0, Math.min(100, state.company.reputation + lifecycle.reputationDelta));

  const recalculatedCrises = rebuildAllPlannedCrises(
    state.crises,
    lifecycle.events,
    lifecycle.crew,
    lifecycle.equipment,
    state.company.reputation,
    state.company.specialization,
  );

  const combinedNews = [...scheduleProgress.news, ...biddingWithSchedule.news, ...lifecycle.news];
  const nextNews = combinedNews.length
    ? [...combinedNews, ...state.marketNews].slice(0, 10)
    : state.marketNews;

  const snapshot = buildReputationSnapshot(
    { ...state.company, reputation: newReputation },
    biddingWithSchedule.competitors,
    newDate,
  );
  const reputationHistory = [...state.reputationHistory, snapshot].slice(-45);

  return {
    ...state,
    currentDate: newDate,
    events: lifecycle.events,
    crew: lifecycle.crew,
    equipment: lifecycle.equipment,
    company: {
      ...state.company,
      balance: newBalance,
      reputation: newReputation,
    },
    finances: {
      ...state.finances,
      transactions: lifecycle.transactions.length
        ? [...state.finances.transactions, ...lifecycle.transactions]
        : state.finances.transactions,
      overdraftDays,
    },
    crises: recalculatedCrises,
    isBankrupt,
    competitors: biddingWithSchedule.competitors,
    marketNews: nextNews,
    reputationHistory,
    rngState: rng.getState(),
  };
}
