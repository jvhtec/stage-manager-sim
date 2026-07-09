import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  GameState,
  CrewMember,
  Event,
  EventPostReport,
  FinancialTransaction,
  FinancialCategory,
  Department,
  EquipmentItem,
  CrisisPrompt,
  Company,
  MarketNewsItem,
  CompetitorCompany,
  ReputationSnapshot,
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
  applyEventLifecycle,
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
import {
  generateCrisisPrompts,
  mergeExistingCrisisState,
  evaluateCrisisOutcomes,
  CrisisOutcome,
} from '@/lib/crisis';
import {
  createInitialMarketNews,
  generateInitialCompetitors,
  simulateCompetitorBidding,
  progressCompetitorSchedules,
} from '@/lib/competitors';

type CompanyIdentityInput = Pick<
  Company,
  'name' | 'brandColor' | 'accentColor' | 'specialization'
> & {
  tagline?: string;
};

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
  crisisOutcomes: CrisisOutcome[];
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
  respondToCrisisPrompt: (
    promptId: string,
    choiceId: string,
  ) => { success: boolean; reason?: string };
  completeCompanyOnboarding: (identity: CompanyIdentityInput) => void;
  updateCompanyIdentity: (
    updates: Partial<Pick<Company, 'brandColor' | 'accentColor' | 'tagline'>>,
  ) => void;
  resetGame: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const SAVE_STORAGE_KEY = 'stage-manager-sim:save';
// Bump whenever the GameState shape changes in a way old saves can't satisfy.
const SAVE_SCHEMA_VERSION = 1;

interface SaveFile {
  version: number;
  savedAt: string;
  state: GameState;
}

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function reviveDates(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && ISO_DATE_PATTERN.test(value)) {
    return new Date(value);
  }
  return value;
}

function loadSavedGameState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!raw) return null;

    const save = JSON.parse(raw, reviveDates) as SaveFile;
    if (save?.version !== SAVE_SCHEMA_VERSION || !save.state?.company) {
      // Incompatible or corrupt save — discard rather than half-load it.
      localStorage.removeItem(SAVE_STORAGE_KEY);
      return null;
    }
    return save.state;
  } catch {
    return null;
  }
}

function persistGameState(state: GameState) {
  try {
    const save: SaveFile = {
      version: SAVE_SCHEMA_VERSION,
      savedAt: new Date().toISOString(),
      state,
    };
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(save));
  } catch {
    // Storage full or unavailable (private mode) — the game stays playable in-memory.
  }
}

function createNewGameState(): GameState {
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
  const competitors = generateInitialCompetitors(company);
  const marketNews = createInitialMarketNews(competitors, company, now);
  const reputationHistory = [buildReputationSnapshot(company, competitors, now)];

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
    crises: [],
    competitors,
    marketNews,
    reputationHistory,
    hasCompletedOnboarding: false,
  } as GameState;
}

