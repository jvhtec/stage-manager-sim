import { Department, Event, EquipmentItem, GameState } from '@/types/game';
import { getEventTimeWindow } from '@/lib/gameData';
import { rebuildEventCrises } from '@/lib/crisis';
import { createTransaction, evaluateFinancialState } from '@/lib/finance';
import { calculateMaintenanceCost, createRentalEquipment, getEquipmentDefinition } from '@/lib/equipment';
import type { ActionResult } from './types';

function getRequiredEquipmentCount(event: Event, department: Department): number {
  const requirements = event.equipmentRequirements[department];
  if (!requirements) return 0;
  return requirements.reduce((total, req) => total + req.quantity, 0);
}

export function assignEquipmentToEvent(
  state: GameState,
  eventId: string,
  equipmentId: string,
  department: Department,
): { state: GameState; result: ActionResult } {
  if (state.isBankrupt) {
    return {
      state,
      result: { success: false, reason: 'Company is bankrupt. Resolve finances before assigning equipment.' },
    };
  }

  const event = state.events.find(e => e.id === eventId);
  const equipment = state.equipment.find(eq => eq.id === equipmentId);

  if (!event || !equipment) {
    return { state, result: { success: false, reason: 'Event or equipment not found' } };
  }

  if (event.status === 'completed' || event.status === 'failed') {
    return {
      state,
      result: { success: false, reason: 'Cannot change equipment on completed or failed events.' },
    };
  }

  if (equipment.department !== department) {
    return {
      state,
      result: { success: false, reason: `${equipment.name} is not part of the ${department} department.` },
    };
  }

  if (equipment.status !== 'available') {
    return { state, result: { success: false, reason: `${equipment.name} is currently unavailable.` } };
  }

  if (equipment.assignedToEvent && equipment.assignedToEvent !== eventId) {
    return { state, result: { success: false, reason: `${equipment.name} is booked for another event.` } };
  }

  const requiredCount = getRequiredEquipmentCount(event, department);
  if (requiredCount === 0) {
    return {
      state,
      result: { success: false, reason: `No equipment is required for ${department} on this event.` },
    };
  }

  if (event.assignedEquipment[department].includes(equipmentId)) {
    return {
      state,
      result: { success: false, reason: `${equipment.name} is already reserved for this event.` },
    };
  }

  if (event.assignedEquipment[department].length >= requiredCount) {
    return {
      state,
      result: { success: false, reason: `All required equipment slots for ${department} are filled.` },
    };
  }

  const { eventStart } = getEventTimeWindow(event);
  if (equipment.maintenanceDue < eventStart) {
    return {
      state,
      result: { success: false, reason: `${equipment.name} is due for maintenance before showtime.` },
    };
  }

  if (equipment.rentalInfo && equipment.rentalInfo.returnDate < eventStart) {
    return {
      state,
      result: { success: false, reason: `${equipment.name} must be returned before this event starts.` },
    };
  }

  const updatedEquipment = state.equipment.map(eq =>
    eq.id === equipmentId ? { ...eq, status: 'assigned' as const, assignedToEvent: eventId } : eq,
  );
  const updatedEvents = state.events.map(e =>
    e.id === eventId
      ? {
          ...e,
          assignedEquipment: {
            ...e.assignedEquipment,
            [department]: [...e.assignedEquipment[department], equipmentId],
          },
        }
      : e,
  );
  const updatedEvent = updatedEvents.find(e => e.id === eventId) ?? event;
  const updatedCrises = rebuildEventCrises(
    state.crises,
    updatedEvent,
    state.crew,
    updatedEquipment,
    state.company.reputation,
    state.company.specialization,
  );

  return {
    state: {
      ...state,
      equipment: updatedEquipment,
      events: updatedEvents,
      crises: updatedCrises,
    },
    result: { success: true },
  };
}

