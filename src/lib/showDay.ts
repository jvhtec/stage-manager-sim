import { CrewMember, EquipmentItem, Event } from '@/types/game';

export type ShowPhaseId = 'load-in' | 'showtime' | 'teardown';

export interface ShowPhaseInfo {
  id: ShowPhaseId;
  label: string;
  description: string;
}

export const SHOW_PHASES: ShowPhaseInfo[] = [
  {
    id: 'load-in',
    label: 'Load-In & Setup',
    description: 'Trucks in, gear unloaded, rig goes up before doors.',
  },
  {
    id: 'showtime',
    label: 'Doors & Performance',
    description: 'The audience is in and the show is live.',
  },
  {
    id: 'teardown',
    label: 'Teardown & Turnaround',
    description: 'Strike the show and get the venue back on schedule.',
  },
];

// Execution-stage crisis prompts are keyed off a fixed id suffix (see
// buildPrompt() call sites in crisis.ts) — map each known one to the show
// phase it plays out in. Anything execution-stage but unmapped defaults to
// the live performance itself.
const CRISIS_PHASE_BY_SUFFIX: Record<string, ShowPhaseId> = {
  'worn-equipment': 'load-in',
  'turnaround-risk': 'teardown',
};

export function getPhaseForCrisisPrompt(promptId: string): ShowPhaseId {
  for (const suffix of Object.keys(CRISIS_PHASE_BY_SUFFIX)) {
    if (promptId.endsWith(suffix)) {
      return CRISIS_PHASE_BY_SUFFIX[suffix];
    }
  }
  return 'showtime';
}

/**
 * A 0-100 readiness score derived from who and what actually showed up:
 * average crew skill, how rested the crew is, and the condition of the
 * gear assigned to the show. This is what the baseline satisfaction is
 * built from — it replaces a flat number that ignored preparation entirely.
 */
export function calculatePreparationScore(
  event: Event,
  crew: CrewMember[],
  equipment: EquipmentItem[],
): number {
  const assignedCrew = Object.values(event.assignedCrew).flat();
  const assignedEquipmentIds = new Set(Object.values(event.assignedEquipment).flat());
  const assignedEquipment = equipment.filter(item => assignedEquipmentIds.has(item.id));

  const avgSkill = assignedCrew.length
    ? assignedCrew.reduce((sum, member) => sum + member.skillLevel, 0) / assignedCrew.length
    : 0; // crew skillLevel is on a 1-10 scale

  const avgFatigue = assignedCrew.length
    ? assignedCrew.reduce((sum, member) => sum + member.fatigue, 0) / assignedCrew.length
    : 0; // 0-100, higher is worse

  const avgCondition = assignedEquipment.length
    ? assignedEquipment.reduce((sum, item) => sum + item.condition, 0) / assignedEquipment.length
    : 100; // no assigned gear (e.g. a department with no equipment need) defaults neutral-good

  const skillComponent = Math.min(100, (avgSkill / 10) * 100);
  const restComponent = Math.max(0, 100 - avgFatigue);
  const conditionComponent = avgCondition;

  const score = skillComponent * 0.45 + restComponent * 0.25 + conditionComponent * 0.3;
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Maps the 0-100 preparation score onto a baseline client satisfaction
 * before live-show incidents are factored in. Even flawless prep tops out
 * short of perfect — the rest is earned (or lost) on the day.
 */
export function getBaseSatisfactionFromPreparation(preparationScore: number): number {
  return Math.round(45 + preparationScore * 0.45);
}

export function getPreparationTier(preparationScore: number): {
  label: string;
  description: string;
} {
  if (preparationScore >= 80) {
    return { label: 'Excellent', description: 'This crew and rig are ready for anything.' };
  }
  if (preparationScore >= 60) {
    return { label: 'Solid', description: 'A dependable setup with a little room to slip.' };
  }
  if (preparationScore >= 40) {
    return { label: 'Shaky', description: 'Gaps in skill, rest, or gear condition are showing.' };
  }
  return { label: 'Poor', description: 'This show is running on hope more than preparation.' };
}
