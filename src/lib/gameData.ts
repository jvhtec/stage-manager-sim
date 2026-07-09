import {
  CrewMember,
  Event,
  Company,
  Department,
  EquipmentItem,
  EquipmentRequirement,
  FinancialTransaction,
  MarketNewsItem,
} from '@/types/game';
import { initializeCrewProgression } from './crewProgression';
import {
  generateInitialEquipment,
  getEquipmentRequirementsForEvent,
  getWearForEvent,
} from './equipment';
import type { Rng } from './rng';
import { getReputationTier, getCompanyLevel } from './reputationTiers';

const firstNames = ['Alex', 'Jordan', 'Sam', 'Riley', 'Casey', 'Morgan', 'Taylor', 'Jamie', 'Chris', 'Avery'];
const lastNames = ['Chen', 'Smith', 'Johnson', 'Martinez', 'Brown', 'Davis', 'Wilson', 'Moore', 'Taylor', 'Anderson'];

export interface BrandingPreset {
  id: string;
  label: string;
  description: string;
  brandColor: string;
  accentColor: string;
  specialization: Company['specialization'];
  tagline: string;
}

const brandingPresets: BrandingPreset[] = [
  {
    id: 'audio-vanguard',
    label: 'Audio Vanguard',
    description: 'Top-tier FOH mixes and detail-oriented engineers.',
    brandColor: '#1d4ed8',
    accentColor: '#60a5fa',
    specialization: 'audio',
    tagline: 'Mixing legends into every room.',
  },
  {
    id: 'lighting-sculptors',
    label: 'Lighting Sculptors',
    description: 'Precision lighting rigs with signature atmospheres.',
    brandColor: '#f59e0b',
    accentColor: '#fbbf24',
    specialization: 'lighting',
    tagline: 'Crafting light that tells the story.',
  },
  {
    id: 'video-cascade',
    label: 'Video Cascade',
    description: 'Immersive visuals and rock-solid video systems.',
    brandColor: '#7c3aed',
    accentColor: '#c4b5fd',
    specialization: 'video',
    tagline: 'Visual stories without a dropped frame.',
  },
  {
    id: 'stage-forge',
    label: 'Stage Forge',
    description: 'Resilient builds, fast changeovers, and safe decks.',
    brandColor: '#0f766e',
    accentColor: '#5eead4',
    specialization: 'stage',
    tagline: 'Building stages that never blink.',
  },
  {
    id: 'balanced-studio',
    label: 'Balanced Studio',
    description: 'Well-rounded crews focused on reliability and rapport.',
    brandColor: '#6b21a8',
    accentColor: '#d946ef',
    specialization: 'balanced',
    tagline: 'Every department, perfectly in sync.',
  },
];

export function getBrandingPresets(): BrandingPreset[] {
  return brandingPresets;
}

export function generateCrewMember(
  department: Department,
  skillLevel: number,
  rng: Rng,
  currentDate: Date,
): CrewMember {
  const firstName = rng.pick(firstNames);
  const lastName = rng.pick(lastNames);
  const progression = initializeCrewProgression(department, skillLevel, rng);

  return {
    id: `crew-${Date.now()}-${Math.random()}`,
    name: `${firstName} ${lastName}`,
    department,
    skillLevel,
    hourlyRate: 20 + (skillLevel * 5),
    fatigue: rng.nextInt(30),
    morale: 70 + rng.nextInt(30),
    availableOn: new Date(currentDate),
    experience: progression.experience,
    certifications: progression.certifications,
  };
}

export function generateInitialCrew(rng: Rng, currentDate: Date): CrewMember[] {
  return [
    generateCrewMember('audio', 6, rng, currentDate),
    generateCrewMember('audio', 4, rng, currentDate),
    generateCrewMember('lighting', 5, rng, currentDate),
    generateCrewMember('lighting', 4, rng, currentDate),
    generateCrewMember('video', 5, rng, currentDate),
    generateCrewMember('stage', 6, rng, currentDate),
    generateCrewMember('stage', 5, rng, currentDate),
  ];
}

