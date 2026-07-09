import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  GameState,
  CrewMember,
  Company,
  FinancialCategory,
  Department,
  EquipmentItem,
} from '@/types/game';
import {
  createNewGameState,
  loadSavedGameState,
  persistGameState,
  clearSavedGameState,
} from '@/engine/state';
import { hireCrew as hireCrewAction, assignCrewToEvent as assignCrewToEventAction, unassignCrewFromEvent as unassignCrewFromEventAction } from '@/engine/crewActions';
import {
  assignEquipmentToEvent as assignEquipmentToEventAction,
  unassignEquipmentFromEvent as unassignEquipmentFromEventAction,
  scheduleEquipmentMaintenance as scheduleEquipmentMaintenanceAction,
  rentEquipment as rentEquipmentAction,
} from '@/engine/equipmentActions';
import { acceptEvent as acceptEventAction, completeEvent as completeEventAction } from '@/engine/eventActions';
import { respondToCrisisPrompt as respondToCrisisPromptAction } from '@/engine/crisisActions';
import {
  completeCompanyOnboarding as completeCompanyOnboardingAction,
  updateCompanyIdentity as updateCompanyIdentityAction,
} from '@/engine/companyActions';
import { advanceDay as advanceDayAction } from '@/engine/dayActions';
import { updateBalance as updateBalanceAction } from '@/engine/financeActions';
import type { ActionResult, CompanyIdentityInput, EventCompletionSummary } from '@/engine/types';

interface GameContextType {
  gameState: GameState;
  hireCrew: (crew: CrewMember) => void;
  assignCrewToEvent: (
    eventId: string,
    crewId: string,
    department: Department
  ) => ActionResult;
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
  ) => ActionResult;
  unassignEquipmentFromEvent: (
    eventId: string,
    equipmentId: string,
    department: Department
  ) => void;
  scheduleEquipmentMaintenance: (
    equipmentId: string,
    options?: { days?: number; costOverride?: number }
  ) => ActionResult & { cost?: number };
  rentEquipment: (
    options: {
      type: EquipmentItem['type'];
      rentalDays: number;
      provider?: string;
      eventId?: string;
    }
  ) => ActionResult & { equipment?: EquipmentItem; cost?: number };
  respondToCrisisPrompt: (
    promptId: string,
    choiceId: string,
  ) => ActionResult;
  completeCompanyOnboarding: (identity: CompanyIdentityInput) => void;
  updateCompanyIdentity: (
    updates: Partial<Pick<Company, 'brandColor' | 'accentColor' | 'tagline'>>,
  ) => void;
  resetGame: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

/**
 * This provider is a thin shim: every state transition is a pure function
 * living in src/engine/** (no React, no Math.random() for gameplay rolls —
 * see src/lib/rng.ts) that takes the current GameState explicitly and
 * returns the next one. setGameState's updater always runs synchronously
 * when called, so capturing an action's result into an outer `let` here is
 * safe even though the resulting re-render is batched by React.
 */
export function GameProvider({ children }: { children: React.ReactNode }) {
  const [gameState, setGameState] = useState<GameState>(
    () => loadSavedGameState() ?? createNewGameState(),
  );

  useEffect(() => {
    persistGameState(gameState);
  }, [gameState]);

  const resetGame = () => {
    clearSavedGameState();
    setGameState(createNewGameState());
  };

  const hireCrew = (crew: CrewMember) => {
    setGameState(prev => hireCrewAction(prev, crew));
  };

  const assignCrewToEvent = (eventId: string, crewId: string, department: Department): ActionResult => {
    let result: ActionResult = { success: false, reason: 'Crew or event not found' };
    setGameState(prev => {
      const outcome = assignCrewToEventAction(prev, eventId, crewId, department);
      result = outcome.result;
      return outcome.state;
    });
    return result;
  };

  const unassignCrewFromEvent = (eventId: string, crewId: string) => {
    setGameState(prev => unassignCrewFromEventAction(prev, eventId, crewId));
  };

  const assignEquipmentToEvent = (
    eventId: string,
    equipmentId: string,
    department: Department,
  ): ActionResult => {
    let result: ActionResult = { success: false, reason: 'Event or equipment not found' };
    setGameState(prev => {
      const outcome = assignEquipmentToEventAction(prev, eventId, equipmentId, department);
      result = outcome.result;
      return outcome.state;
    });
    return result;
  };

  const unassignEquipmentFromEvent = (eventId: string, equipmentId: string, department: Department) => {
    setGameState(prev => unassignEquipmentFromEventAction(prev, eventId, equipmentId, department));
  };

  const scheduleEquipmentMaintenance = (
    equipmentId: string,
    options?: { days?: number; costOverride?: number },
  ) => {
    let result: ActionResult & { cost?: number } = { success: false, reason: 'Equipment not found' };
    setGameState(prev => {
      const outcome = scheduleEquipmentMaintenanceAction(prev, equipmentId, options);
      result = outcome.result;
      return outcome.state;
    });
    return result;
  };

  const rentEquipment = (options: {
    type: EquipmentItem['type'];
    rentalDays: number;
    provider?: string;
    eventId?: string;
  }) => {
    let result: ActionResult & { equipment?: EquipmentItem; cost?: number } = {
      success: false,
      reason: 'Unable to create rental equipment',
    };
    setGameState(prev => {
      const outcome = rentEquipmentAction(prev, options);
      result = outcome.result;
      return outcome.state;
    });
    return result;
  };

  const acceptEvent = (eventId: string) => {
    setGameState(prev => acceptEventAction(prev, eventId));
  };

  const completeEvent = (eventId: string, satisfaction: number) => {
    let summary: EventCompletionSummary | undefined;
    setGameState(prev => {
      const outcome = completeEventAction(prev, eventId, satisfaction);
      summary = outcome.result;
      return outcome.state;
    });
    return summary;
  };

  const respondToCrisisPrompt = (promptId: string, choiceId: string): ActionResult => {
    let response: ActionResult = { success: false, reason: 'Crisis prompt not found' };
    setGameState(prev => {
      const outcome = respondToCrisisPromptAction(prev, promptId, choiceId);
      response = outcome.result;
      return outcome.state;
    });
    return response;
  };

  const advanceDay = () => {
    setGameState(prev => advanceDayAction(prev));
  };

  const updateBalance = (
    amount: number,
    options?: { description?: string; category?: FinancialCategory; eventId?: string },
  ) => {
    setGameState(prev => updateBalanceAction(prev, amount, options));
  };

  const completeCompanyOnboarding = (identity: CompanyIdentityInput) => {
    setGameState(prev => completeCompanyOnboardingAction(prev, identity));
  };

  const updateCompanyIdentity = (
    updates: Partial<Pick<Company, 'brandColor' | 'accentColor' | 'tagline'>>,
  ) => {
    setGameState(prev => updateCompanyIdentityAction(prev, updates));
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
      respondToCrisisPrompt,
      completeCompanyOnboarding,
      updateCompanyIdentity,
      resetGame,
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
