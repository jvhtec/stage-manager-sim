import {
  Company,
  CompetitorCompany,
  Event,
  GameState,
  ReputationSnapshot,
} from '@/types/game';
import {
  generateInitialCrew,
  createInitialCompany,
  generateEvent,
  generateInitialEquipmentInventory,
} from '@/lib/gameData';
import { createInitialMarketNews, generateInitialCompetitors } from '@/lib/competitors';
import { createRng, createRandomSeed } from '@/lib/rng';

export const SAVE_STORAGE_KEY = 'stage-manager-sim:save';
// Bump whenever the GameState shape changes in a way old saves can't satisfy.
// v2: added rngState (seeded PRNG) — older saves lack it and are discarded.
export const SAVE_SCHEMA_VERSION = 2;

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

export function loadSavedGameState(): GameState | null {
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

export function persistGameState(state: GameState) {
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

export function clearSavedGameState() {
  try {
    localStorage.removeItem(SAVE_STORAGE_KEY);
  } catch {
    // Ignore storage errors; callers still reset in-memory state.
  }
}

export function buildReputationSnapshot(
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

export function createNewGameState(): GameState {
  const now = new Date();
  const rng = createRng(createRandomSeed());
  const events: Event[] = [];

  // Generate 5 available gigs over the next 2 weeks
  for (let i = 0; i < 5; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() + 3 + i * 2);
    events.push(generateEvent(date, 'gig', rng));
  }

  const company = createInitialCompany();
  const equipment = generateInitialEquipmentInventory(now);
  const competitors = generateInitialCompetitors(company, rng);
  const marketNews = createInitialMarketNews(competitors, company, now);
  const reputationHistory = [buildReputationSnapshot(company, competitors, now)];

  return {
    company,
    crew: generateInitialCrew(rng, now),
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
    rngState: rng.getState(),
  } as GameState;
}