export function generateEvent(
  date: Date,
  type: 'gig' | 'tour' | 'festival',
  rng: Rng,
  reputation: number,
): Event {
  const eventNames = ['Rock Night', 'Jazz Evening', 'EDM Festival', 'Corporate Event', 'Comedy Show', 'Music Awards'];

  const tier = getReputationTier(reputation);

  const startHour = type === 'festival'
    ? 12 + rng.nextInt(4) // Midday start for festivals
    : type === 'tour'
      ? 16 + rng.nextInt(3) // Late afternoon/evening for tours
      : 18 + rng.nextInt(3); // Evening club gigs

  const travelHours = type === 'festival'
    ? 10 + rng.nextInt(4)
    : type === 'tour'
      ? 6 + rng.nextInt(4)
      : 3 + rng.nextInt(3);

  const baseRequirements = {
    gig: { audio: 2, lighting: 1, video: 1, stage: 2 },
    tour: { audio: 3, lighting: 2, video: 1, stage: 3 },
    festival: { audio: 5, lighting: 4, video: 3, stage: 6 },
  };

  const basePay = {
    gig: 2500,
    tour: 8000,
    festival: 25000,
  };

  const requirements = {
    audio: baseRequirements[type].audio + (tier.requirementBonus.audio ?? 0),
    lighting: baseRequirements[type].lighting + (tier.requirementBonus.lighting ?? 0),
    video: baseRequirements[type].video + (tier.requirementBonus.video ?? 0),
    stage: baseRequirements[type].stage + (tier.requirementBonus.stage ?? 0),
  };

  const equipmentRequirements = getEquipmentRequirementsForEvent(type);

  const acceptBy = new Date(date);
  acceptBy.setDate(acceptBy.getDate() - rng.nextInt(3) - 1);

  return {
    id: `event-${Date.now()}-${Math.random()}`,
    name: rng.pick(eventNames),
    type,
    date,
    venueTier: tier.level,
    startHour,
    status: 'available',
    venue: rng.pick(tier.venues),
    clientPay: Math.round(basePay[type] * tier.payMultiplier) + rng.nextInt(1000),
    requirements,
    equipmentRequirements,
    assignedCrew: {
      audio: [],
      lighting: [],
      video: [],
      stage: [],
    },
    assignedEquipment: {
      audio: [],
      lighting: [],
      video: [],
      stage: [],
    },
    setupHours: type === 'festival' ? 8 : type === 'tour' ? 4 : 2,
    eventHours: type === 'festival' ? 12 : type === 'tour' ? 6 : 4,
    teardownHours: type === 'festival' ? 6 : type === 'tour' ? 3 : 2,
    travelHours,
    bids: [],
    acceptBy,
  };
}

export function generateInitialEquipmentInventory(currentDate: Date = new Date()) {
  return generateInitialEquipment(currentDate);
}

export function createInitialCompany(overrides: Partial<Company> = {}): Company {
  const basePreset = brandingPresets.find(preset => preset.id === 'balanced-studio') ?? brandingPresets[0];
  const startingReputation = 50;

  const baseCompany: Company = {
    name: 'Sector Pro Productions',
    balance: 15000,
    reputation: startingReputation,
    level: getCompanyLevel(startingReputation),
    brandColor: basePreset.brandColor,
    accentColor: basePreset.accentColor,
    specialization: basePreset.specialization,
    tagline: basePreset.tagline,
  };

  return { ...baseCompany, ...overrides };
}

export function calculateEventCost(event: Event): number {
  let totalCost = 0;
  
  Object.values(event.assignedCrew).forEach(deptCrew => {
    deptCrew.forEach(crew => {
      const totalHours = event.setupHours + event.eventHours + event.teardownHours;
      totalCost += crew.hourlyRate * totalHours;
    });
  });
  
  return totalCost;
}

export function calculateEventProfit(event: Event): number {
  return event.clientPay - calculateEventCost(event);
}

export function isEventFullyStaffed(event: Event): boolean {
  return (
    event.assignedCrew.audio.length >= event.requirements.audio &&
    event.assignedCrew.lighting.length >= event.requirements.lighting &&
    event.assignedCrew.video.length >= event.requirements.video &&
    event.assignedCrew.stage.length >= event.requirements.stage
  );
}

function getTotalRequiredEquipment(
  requirements: EquipmentRequirement[]
): number {
  return requirements.reduce((total, req) => total + req.quantity, 0);
}

export function isEventEquipmentReady(event: Event): boolean {
  return (['audio', 'lighting', 'video', 'stage'] as Department[]).every(dept => {
    const requirements = event.equipmentRequirements[dept];
    if (!requirements || requirements.length === 0) {
      return true;
    }
    const requiredCount = getTotalRequiredEquipment(requirements);
    return event.assignedEquipment[dept].length >= requiredCount;
  });
}

export function getEquipmentWearForEvent(event: Event): number {
  return getWearForEvent(event.type);
}

export function getEventTimeWindow(event: Event) {
  const eventStart = new Date(event.date);
  eventStart.setHours(event.startHour, 0, 0, 0);

  const setupStart = new Date(eventStart);
  setupStart.setHours(setupStart.getHours() - event.setupHours);

  const teardownComplete = new Date(eventStart);
  teardownComplete.setHours(
    teardownComplete.getHours() + event.eventHours + event.teardownHours
  );

  return {
    setupStart,
    eventStart,
    teardownComplete,
  };
}

export function getCrewRecoveryDays(event: Event): number {
  const activeHours = event.setupHours + event.eventHours + event.teardownHours;
  const restBuffer = Math.max(1, Math.ceil(activeHours / 10));
  const travelBuffer = Math.max(1, Math.ceil(event.travelHours / 8));
  return restBuffer + travelBuffer;
}

