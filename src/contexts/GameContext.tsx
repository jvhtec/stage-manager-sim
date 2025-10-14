import React, { createContext, useContext, useState } from 'react';
import {
  GameState,
  CrewMember,
  Event,
  FinancialTransaction,
  FinancialCategory,
  Department,
} from '@/types/game';
import {
  generateInitialCrew,
  createInitialCompany,
  generateEvent,
  calculateEventCost,
  getCrewRecoveryDays,
  getEventTimeWindow,
} from '@/lib/gameData';
import { MAX_OVERDRAFT_DAYS } from '@/lib/finance';
import {
  applyDailyMoraleDrift,
  applyExperienceGain,
  ExperienceGainResult,
} from '@/lib/crewProgression';

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

    return {
      company,
      crew: generateInitialCrew(),
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

  const acceptEvent = (eventId: string) => {
    setGameState(prev => {
      if (prev.isBankrupt) {
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
      const newEvents = [...prev.events];
      if (Math.random() > 0.7) {
        const futureDate = new Date(newDate);
        futureDate.setDate(futureDate.getDate() + Math.floor(Math.random() * 14) + 7);
        newEvents.push(generateEvent(futureDate, 'gig'));
      }

      const { overdraftDays, isBankrupt } = evaluateFinancialState(
        prev,
        prev.company.balance,
      );

      return {
        ...prev,
        currentDate: newDate,
        events: newEvents,
        crew: prev.crew.map(c => {
          const recovered = {
            ...c,
            fatigue: Math.max(0, c.fatigue - 5),
          };
          return applyDailyMoraleDrift(recovered, newDate);
        }),
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
