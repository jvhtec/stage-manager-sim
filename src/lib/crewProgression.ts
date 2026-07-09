import { CrewMember, Department, Event } from '@/types/game';
import type { Rng } from './rng';

export const MAX_SKILL_LEVEL = 10;

const CERTIFICATION_THRESHOLDS = [3, 5, 7, 9];

const DEPARTMENT_CERTIFICATIONS: Record<Department, string[]> = {
  audio: [
    'RF Coordination',
    'Monitor Engineer',
    'Front-of-House Lead',
    'Arena Systems Tech',
  ],
  lighting: [
    'Rigging Safety',
    'Lighting Programmer',
    'Touring LD',
    'Festival Grid Specialist',
  ],
  video: [
    'LED Wall Tech',
    'Camera Shader',
    'Projection Mapping',
    'Broadcast Engineer',
  ],
  stage: [
    'Stage Boss',
    'Logistics Coordinator',
    'Road Case Efficiency',
    'Festival Deck Lead',
  ],
};

export interface MoraleShift {
  id: string;
  date: Date;
  description: string;
  delta: number;
  type: 'positive' | 'negative';
}

export interface ExperienceGainResult {
  crewId: string;
  crewName: string;
  xpGained: number;
  experience: number;
  experienceToNext: number;
  leveledUp: boolean;
  newSkillLevel: number;
  newCertification?: string;
  moraleDelta: number;
}

const POSITIVE_MORALE_EVENTS = [
  { description: 'Client shout-out boosted confidence', delta: 6 },
  { description: 'Team camaraderie lifted spirits', delta: 4 },
  { description: 'Successful rehearsal momentum', delta: 5 },
];

const NEGATIVE_MORALE_EVENTS = [
  { description: 'Long travel day caused fatigue', delta: -6 },
  { description: 'Logistics delay frustrated crew', delta: -4 },
  { description: 'Family obligations stressing focus', delta: -5 },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function getExperienceThresholdForLevel(level: number) {
  if (level >= MAX_SKILL_LEVEL) {
    return Infinity;
  }
  return 100 + (level - 1) * 40;
}

export function initializeCrewProgression(department: Department, skillLevel: number, rng: Rng) {
  const certificationsNeeded = CERTIFICATION_THRESHOLDS.filter(
    threshold => skillLevel >= threshold,
  ).length;
  const certifications = DEPARTMENT_CERTIFICATIONS[department].slice(0, certificationsNeeded);
  const experience = rng.nextInt(Math.max(10, getExperienceThresholdForLevel(skillLevel)));

  return { experience, certifications };
}

export function calculateExperienceGain(event: Event, satisfaction: number, crew: CrewMember) {
  const base = 40 + event.setupHours * 2 + event.eventHours * 3 + event.teardownHours * 2;
  const travelBonus = Math.max(0, event.travelHours - 2) * 2;
  const satisfactionBonus = Math.floor((satisfaction - 70) / 5);
  const fatiguePenalty = Math.floor(crew.fatigue / 25) * 5;

  return Math.max(15, base + travelBonus + satisfactionBonus - fatiguePenalty);
}

function getNextCertification(department: Department, currentCerts: string[], skillLevel: number) {
  const eligibleCount = CERTIFICATION_THRESHOLDS.filter(threshold => skillLevel >= threshold).length;
  if (eligibleCount > currentCerts.length) {
    return DEPARTMENT_CERTIFICATIONS[department][currentCerts.length];
  }
  return undefined;
}

function createMoraleShift(description: string, delta: number, type: 'positive' | 'negative'): MoraleShift {
  return {
    id: `morale-${Date.now()}-${Math.random()}`,
    date: new Date(),
    description,
    delta,
    type,
  };
}

export function applyExperienceGain(
  crew: CrewMember,
  event: Event,
  satisfaction: number,
): { updatedCrew: CrewMember; result: ExperienceGainResult } {
  const xpGained = calculateExperienceGain(event, satisfaction, crew);
  let experience = crew.experience + xpGained;
  let skillLevel = crew.skillLevel;
  let leveledUp = false;
  let newCertification: string | undefined;

  while (skillLevel < MAX_SKILL_LEVEL) {
    const threshold = getExperienceThresholdForLevel(skillLevel);
    if (experience < threshold) {
      break;
    }
    experience -= threshold;
    skillLevel += 1;
    leveledUp = true;
    if (!newCertification) {
      newCertification = getNextCertification(crew.department, crew.certifications, skillLevel);
    }
  }

  if (skillLevel >= MAX_SKILL_LEVEL) {
    experience = Math.min(experience, getExperienceThresholdForLevel(MAX_SKILL_LEVEL - 1));
  }

  const moraleDelta = leveledUp ? 10 : satisfaction >= 85 ? 4 : satisfaction < 60 ? -6 : 1;
  const morale = clamp(crew.morale + moraleDelta, 0, 100);

  const updatedCrew: CrewMember = {
    ...crew,
    skillLevel,
    experience,
    morale,
    hourlyRate: 20 + skillLevel * 5,
    certifications: newCertification ? [...crew.certifications, newCertification] : crew.certifications,
    recentMoraleShift:
      moraleDelta > 0 || moraleDelta < 0
        ? createMoraleShift(
            newCertification
              ? `${crew.name} earned ${newCertification}`
              : moraleDelta > 0
              ? 'Positive momentum after recent show'
              : 'Crew is feeling burnt out',
            moraleDelta,
            moraleDelta >= 0 ? 'positive' : 'negative',
          )
        : crew.recentMoraleShift,
  };

  return {
    updatedCrew,
    result: {
      crewId: crew.id,
      crewName: crew.name,
      xpGained,
      experience,
      experienceToNext: getExperienceThresholdForLevel(updatedCrew.skillLevel),
      leveledUp,
      newSkillLevel: updatedCrew.skillLevel,
      newCertification,
      moraleDelta,
    },
  };
}

export function applyDailyMoraleDrift(crew: CrewMember, currentDate: Date, rng: Rng): CrewMember {
  const moraleRecovery = crew.morale < 80 ? 1 : 0;
  let morale = clamp(crew.morale + moraleRecovery, 0, 100);
  let recentMoraleShift = crew.recentMoraleShift;

  const roll = rng.next();
  if (roll < 0.08) {
    const event = rng.pick(POSITIVE_MORALE_EVENTS);
    morale = clamp(morale + event.delta, 0, 100);
    recentMoraleShift = {
      ...createMoraleShift(event.description, event.delta, event.delta >= 0 ? 'positive' : 'negative'),
      date: currentDate,
    };
  } else if (roll > 0.92) {
    const event = rng.pick(NEGATIVE_MORALE_EVENTS);
    morale = clamp(morale + event.delta, 0, 100);
    recentMoraleShift = {
      ...createMoraleShift(event.description, event.delta, event.delta >= 0 ? 'positive' : 'negative'),
      date: currentDate,
    };
  } else if (recentMoraleShift && currentDate.getTime() - recentMoraleShift.date.getTime() > 1000 * 60 * 60 * 24 * 7) {
    recentMoraleShift = undefined;
  }

  return {
    ...crew,
    morale,
    recentMoraleShift,
  };
}
