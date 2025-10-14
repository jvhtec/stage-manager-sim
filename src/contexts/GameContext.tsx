import React, { createContext, useContext, useState } from 'react';
import {
  GameState,
  CrewMember,
  Event,
  FinancialTransaction,
  FinancialCategory,
} from '@/types/game';
import {
  generateInitialCrew,
  createInitialCompany,
  generateEvent,
  calculateEventCost,
} from '@/lib/gameData';

interface GameContextType {
  gameState: GameState;
  hireCrew: (crew: CrewMember) => void;
  assignCrewToEvent: (eventId: string, crewId: string, department: string) => void;
  unassignCrewFromEvent: (eventId: string, crewId: string) => void;
  acceptEvent: (eventId: string) => void;
  completeEvent: (eventId: string, satisfaction: number) => void;
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
    
    return {
      company: createInitialCompany(),
      crew: generateInitialCrew(),
      events,
      currentDate: now,
      finances: {
        transactions: [],
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

  const hireCrew = (crew: CrewMember) => {
    setGameState(prev => ({
      ...prev,
      crew: [...prev.crew, crew],
    }));
  };

  const assignCrewToEvent = (eventId: string, crewId: string, department: string) => {
    setGameState(prev => {
      const crew = prev.crew.find(c => c.id === crewId);
      if (!crew) return prev;

      return {
        ...prev,
        crew: prev.crew.map(c => 
          c.id === crewId ? { ...c, assignedTo: eventId } : c
        ),
        events: prev.events.map(e => {
          if (e.id === eventId) {
            return {
              ...e,
              assignedCrew: {
                ...e.assignedCrew,
                [department]: [...e.assignedCrew[department as keyof typeof e.assignedCrew], crew],
              },
            };
          }
          return e;
        }),
      };
    });
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
    setGameState(prev => ({
      ...prev,
      events: prev.events.map(e => 
        e.id === eventId ? { ...e, status: 'planned' as const } : e
      ),
    }));
  };

  const completeEvent = (eventId: string, satisfaction: number) => {
    setGameState(prev => {
      if (prev.isBankrupt) return prev;

      const event = prev.events.find(e => e.id === eventId);
      if (!event) return prev;

      const cost = calculateEventCost(event);
      const reputationGain = Math.floor((satisfaction / 100) * 5);

      const transactions: FinancialTransaction[] = [...prev.finances.transactions];

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
      const overdraftDays = newBalance < 0 ? prev.finances.overdraftDays + 1 : 0;
      const isBankrupt = newBalance < prev.finances.creditLimit;

      return {
        ...prev,
        company: {
          ...prev.company,
          balance: newBalance,
          reputation: Math.min(100, prev.company.reputation + reputationGain),
        },
        events: prev.events.map(e =>
          e.id === eventId ? { ...e, status: 'completed' as const, clientSatisfaction: satisfaction } : e
        ),
        crew: prev.crew.map(c => {
          const wasAssigned = Object.values(event.assignedCrew).flat().some(ec => ec.id === c.id);
          if (wasAssigned) {
            return {
              ...c,
              assignedTo: undefined,
              fatigue: Math.min(100, c.fatigue + 20),
              morale: Math.min(100, c.morale + 5),
            };
          }
          return c;
        }),
        finances: {
          ...prev.finances,
          transactions,
          overdraftDays,
        },
        isBankrupt,
      };
    });
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

      const overdraftDays = prev.company.balance < 0 ? prev.finances.overdraftDays + 1 : 0;
      const isBankrupt = prev.company.balance < prev.finances.creditLimit;

      return {
        ...prev,
        currentDate: newDate,
        events: newEvents,
        crew: prev.crew.map(c => ({
          ...c,
          fatigue: Math.max(0, c.fatigue - 5),
        })),
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

      const overdraftDays = newBalance < 0 ? prev.finances.overdraftDays + 1 : 0;
      const isBankrupt = newBalance < prev.finances.creditLimit;

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