function buildReputationSnapshot(
  company: Company,
  competitors: CompetitorCompany[],
  date: Date,
): ReputationSnapshot {
  const sortedCompetitors = [...competitors].sort((a, b) => b.reputation - a.reputation);
  const averageReputation = sortedCompetitors.length
    ? sortedCompetitors.reduce((sum, competitor) => sum + competitor.reputation, 0) /
      sortedCompetitors.length
    : company.reputation;
  const leader = sortedCompetitors[0];

  return {
    date: new Date(date),
    playerReputation: company.reputation,
    competitorAverage: Math.round(averageReputation * 10) / 10,
    leaderId: leader?.id,
    leaderName: leader?.name,
    leaderReputation: leader?.reputation,
  };
}

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [gameState, setGameState] = useState<GameState>(
    () => loadSavedGameState() ?? createNewGameState(),
  );

  useEffect(() => {
    persistGameState(gameState);
  }, [gameState]);

  const resetGame = () => {
    try {
      localStorage.removeItem(SAVE_STORAGE_KEY);
    } catch {
      // Ignore storage errors; the in-memory reset below still applies.
    }
    setGameState(createNewGameState());
  };

  const createTransaction = (
    gameDate: Date,
    type: FinancialTransaction['type'],
    amount: number,
    description: string,
    category: FinancialCategory,
    eventId?: string
  ): FinancialTransaction => ({
    id: `txn-${Date.now()}-${Math.random()}`,
    date: new Date(gameDate),
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

  const rebuildEventCrises = (
    prev: GameState,
    updatedEvent: Event,
    updatedCrew: CrewMember[],
    updatedEquipment: EquipmentItem[],
  ): CrisisPrompt[] => {
    const shouldTrack =
      updatedEvent.status === 'planned' || updatedEvent.status === 'in-progress';

    const remaining = prev.crises.filter(crisis => crisis.eventId !== updatedEvent.id);
    if (!shouldTrack) {
      return remaining;
    }

    const generated = generateCrisisPrompts(updatedEvent, {
      crew: updatedCrew,
      equipment: updatedEquipment,
      companyReputation: prev.company.reputation,
      companySpecialization: prev.company.specialization,
    });

    const merged = mergeExistingCrisisState(
      generated,
      prev.crises.filter(crisis => crisis.eventId === updatedEvent.id),
    );

    return [...remaining, ...merged];
  };

  const rebuildAllPlannedCrises = (
    prev: GameState,
    events: Event[],
    crew: CrewMember[],
    equipment: EquipmentItem[],
  ): CrisisPrompt[] => {
    const prompts: CrisisPrompt[] = [];

    events.forEach(event => {
      if (event.status === 'planned' || event.status === 'in-progress') {
        const generated = generateCrisisPrompts(event, {
          crew,
          equipment,
          companyReputation: prev.company.reputation,
          companySpecialization: prev.company.specialization,
        });
        const merged = mergeExistingCrisisState(
          generated,
          prev.crises.filter(crisis => crisis.eventId === event.id),
        );
        prompts.push(...merged);
      }
    });

    return prompts;
  };

  const specializationLabels: Record<Company['specialization'], string> = {
    audio: 'audio specialists',
    lighting: 'lighting design experts',
    video: 'video innovators',
    stage: 'stagecraft veterans',
    balanced: 'full-service crews',
  };

  const updateCompanyIdentity = (
    updates: Partial<Pick<Company, 'brandColor' | 'accentColor' | 'tagline'>>,
  ) => {
    setGameState(prev => ({
      ...prev,
      company: {
        ...prev.company,
        ...updates,
      },
    }));
  };

  const completeCompanyOnboarding = (identity: CompanyIdentityInput) => {
    setGameState(prev => {
      if (prev.hasCompletedOnboarding) {
        return prev;
      }

      const baseCompany: Company = {
        ...prev.company,
        ...identity,
      };

      let adjustedCrew = prev.crew.map(crew => ({ ...crew }));
      let adjustedEquipment = prev.equipment.map(item => ({ ...item }));
      let adjustedTransactions = [...prev.finances.transactions];
      let adjustedBalance = prev.company.balance;
      let adjustedReputation = prev.company.reputation;

      switch (identity.specialization) {
        case 'audio':
          adjustedCrew = prev.crew.map(crew => {
            if (crew.department !== 'audio') return crew;
            const nextSkill = Math.min(10, crew.skillLevel + 1);
            return {
              ...crew,
              skillLevel: nextSkill,
              hourlyRate: crew.hourlyRate + 5,
            } satisfies CrewMember;
          });
          break;
        case 'lighting':
          adjustedEquipment = prev.equipment.map(item => {
            if (item.department !== 'lighting') return item;
            const boostedCondition = Math.min(100, item.condition + 10);
            const maintenanceDue = new Date(item.maintenanceDue);
            maintenanceDue.setDate(maintenanceDue.getDate() + 7);
            return {
              ...item,
              condition: boostedCondition,
              maintenanceDue,
            } satisfies EquipmentItem;
          });
          break;
        case 'video':
          adjustedEquipment = prev.equipment.map(item => {
            if (item.department !== 'video') return item;
            const boostedCondition = Math.min(100, item.condition + 8);
            return {
              ...item,
              condition: boostedCondition,
            } satisfies EquipmentItem;
          });
          adjustedCrew = prev.crew.map(crew => {
            if (crew.department !== 'video') return crew;
            const certification = 'Rapid Response Video Specialist';
            const certifications = crew.certifications.includes(certification)
              ? crew.certifications
              : [...crew.certifications, certification];
            return {
              ...crew,
              certifications,
            } satisfies CrewMember;
          });
          break;
        case 'stage':
          adjustedCrew = prev.crew.map(crew => {
            if (crew.department !== 'stage') return crew;
            return {
              ...crew,
              fatigue: Math.max(0, crew.fatigue - 10),
            } satisfies CrewMember;
          });
          break;
        case 'balanced':
          adjustedBalance += 2000;
          adjustedReputation = Math.min(100, prev.company.reputation + 5);
          adjustedTransactions = [
            ...prev.finances.transactions,
            createTransaction(prev.currentDate, 'income', 2000, 'Strategic partnership bonus', 'misc'),
          ];
          break;
        default:
          break;
      }

      const updatedCompany: Company = {
        ...baseCompany,
        balance: adjustedBalance,
        reputation: adjustedReputation,
      };

      const updatedCompetitors = prev.competitors.map(competitor => ({
        ...competitor,
        scoutingNotes: competitor.scoutingNotes.map(note =>
          note.includes(prev.company.name)
            ? note.replace(prev.company.name, identity.name)
            : note,
        ),
      }));

      const specializationBoosts: Record<Company['specialization'], string> = {
        audio: 'Audio crew hit the ground with higher skill caps.',
        lighting: 'Lighting inventory refreshed with top condition gear.',
        video: 'Video teams prepped for crisis response out of the gate.',
        stage: 'Stage crews rested and ready for rapid builds.',
        balanced: 'Launch bonus extends runway and reputation.',
      };

      const launchStory: MarketNewsItem = {
        id: `market-${Date.now()}-launch`,
        date: new Date(),
        title: `${identity.name} enters the circuit`,
        summary: `${identity.name} launches with ${specializationLabels[identity.specialization]} and a refreshed brand palette. ${specializationBoosts[identity.specialization]}`,
        tone: 'positive',
      };

      const filteredNews = prev.marketNews.filter(
        item => !item.title.toLowerCase().includes('prepares to launch'),
      );

      const nextNews = [launchStory, ...filteredNews].slice(0, 8);

      const { overdraftDays, isBankrupt } = evaluateFinancialState(prev, adjustedBalance);

      const refreshedCrises = rebuildAllPlannedCrises(
        { ...prev, company: updatedCompany },
        prev.events,
        adjustedCrew,
        adjustedEquipment,
      );

      return {
        ...prev,
        company: updatedCompany,
        crew: adjustedCrew,
        equipment: adjustedEquipment,
        competitors: updatedCompetitors,
        marketNews: nextNews,
        finances: {
          ...prev.finances,
          transactions: adjustedTransactions,
          overdraftDays,
        },
        crises: refreshedCrises,
        hasCompletedOnboarding: true,
        isBankrupt,
      };
    });
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

      if (event.status === 'failed') {
        result = {
          success: false,
          reason: 'This contract has already been awarded to a competitor.',
        };
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

      const updatedCrewList = prev.crew.map(c =>
        c.id === crewId ? updatedCrewMember : c,
      );
      const updatedEvents = prev.events.map(e => {
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
        prev,
        updatedEvent,
        updatedCrewList,
        prev.equipment,
      );

      return {
        ...prev,
        crew: updatedCrewList,
        events: updatedEvents,
        crises: updatedCrises,
      };
    });

    return result;
  };

  const unassignCrewFromEvent = (eventId: string, crewId: string) => {
    setGameState(prev => {
      const updatedCrewList = prev.crew.map(c =>
        c.id === crewId ? { ...c, assignedTo: undefined } : c,
      );
      const updatedEvents = prev.events.map(e => {
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
        ? rebuildEventCrises(prev, updatedEvent, updatedCrewList, prev.equipment)
        : prev.crises;

      return {
        ...prev,
        crew: updatedCrewList,
        events: updatedEvents,
        crises: updatedCrises,
      };
    });
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

      const updatedEquipment = prev.equipment.map(eq =>
        eq.id === equipmentId
          ? { ...eq, status: 'assigned' as const, assignedToEvent: eventId }
          : eq,
      );
      const updatedEvents = prev.events.map(e =>
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
        prev,
        updatedEvent,
        prev.crew,
        updatedEquipment,
      );

      return {
        ...prev,
        equipment: updatedEquipment,
        events: updatedEvents,
        crises: updatedCrises,
      };
    });

    return result;
  };

  const unassignEquipmentFromEvent = (
    eventId: string,
    equipmentId: string,
    department: Department
  ) => {
    setGameState(prev => {
      const updatedEquipment = prev.equipment.map(eq =>
        eq.id === equipmentId
          ? { ...eq, status: 'available' as const, assignedToEvent: undefined }
          : eq,
      );
      const updatedEvents = prev.events.map(e =>
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
        ? rebuildEventCrises(prev, updatedEvent, prev.crew, updatedEquipment)
        : prev.crises;

      return {
        ...prev,
        equipment: updatedEquipment,
        events: updatedEvents,
        crises: updatedCrises,
      };
    });
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
              prev.currentDate,
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

      const definition = getEquipmentDefinition(type);
      const rentalItem = createRentalEquipment(type, prev.currentDate, rentalDays, provider);
      let adjustedDailyCost = rentalItem.rentalInfo?.dailyCost ?? definition.rentalDailyCost;

      if (prev.company.specialization === 'audio' && definition.department === 'audio') {
        adjustedDailyCost = Math.round(adjustedDailyCost * 0.85);
      }

      if (rentalItem.rentalInfo) {
        rentalItem.rentalInfo.dailyCost = adjustedDailyCost;
      }

      const totalCost = adjustedDailyCost * rentalDays;

      const newBalance = prev.company.balance - totalCost;
      const transactions = totalCost
        ? [
            ...prev.finances.transactions,
            createTransaction(
              prev.currentDate,
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

      const updatedEvents = prev.events.map(e => {
        if (e.id !== eventId) return e;
        const clearedBids = e.bids.length
          ? e.bids.map(bid => ({ ...bid, status: 'lost' as const, submittedOn: new Date() }))
          : e.bids;
        return { ...e, status: 'planned' as const, bids: clearedBids };
      });
      const updatedEvent = updatedEvents.find(e => e.id === eventId);
      const updatedCrises = updatedEvent
        ? rebuildEventCrises(prev, updatedEvent, prev.crew, prev.equipment)
        : prev.crises;

      const updatedCompetitors = prev.competitors.map(competitor =>
        competitor.activeBids.includes(eventId)
          ? {
              ...competitor,
              activeBids: competitor.activeBids.filter(id => id !== eventId),
            }
          : competitor,
      );

      const acceptanceNews =
        event.bids.length > 0
          ? ({
              id: `market-${Date.now()}-${event.id}-player-win`,
              date: new Date(),
              title: `${prev.company.name} locks ${event.name}`,
              summary: `${prev.company.name} confirmed the ${event.venue} contract ahead of ${event.bids.length} rival bids.`,
              tone: 'positive' as const,
              eventId: event.id,
            } satisfies MarketNewsItem)
          : undefined;

      const nextNews = acceptanceNews
        ? [acceptanceNews, ...prev.marketNews].slice(0, 8)
        : prev.marketNews;

      return {
        ...prev,
        events: updatedEvents,
        crises: updatedCrises,
        competitors: updatedCompetitors,
        marketNews: nextNews,
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
      const eventCrises = prev.crises.filter(crisis => crisis.eventId === eventId);
      const { satisfactionDelta, additionalExpenses, outcomes } = evaluateCrisisOutcomes(
        event,
        eventCrises,
      );
      const finalSatisfaction = Math.max(
        0,
        Math.min(100, satisfaction + satisfactionDelta),
      );
      const reputationGain = Math.floor((finalSatisfaction / 100) * 5);

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
            prev.currentDate,
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
          prev.currentDate,
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
            prev.currentDate,
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
            prev.currentDate,
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
      const newBalance = prev.company.balance + net;
      const { overdraftDays, isBankrupt } = evaluateFinancialState(prev, newBalance);

      const updatedCrewList = prev.crew.map(c => {
        const wasAssigned = Object.values(event.assignedCrew)
          .flat()
          .some(ec => ec.id === c.id);
        if (wasAssigned) {
          const availability = new Date(event.date);
          availability.setDate(availability.getDate() + recoveryDays);
          availability.setHours(8, 0, 0, 0);

          const baseFatigue = 20 + Math.floor(event.travelHours / 2);
          const fatigueAdjustment =
            prev.company.specialization === 'stage' && c.department === 'stage'
              ? -6
              : 0;
          const appliedFatigue = Math.max(8, baseFatigue + fatigueAdjustment);

          const baseCrew: CrewMember = {
            ...c,
            assignedTo: undefined,
            fatigue: Math.min(100, c.fatigue + appliedFatigue),
            availableOn: availability,
          };

          const { updatedCrew, result } = applyExperienceGain(
            baseCrew,
            event,
            finalSatisfaction,
          );

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
        const wearReduction =
          prev.company.specialization === 'lighting' && eq.department === 'lighting' ? 3 : 0;
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

      summary = {
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

      return {
        ...prev,
        company: {
          ...prev.company,
          balance: newBalance,
          reputation: Math.min(100, prev.company.reputation + reputationGain),
        },
        events: prev.events.map(e => {
          if (e.id === eventId) {
            const postEventReport: EventPostReport = {
              completedOn: new Date(prev.currentDate),
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
          ...prev.finances,
          transactions,
          overdraftDays,
        },
        crises: prev.crises.filter(crisis => crisis.eventId !== eventId),
        isBankrupt,
      };
    });

    return summary;
  };

  const respondToCrisisPrompt = (promptId: string, choiceId: string) => {
    let response: { success: boolean; reason?: string } = {
      success: false,
      reason: 'Crisis prompt not found',
    };

    setGameState(prev => {
      const promptIndex = prev.crises.findIndex(crisis => crisis.id === promptId);
      if (promptIndex === -1) {
        return prev;
      }

      const prompt = prev.crises[promptIndex];
      const event = prev.events.find(e => e.id === prompt.eventId);

      if (!event || (event.status !== 'planned' && event.status !== 'in-progress')) {
        response = {
          success: false,
          reason: 'This crisis can only be addressed for scheduled events.',
        };
        return prev;
      }

      if (prompt.resolved) {
        response = {
          success: false,
          reason: 'This crisis has already been resolved.',
        };
        return prev;
      }

      const choice = prompt.choices.find(option => option.id === choiceId);
      if (!choice) {
        response = {
          success: false,
          reason: 'Resolution option not found.',
        };
        return prev;
      }

      let newBalance = prev.company.balance;
      let transactions = prev.finances.transactions;

      if (choice.cost && choice.cost !== 0) {
        const costAmount = Math.abs(choice.cost);
        const isExpense = choice.cost > 0;
        const transaction = createTransaction(
          prev.currentDate,
          isExpense ? 'expense' : 'income',
          costAmount,
          `${prompt.title} – ${choice.label}`,
          choice.transactionCategory ?? 'operations',
          prompt.eventId,
        );

        transactions = [...transactions, transaction];
        newBalance += isExpense ? -costAmount : costAmount;
      }

      const { overdraftDays, isBankrupt } = evaluateFinancialState(prev, newBalance);

      response = { success: true };

      const updatedPrompt: CrisisPrompt = {
        ...prompt,
        resolved: true,
        selectedChoiceId: choice.id,
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
        crises: prev.crises.map((crisis, index) =>
          index === promptIndex ? updatedPrompt : crisis,
        ),
        isBankrupt,
      };
    });

    return response;
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

      const refreshedCrew = prev.crew.map(c => {
        const recovered = {
          ...c,
          fatigue: Math.max(0, c.fatigue - 5),
        };
        return applyDailyMoraleDrift(recovered, newDate);
      });

      const scheduleProgress = progressCompetitorSchedules(prev.competitors, newDate);
      const biddingWithSchedule = simulateCompetitorBidding({
        events: cleanedEvents,
        competitors: scheduleProgress.competitors,
        currentDate: newDate,
        playerCompany: prev.company,
      });

      // Runs after competitor bidding so contracts get one last day of
      // interest before an unclaimed offer expires; also flips planned
      // shows into in-progress on their date and auto-fails no-shows.
      const lifecycle = applyEventLifecycle(
        biddingWithSchedule.events,
        refreshedCrew,
        updatedEquipment,
        newDate,
        prev.company.name,
      );

      const newBalance =
        prev.company.balance -
        lifecycle.transactions.reduce(
          (sum, txn) => sum + (txn.type === 'expense' ? txn.amount : -txn.amount),
          0,
        );
      const { overdraftDays, isBankrupt } = evaluateFinancialState(prev, newBalance);
      const newReputation = Math.max(
        0,
        Math.min(100, prev.company.reputation + lifecycle.reputationDelta),
      );

      const recalculatedCrises = rebuildAllPlannedCrises(
        prev,
        lifecycle.events,
        lifecycle.crew,
        lifecycle.equipment,
      );

      const combinedNews = [...scheduleProgress.news, ...biddingWithSchedule.news, ...lifecycle.news];
      const nextNews = combinedNews.length
        ? [...combinedNews, ...prev.marketNews].slice(0, 10)
        : prev.marketNews;

      const snapshot = buildReputationSnapshot(
        { ...prev.company, reputation: newReputation },
        biddingWithSchedule.competitors,
        newDate,
      );
      const reputationHistory = [...prev.reputationHistory, snapshot].slice(-45);

      return {
        ...prev,
        currentDate: newDate,
        events: lifecycle.events,
        crew: lifecycle.crew,
        equipment: lifecycle.equipment,
        company: {
          ...prev.company,
          balance: newBalance,
          reputation: newReputation,
        },
        finances: {
          ...prev.finances,
          transactions: lifecycle.transactions.length
            ? [...prev.finances.transactions, ...lifecycle.transactions]
            : prev.finances.transactions,
          overdraftDays,
        },
        crises: recalculatedCrises,
        isBankrupt,
        competitors: biddingWithSchedule.competitors,
        marketNews: nextNews,
        reputationHistory,
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
        prev.currentDate,
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