// How many days past teardown a booked show is allowed to sit unresolved
// before it's treated as a no-show.
const SHOW_GRACE_DAYS = 1;
export const MISSED_SHOW_PENALTY_RATE = 0.35;
export const MISSED_SHOW_REPUTATION_PENALTY = 6;

function truncateToDay(date: Date): Date {
  const truncated = new Date(date);
  truncated.setHours(0, 0, 0, 0);
  return truncated;
}

export function getShowGraceDeadline(event: Event): Date {
  const { teardownComplete } = getEventTimeWindow(event);
  const deadline = new Date(teardownComplete);
  deadline.setDate(deadline.getDate() + SHOW_GRACE_DAYS);
  return deadline;
}

export interface EventLifecycleResult {
  events: Event[];
  crew: CrewMember[];
  equipment: EquipmentItem[];
  transactions: FinancialTransaction[];
  news: MarketNewsItem[];
  reputationDelta: number;
}

/**
 * Applies calendar-driven event transitions for a single day advance:
 * unclaimed `available` contracts past their accept deadline expire,
 * `planned` shows flip to `in-progress` on their date, and shows left
 * unresolved past a grace deadline are auto-failed with a cancellation
 * penalty and reputation hit — freeing whatever crew/gear they held.
 * Must run after competitor bidding has had its chance at `available` events.
 */
export function applyEventLifecycle(
  events: Event[],
  crew: CrewMember[],
  equipment: EquipmentItem[],
  currentDate: Date,
  companyName: string,
): EventLifecycleResult {
  const transactions: FinancialTransaction[] = [];
  const news: MarketNewsItem[] = [];
  let reputationDelta = 0;
  const overdueEventIds = new Set<string>();
  const today = truncateToDay(currentDate);

  const updatedEvents = events.map(event => {
    if (event.status === 'available') {
      const hasActiveInterest = event.bids.some(bid => bid.status === 'active');
      if (!hasActiveInterest && today.getTime() > truncateToDay(event.acceptBy).getTime()) {
        news.push({
          id: `market-${currentDate.getTime()}-${event.id}-expired`,
          date: new Date(currentDate),
          title: `${event.name} opportunity lapses`,
          summary: `Nobody secured the ${event.venue} booking in time — the client moved on.`,
          tone: 'info',
          eventId: event.id,
        });
        return {
          ...event,
          status: 'failed' as const,
          lostReason: 'Booking window closed unclaimed.',
        };
      }
      return event;
    }

    if (event.status === 'planned' || event.status === 'in-progress') {
      const { eventStart } = getEventTimeWindow(event);
      const graceDeadline = getShowGraceDeadline(event);

      if (today.getTime() > truncateToDay(graceDeadline).getTime()) {
        overdueEventIds.add(event.id);
        const penalty = Math.round(event.clientPay * MISSED_SHOW_PENALTY_RATE);
        transactions.push({
          id: `txn-${currentDate.getTime()}-${event.id}-missed`,
          date: new Date(currentDate),
          type: 'expense',
          amount: penalty,
          description: `Cancellation penalty for missed show: ${event.name}`,
          category: 'contracts',
          eventId: event.id,
        });
        reputationDelta -= MISSED_SHOW_REPUTATION_PENALTY;
        news.push({
          id: `market-${currentDate.getTime()}-${event.id}-missed`,
          date: new Date(currentDate),
          title: `${event.name} collapses without a crew`,
          summary: `${companyName} failed to deliver at ${event.venue}. A cancellation penalty and reputation hit follow.`,
          tone: 'warning',
          eventId: event.id,
        });
        return {
          ...event,
          status: 'failed' as const,
          lostReason: 'Show was never executed before the grace deadline passed.',
        };
      }

      if (event.status === 'planned' && today.getTime() >= truncateToDay(eventStart).getTime()) {
        return { ...event, status: 'in-progress' as const };
      }

      return event;
    }

    return event;
  });

  const releasedCrew = overdueEventIds.size
    ? crew.map(member =>
        member.assignedTo && overdueEventIds.has(member.assignedTo)
          ? { ...member, assignedTo: undefined }
          : member,
      )
    : crew;

  const releasedEquipment = overdueEventIds.size
    ? equipment.map(item =>
        item.assignedToEvent && overdueEventIds.has(item.assignedToEvent)
          ? { ...item, status: 'available' as const, assignedToEvent: undefined }
          : item,
      )
    : equipment;

  return {
    events: updatedEvents,
    crew: releasedCrew,
    equipment: releasedEquipment,
    transactions,
    news,
    reputationDelta,
  };
}

export function getEventPrimaryDepartment(event: Event): Department {
  const requirements = event.requirements;
  let maxDept: Department = 'audio';
  let maxCount = requirements.audio;

  if (requirements.lighting > maxCount) {
    maxDept = 'lighting';
    maxCount = requirements.lighting;
  }
  if (requirements.video > maxCount) {
    maxDept = 'video';
    maxCount = requirements.video;
  }
  if (requirements.stage > maxCount) {
    maxDept = 'stage';
  }

  return maxDept;
}
