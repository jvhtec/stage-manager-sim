import React, { createContext, useContext, useState } from 'react';
import {
  GameState,
  CrewMember,
  Event,
  FinancialTransaction,
  FinancialCategory,
  Department,
  EquipmentItem,
} from '@/types/game';
import {
  generateInitialCrew,
  createInitialCompany,
  generateEvent,
  calculateEventCost,
  getCrewRecoveryDays,
  getEventTimeWindow,
  generateInitialEquipmentInventory,
  isEventFullyStaffed,
  isEventEquipmentReady,
  getEquipmentWearForEvent,
} from '@/lib/gameData';
import { MAX_OVERDRAFT_DAYS } from '@/lib/finance';
import {
  applyDailyMoraleDrift,
  applyExperienceGain,
  ExperienceGainResult,
} from '@/lib/crewProgression';
import {
  calculateMaintenanceCost,
  createRentalEquipment,
  getEquipmentDefinition,
} from '@/lib/equipment';

interface EventCompletionSummary {
  eventId: string;
  satisfaction: number;
  crewResults: ExperienceGainResult[];
  financial: {
    income: number;
    expense: number;
    net: number;
    newBalance: number;
    isBankrupt: boolean;
  };
  equipmentResults: {
    equipmentId: string;
    name: string;
    conditionBefore: number;
    conditionAfter: number;
  }[];
}