export function unassignEquipmentFromEvent(
  state: GameState,
  eventId: string,
  equipmentId: string,
  department: Department,
): GameState {
  const updatedEquipment = state.equipment.map(eq =>
    eq.id === equipmentId ? { ...eq, status: 'available' as const, assignedToEvent: undefined } : eq,
  );
  const updatedEvents = state.events.map(e =>
    e.id === eventId
      ? {
          ...e,
          assignedEquipment: {
            ...e.assignedEquipment,
            [department]: e.assignedEquipment[department].filter(id => id !== equipmentId),
          },
        }
      : e,
  );
  const updatedEvent = updatedEvents.find(e => e.id === eventId);
  const updatedCrises = updatedEvent
    ? rebuildEventCrises(
        state.crises,
        updatedEvent,
        state.crew,
        updatedEquipment,
        state.company.reputation,
        state.company.specialization,
      )
    : state.crises;

  return {
    ...state,
    equipment: updatedEquipment,
    events: updatedEvents,
    crises: updatedCrises,
  };
}

export function scheduleEquipmentMaintenance(
  state: GameState,
  equipmentId: string,
  options?: { days?: number; costOverride?: number },
): { state: GameState; result: ActionResult & { cost?: number } } {
  const equipment = state.equipment.find(eq => eq.id === equipmentId);
  if (!equipment) {
    return { state, result: { success: false, reason: 'Equipment not found' } };
  }

  if (equipment.status === 'assigned') {
    return { state, result: { success: false, reason: `${equipment.name} is currently booked for an event.` } };
  }

  if (equipment.status === 'maintenance') {
    return { state, result: { success: false, reason: `${equipment.name} is already in maintenance.` } };
  }

  const days = options?.days ?? 2;
  const maintenanceCost = options?.costOverride ?? calculateMaintenanceCost(equipment);
  const completionDate = new Date(state.currentDate);
  completionDate.setDate(completionDate.getDate() + days);

  const newBalance = state.company.balance - maintenanceCost;
  const transactions = maintenanceCost
    ? [
        ...state.finances.transactions,
        createTransaction(
          state.currentDate,
          'expense',
          maintenanceCost,
          `Maintenance for ${equipment.name}`,
          'maintenance',
        ),
      ]
    : state.finances.transactions;

  const { overdraftDays, isBankrupt } = evaluateFinancialState(state.finances, newBalance);

  return {
    state: {
      ...state,
      company: { ...state.company, balance: newBalance },
      finances: { ...state.finances, transactions, overdraftDays },
      equipment: state.equipment.map(eq =>
        eq.id === equipmentId
          ? { ...eq, status: 'maintenance', maintenanceCompleteOn: completionDate }
          : eq,
      ),
      isBankrupt,
    },
    result: { success: true, cost: maintenanceCost },
  };
}

export function rentEquipment(
  state: GameState,
  options: {
    type: EquipmentItem['type'];
    rentalDays: number;
    provider?: string;
    eventId?: string;
  },
): { state: GameState; result: ActionResult & { equipment?: EquipmentItem; cost?: number } } {
  const { type, rentalDays, provider, eventId } = options;

  if (state.isBankrupt) {
    return {
      state,
      result: { success: false, reason: 'Company is bankrupt. Rentals are on hold until finances recover.' },
    };
  }

  const definition = getEquipmentDefinition(type);
  const rentalItem = createRentalEquipment(type, state.currentDate, rentalDays, provider);
  let adjustedDailyCost = rentalItem.rentalInfo?.dailyCost ?? definition.rentalDailyCost;

  if (state.company.specialization === 'audio' && definition.department === 'audio') {
    adjustedDailyCost = Math.round(adjustedDailyCost * 0.85);
  }

  if (rentalItem.rentalInfo) {
    rentalItem.rentalInfo.dailyCost = adjustedDailyCost;
  }

  const totalCost = adjustedDailyCost * rentalDays;

  const newBalance = state.company.balance - totalCost;
  const transactions = totalCost
    ? [
        ...state.finances.transactions,
        createTransaction(
          state.currentDate,
          'expense',
          totalCost,
          `Rental: ${rentalItem.name}`,
          'operations',
          eventId,
        ),
      ]
    : state.finances.transactions;

  const { overdraftDays, isBankrupt } = evaluateFinancialState(state.finances, newBalance);

  return {
    state: {
      ...state,
      company: { ...state.company, balance: newBalance },
      finances: { ...state.finances, transactions, overdraftDays },
      equipment: [...state.equipment, rentalItem],
      isBankrupt,
    },
    result: { success: true, equipment: rentalItem, cost: totalCost },
  };
}
