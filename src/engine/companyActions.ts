import { Company, CrewMember, EquipmentItem, GameState, MarketNewsItem } from '@/types/game';
import { rebuildAllPlannedCrises } from '@/lib/crisis';
import { createTransaction, evaluateFinancialState } from '@/lib/finance';
import type { CompanyIdentityInput } from './types';

const specializationLabels: Record<Company['specialization'], string> = {
  audio: 'audio specialists',
  lighting: 'lighting design experts',
  video: 'video innovators',
  stage: 'stagecraft veterans',
  balanced: 'full-service crews',
};

export function updateCompanyIdentity(
  state: GameState,
  updates: Partial<Pick<Company, 'brandColor' | 'accentColor' | 'tagline'>>,
): GameState {
  return {
    ...state,
    company: {
      ...state.company,
      ...updates,
    },
  };
}

export function completeCompanyOnboarding(
  state: GameState,
  identity: CompanyIdentityInput,
): GameState {
  if (state.hasCompletedOnboarding) {
    return state;
  }

  const baseCompany: Company = {
    ...state.company,
    ...identity,
  };

  let adjustedCrew = state.crew.map(crew => ({ ...crew }));
  let adjustedEquipment = state.equipment.map(item => ({ ...item }));
  let adjustedTransactions = [...state.finances.transactions];
  let adjustedBalance = state.company.balance;
  let adjustedReputation = state.company.reputation;

  switch (identity.specialization) {
    case 'audio':
      adjustedCrew = state.crew.map(crew => {
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
      adjustedEquipment = state.equipment.map(item => {
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
      adjustedEquipment = state.equipment.map(item => {
        if (item.department !== 'video') return item;
        const boostedCondition = Math.min(100, item.condition + 8);
        return {
          ...item,
          condition: boostedCondition,
        } satisfies EquipmentItem;
      });
      adjustedCrew = state.crew.map(crew => {
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
      adjustedCrew = state.crew.map(crew => {
        if (crew.department !== 'stage') return crew;
        return {
          ...crew,
          fatigue: Math.max(0, crew.fatigue - 10),
        } satisfies CrewMember;
      });
      break;
    case 'balanced':
      adjustedBalance += 2000;
      adjustedReputation = Math.min(100, state.company.reputation + 5);
      adjustedTransactions = [
        ...state.finances.transactions,
        createTransaction(state.currentDate, 'income', 2000, 'Strategic partnership bonus', 'misc'),
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

  const updatedCompetitors = state.competitors.map(competitor => ({
    ...competitor,
    scoutingNotes: competitor.scoutingNotes.map(note =>
      note.includes(state.company.name) ? note.replace(state.company.name, identity.name) : note,
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

  const filteredNews = state.marketNews.filter(
    item => !item.title.toLowerCase().includes('prepares to launch'),
  );

  const nextNews = [launchStory, ...filteredNews].slice(0, 8);

  const { overdraftDays, isBankrupt } = evaluateFinancialState(state.finances, adjustedBalance);

  const refreshedCrises = rebuildAllPlannedCrises(
    state.crises,
    state.events,
    adjustedCrew,
    adjustedEquipment,
    updatedCompany.reputation,
    updatedCompany.specialization,
  );

  return {
    ...state,
    company: updatedCompany,
    crew: adjustedCrew,
    equipment: adjustedEquipment,
    competitors: updatedCompetitors,
    marketNews: nextNews,
    finances: {
      ...state.finances,
      transactions: adjustedTransactions,
      overdraftDays,
    },
    crises: refreshedCrises,
    hasCompletedOnboarding: true,
    isBankrupt,
  };
}