interface GameContextType {
  gameState: GameState;
  hireCrew: (crew: CrewMember) => void;
  assignCrewToEvent: (
    eventId: string,
    crewId: string,
    department: Department
  ) => { success: boolean; reason?: string };
  unassignCrewFromEvent: (eventId: string, crewId: string) => void;
  acceptEvent: (eventId: string) => void;
  completeEvent: (
    eventId: string,
    satisfaction: number,
  ) => EventCompletionSummary | undefined;
  advanceDay: () => void;
  updateBalance: (
    amount: number,
    options?: { description?: string; category?: FinancialCategory; eventId?: string }
  ) => void;
  assignEquipmentToEvent: (
    eventId: string,
    equipmentId: string,
    department: Department
  ) => { success: boolean; reason?: string };
  unassignEquipmentFromEvent: (
    eventId: string,
    equipmentId: string,
    department: Department
  ) => void;
  scheduleEquipmentMaintenance: (
    equipmentId: string,
    options?: { days?: number; costOverride?: number }
  ) => { success: boolean; cost?: number; reason?: string };
  rentEquipment: (
    options: {
      type: EquipmentItem['type'];
      rentalDays: number;
      provider?: string;
      eventId?: string;
    }
  ) => { success: boolean; equipment?: EquipmentItem; cost?: number; reason?: string };
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [gameState, setGameState] = useState<GameState>(() => {
    const now = new Date();
    const events: Event[] = [];

    // Generate 5 available gigs over the next 2 weeks
    for (let i = 0; i < 5; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() + 3 + i * 2);
      events.push(generateEvent(date, 'gig'));
    }

    const company = createInitialCompany();
    const equipment = generateInitialEquipmentInventory(now);

    return {
      company,
      crew: generateInitialCrew(),
      equipment,
      events,
      currentDate: now,
      finances: {
        transactions: [
          {
            id: `txn-start-${now.getTime()}`,
            date: new Date(now),
            type: 'income',
            amount: company.balance,
            description: 'Initial capital injection',
            category: 'misc',
          },
        ],
        creditLimit: -5000,
        overdraftDays: 0,
      },
      isBankrupt: false,
    } as GameState;
  });

  const createTransaction = (
    type: FinancialTransaction['type'],
    amount: number,
    description: string,
    category: FinancialCategory,
    eventId?: string
  ): FinancialTransaction => ({
    id: `txn-${Date.now()}-${Math.random()}`,
    date: new Date(),
    type,
    amount,
    description,
    category,
    eventId,
  });

  const evaluateFinancialState = (prev: GameState, newBalance: number) => {
    const overdraftDays = newBalance < 0 ? prev.finances.overdraftDays + 1 : 0;
    const isBankrupt =
      newBalance < prev.finances.creditLimit || overdraftDays >= MAX_OVERDRAFT_DAYS;

    return { overdraftDays, isBankrupt };
  };

  const getRequiredEquipmentCount = (event: Event, department: Department) => {
    const requirements = event.equipmentRequirements[department];
    if (!requirements) return 0;
    return requirements.reduce((total, req) => total + req.quantity, 0);
  };

  const hireCrew = (crew: CrewMember) => {
    setGameState(prev => ({
      ...prev,
      crew: [...prev.crew, crew],
    }));
  };

  const assignCrewToEvent = (
    eventId: string,
    crewId: string,
    department: Department
  ) => {
    if (gameState.isBankrupt) {
      return {
        success: false,
        reason: 'Company is bankrupt. Resolve finances before assigning crew.',
      };
    }

    let result: { success: boolean; reason?: string } = {
      success: false,
      reason: 'Crew or event not found',
    };

    setGameState(prev => {
      const event = prev.events.find(e => e.id === eventId);
      const crew = prev.crew.find(c => c.id === crewId);
      if (!event || !crew) {
        return prev;
      }

      if (crew.assignedTo && crew.assignedTo !== eventId) {
        result = {
          success: false,
          reason: `${crew.name} is already assigned to another event.`,
        };
        return prev;
      }

      const departmentAssignments = event.assignedCrew[department];
      if (departmentAssignments.some(c => c.id === crewId)) {
        result = {
          success: false,
          reason: `${crew.name} is already on this team's roster.`,
        };
        return prev;
      }

      const { eventStart } = getEventTimeWindow(event);
      const crewAvailable = new Date(crew.availableOn);
      if (crewAvailable > eventStart) {
        result = {
          success: false,
          reason: `${crew.name} is traveling or resting until ${crewAvailable.toLocaleDateString()}.`,
        };
        return prev;
      }

      if (crew.fatigue >= 85) {
        result = {
          success: false,
          reason: `${crew.name} is too fatigued to take on another show.`,
        };
        return prev;
      }

      const updatedCrewMember: CrewMember = {
        ...crew,
        assignedTo: eventId,
      };

      result = { success: true };

      return {
        ...prev,
        crew: prev.crew.map(c => (c.id === crewId ? updatedCrewMember : c)),
        events: prev.events.map(e => {
          if (e.id === eventId) {
            return {
              ...e,
              assignedCrew: {
                ...e.assignedCrew,
                [department]: [
                  ...e.assignedCrew[department],
                  updatedCrewMember,
                ],
              },
            };
          }
          return e;
        }),
      };
    });

    return result;
  };

  const unassignCrewFromEvent = (eventId: string, crewId: string) => {
    setGameState(prev => ({
      ...prev,
      crew: prev.crew.map(c =>
        c.id === crewId ? { ...c, assignedTo: undefined } : c
      ),
      events: prev.events.map(e => {
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
      }),
    }));
  };

  const assignEquipmentToEvent = (
    eventId: string,
    equipmentId: string,
    department: Department
  ) => {
    let result: { success: boolean; reason?: string } = {
      success: false,
      reason: 'Event or equipment not found',
    };

    setGameState(prev => {
      if (prev.isBankrupt) {
        result = {
          success: false,
          reason: 'Company is bankrupt. Resolve finances before assigning equipment.',
        };
        return prev;
      }

      const event = prev.events.find(e => e.id === eventId);
      const equipment = prev.equipment.find(eq => eq.id === equipmentId);

      if (!event || !equipment) {
        return prev;
      }

      if (event.status === 'completed' || event.status === 'failed') {
        result = {
          success: false,
          reason: 'Cannot change equipment on completed or failed events.',
        };
        return prev;
      }

      if (equipment.department !== department) {
        result = {
          success: false,
          reason: `${equipment.name} is not part of the ${department} department.`,
        };
        return prev;
      }

      if (equipment.status !== 'available') {
        result = {
          success: false,
          reason: `${equipment.name} is currently unavailable.`,
        };
        return prev;
      }

      if (equipment.assignedToEvent && equipment.assignedToEvent !== eventId) {
        result = {
          success: false,
          reason: `${equipment.name} is booked for another event.`,
        };
        return prev;
      }

      const requiredCount = getRequiredEquipmentCount(event, department);
      if (requiredCount === 0) {
        result = {
          success: false,
          reason: `No equipment is required for ${department} on this event.`,
        };
        return prev;
      }

      if (event.assignedEquipment[department].includes(equipmentId)) {
        result = {
          success: false,
          reason: `${equipment.name} is already reserved for this event.`,
        };
        return prev;
      }

      if (event.assignedEquipment[department].length >= requiredCount) {
        result = {
          success: false,
          reason: `All required equipment slots for ${department} are filled.`,
        };
        return prev;
      }

      const { eventStart } = getEventTimeWindow(event);
      if (equipment.maintenanceDue < eventStart) {
        result = {
          success: false,
          reason: `${equipment.name} is due for maintenance before showtime.`,
        };
        return prev;
      }

      if (equipment.rentalInfo && equipment.rentalInfo.returnDate < eventStart) {
        result = {
          success: false,
          reason: `${equipment.name} must be returned before this event starts.`,
        };
        return prev;
      }

      result = { success: true };

      return {
        ...prev,
        equipment: prev.equipment.map(eq =>
          eq.id === equipmentId
            ? { ...eq, status: 'assigned', assignedToEvent: eventId }
            : eq
        ),
        events: prev.events.map(e =>
          e.id === eventId
            ? {
                ...e,
                assignedEquipment: {
                  ...e.assignedEquipment,
                  [department]: [...e.assignedEquipment[department], equipmentId],
                },
              }
            : e
        ),
      };
    });

    return result;
  };

  const unassignEquipmentFromEvent = (
    eventId: string,
    equipmentId: string,
    department: Department
  ) => {
    setGameState(prev => ({
      ...prev,
      equipment: prev.equipment.map(eq =>
        eq.id === equipmentId
          ? { ...eq, status: 'available', assignedToEvent: undefined }
          : eq
      ),
      events: prev.events.map(e =>
        e.id === eventId
          ? {
              ...e,
              assignedEquipment: {
                ...e.assignedEquipment,
                [department]: e.assignedEquipment[department].filter(id => id !== equipmentId),
              },
            }
          : e
      ),
    }));
  };

  const scheduleEquipmentMaintenance = (
    equipmentId: string,
    options?: { days?: number; costOverride?: number }
  ) => {
    let result: { success: boolean; cost?: number; reason?: string } = {
      success: false,
      reason: 'Equipment not found',
    };

    setGameState(prev => {
      const equipment = prev.equipment.find(eq => eq.id === equipmentId);
      if (!equipment) {
        return prev;
      }

      if (equipment.status === 'assigned') {
        result = {
          success: false,
          reason: `${equipment.name} is currently booked for an event.`,
        };
        return prev;
      }

      if (equipment.status === 'maintenance') {
        result = {
          success: false,
          reason: `${equipment.name} is already in maintenance.`,
        };
        return prev;
      }

      const days = options?.days ?? 2;
      const maintenanceCost = options?.costOverride ?? calculateMaintenanceCost(equipment);
      const completionDate = new Date(prev.currentDate);
      completionDate.setDate(completionDate.getDate() + days);

      const newBalance = prev.company.balance - maintenanceCost;
      const transactions = maintenanceCost
        ? [
            ...prev.finances.transactions,
            createTransaction(
              'expense',
              maintenanceCost,
              `Maintenance for ${equipment.name}`,
              'maintenance'
            ),
          ]
        : prev.finances.transactions;

      const { overdraftDays, isBankrupt } = evaluateFinancialState(prev, newBalance);

      result = { success: true, cost: maintenanceCost };

      return {
        ...prev,
        company: {
          ...prev.company,
          balance: newBalance,
        },
        finances: {
          ...prev.finances,
          transactions,
          overdraftDays,
        },
        equipment: prev.equipment.map(eq =>
          eq.id === equipmentId
            ? {
                ...eq,
                status: 'maintenance',
                maintenanceCompleteOn: completionDate,
              }
            : eq
        ),
        isBankrupt,
      };
    });

    return result;
  };

  const rentEquipment = ({
    type,
    rentalDays,
    provider,
    eventId,
  }: {
    type: EquipmentItem['type'];
    rentalDays: number;
    provider?: string;
    eventId?: string;
  }) => {
    let result: { success: boolean; equipment?: EquipmentItem; cost?: number; reason?: string } = {
      success: false,
      reason: 'Unable to create rental equipment',
    };

    setGameState(prev => {
      if (prev.isBankrupt) {
        result = {
          success: false,
          reason: 'Company is bankrupt. Rentals are on hold until finances recover.',
        };
        return prev;
      }

      const rentalItem = createRentalEquipment(type, prev.currentDate, rentalDays, provider);
      const dailyCost = rentalItem.rentalInfo?.dailyCost ?? 0;
      const totalCost = dailyCost * rentalDays;

      const newBalance = prev.company.balance - totalCost;
      const transactions = totalCost
        ? [
            ...prev.finances.transactions,
            createTransaction(
              'expense',
              totalCost,
              `Rental: ${rentalItem.name}`,
              'operations',
              eventId
            ),
          ]
        : prev.finances.transactions;

      const { overdraftDays, isBankrupt } = evaluateFinancialState(prev, newBalance);

      result = {
        success: true,
        equipment: rentalItem,
        cost: totalCost,
      };

      return {
        ...prev,
        company: {
          ...prev.company,
          balance: newBalance,
        },
        finances: {
          ...prev.finances,
          transactions,
          overdraftDays,
        },
        equipment: [...prev.equipment, rentalItem],
        isBankrupt,
      };
    });

    return result;
  };

  const acceptEvent = (eventId: string) => {
    setGameState(prev => {
      if (prev.isBankrupt) {
        return prev;
      }

      const event = prev.events.find(e => e.id === eventId);
      if (!event) {
        return prev;
      }

      if (!isEventFullyStaffed(event) || !isEventEquipmentReady(event)) {
        return prev;
      }

      return {
        ...prev,
        events: prev.events.map(e =>
          e.id === eventId ? { ...e, status: 'planned' as const } : e
        ),
      };
    });
  };

  const completeEvent = (eventId: string, satisfaction: number) => {
    let summary: EventCompletionSummary | undefined;

    setGameState(prev => {
      if (prev.isBankrupt) return prev;

      const event = prev.events.find(e => e.id === eventId);
      if (!event) return prev;

      const cost = calculateEventCost(event);
      const reputationGain = Math.floor((satisfaction / 100) * 5);

      const transactions: FinancialTransaction[] = [...prev.finances.transactions];

      const assignedEquipmentIds = new Set<string>(
        Object.values(event.assignedEquipment).flat()
      );
      const wearAmount = getEquipmentWearForEvent(event);
      const equipmentWearResults: EventCompletionSummary['equipmentResults'] = [];

      const recoveryDays = getCrewRecoveryDays(event);
      const updatedCrewMap = new Map<string, CrewMember>();
      const crewResults: ExperienceGainResult[] = [];

      if (cost > 0) {
        transactions.push(
          createTransaction(
            'expense',
            cost,
            `Crew payroll for ${event.name}`,
            'payroll',
            event.id
          )
        );
      }

      transactions.push(
        createTransaction(
          'income',
          event.clientPay,
          `Client payment for ${event.name}`,
          'contracts',
          event.id
        )
      );

      const newBalance = prev.company.balance + event.clientPay - cost;
      const { overdraftDays, isBankrupt } = evaluateFinancialState(prev, newBalance);

      const updatedCrewList = prev.crew.map(c => {
        const wasAssigned = Object.values(event.assignedCrew)
          .flat()
          .some(ec => ec.id === c.id);
        if (wasAssigned) {
          const availability = new Date(event.date);
          availability.setDate(availability.getDate() + recoveryDays);
          availability.setHours(8, 0, 0, 0);

          const baseCrew: CrewMember = {
            ...c,
            assignedTo: undefined,
            fatigue: Math.min(100, c.fatigue + 20 + Math.floor(event.travelHours / 2)),
            availableOn: availability,
          };

          const { updatedCrew, result } = applyExperienceGain(baseCrew, event, satisfaction);

          updatedCrewMap.set(c.id, updatedCrew);
          crewResults.push(result);
          return updatedCrew;
        }
        return c;
      });

      const updatedEquipmentList = prev.equipment.map(eq => {
        if (!assignedEquipmentIds.has(eq.id)) {
          return eq;
        }

        const conditionBefore = eq.condition;
        const conditionAfter = Math.max(0, conditionBefore - wearAmount);
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

      summary = {
        eventId,
        satisfaction,
        crewResults,
        financial: {
          income: event.clientPay,
          expense: cost,
          net: event.clientPay - cost,
          newBalance,
          isBankrupt,
        },
        equipmentResults: equipmentWearResults,
      };

      return {
        ...prev,
        company: {
          ...prev.company,
          balance: newBalance,
          reputation: Math.min(100, prev.company.reputation + reputationGain),
        },
        events: prev.events.map(e => {
          if (e.id === eventId) {
            return {
              ...e,
              status: 'completed' as const,
              clientSatisfaction: satisfaction,
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
          ...prev.finances,
          transactions,
          overdraftDays,
        },
        isBankrupt,
      };
    });

    return summary;
  };

  const advanceDay = () => {
    setGameState(prev => {
      if (prev.isBankrupt) return prev;

      const newDate = new Date(prev.currentDate);
      newDate.setDate(newDate.getDate() + 1);

      // Generate new events occasionally
      const eventsWithNewContracts = [...prev.events];
      if (Math.random() > 0.7) {
        const futureDate = new Date(newDate);
        futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 14) + 7);
        eventsWithNewContracts.push(generateEvent(futureDate, 'gig'));
      }

      const expiredRentalIds: string[] = [];
      const updatedEquipment: EquipmentItem[] = [];

      prev.equipment.forEach(item => {
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

      const { overdraftDays, isBankrupt } = evaluateFinancialState(
        prev,
        prev.company.balance,
      );

      return {
        ...prev,
        currentDate: newDate,
        events: cleanedEvents,
        crew: prev.crew.map(c => {
          const recovered = {
            ...c,
            fatigue: Math.max(0, c.fatigue - 5),
          };
          return applyDailyMoraleDrift(recovered, newDate);
        }),
        equipment: updatedEquipment,
        finances: {
          ...prev.finances,
          overdraftDays,
        },
        isBankrupt,
      };
    });
  };

  const updateBalance = (
    amount: number,
    options?: { description?: string; category?: FinancialCategory; eventId?: string }
  ) => {
    setGameState(prev => {
      if (amount === 0) return prev;
      if (prev.isBankrupt && amount < 0) return prev;

      const newBalance = prev.company.balance + amount;
      const transaction = createTransaction(
        amount >= 0 ? 'income' : 'expense',
        Math.abs(amount),
        options?.description || 'Balance adjustment',
        options?.category || 'misc',
        options?.eventId
      );

      const { overdraftDays, isBankrupt } = evaluateFinancialState(prev, newBalance);

      return {
        ...prev,
        company: {
          ...prev.company,
          balance: newBalance,
        },
        finances: {
          ...prev.finances,
          transactions: [...prev.finances.transactions, transaction],
          overdraftDays,
        },
        isBankrupt,
      };
    });
  };

  return (
    <GameContext.Provider value={{
      gameState,
      hireCrew,
      assignCrewToEvent,
      unassignCrewFromEvent,
      acceptEvent,
      completeEvent,
      advanceDay,
      updateBalance,
      assignEquipmentToEvent,
      unassignEquipmentFromEvent,
      scheduleEquipmentMaintenance,
      rentEquipment,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGame must be used within GameProvider');
  }
  return context;
}
