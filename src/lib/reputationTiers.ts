import { Company, Department } from '@/types/game';

export interface ReputationTier {
  level: number;
  label: string;
  minReputation: number;
  venues: string[];
  payMultiplier: number;
  /** Extra crew required per department at this tier, on top of the base gig requirement. */
  requirementBonus: Partial<Record<Department, number>>;
  /** Scales crisis satisfaction/financial penalties for shows booked at this tier. */
  crisisIntensityMultiplier: number;
}

// Reputation starts at 50 (see createInitialCompany) and runs 0-100, so
// these bands put a fresh company solidly in tier 2 — real room to grow
// into arenas, and real room to slide back to bar gigs if a run goes badly.
// Tiers 1-2 deliberately keep the original baseline requirements (2/1/1/2
// for a gig) so a fresh company's very first contracts are never harder to
// staff than the starting 7-person roster supports.
export const REPUTATION_TIERS: ReputationTier[] = [
  {
    level: 1,
    label: 'Local Circuit',
    minReputation: 0,
    venues: ['The Dive Bar', 'Corner Pub', 'Riverside Hall', 'Community Center'],
    payMultiplier: 0.75,
    requirementBonus: {},
    crisisIntensityMultiplier: 0.85,
  },
  {
    level: 2,
    label: 'Regional Touring',
    minReputation: 35,
    venues: ['Blue Moon Club', 'Metro Theater', 'The Warehouse', 'Central Auditorium'],
    payMultiplier: 1,
    requirementBonus: {},
    crisisIntensityMultiplier: 1,
  },
  {
    level: 3,
    label: 'National Headliner',
    minReputation: 60,
    venues: ['City Arena', 'Grand Pavilion', 'Harborview Amphitheater', 'The Coliseum'],
    payMultiplier: 1.6,
    requirementBonus: { audio: 1, stage: 1 },
    crisisIntensityMultiplier: 1.2,
  },
  {
    level: 4,
    label: 'World Class',
    minReputation: 85,
    venues: ['Skydome Stadium', 'The Grand Arena', 'Imperial Convention Hall'],
    payMultiplier: 2.4,
    requirementBonus: { audio: 2, lighting: 1, video: 1, stage: 2 },
    crisisIntensityMultiplier: 1.45,
  },
];

export function getReputationTier(reputation: number): ReputationTier {
  const sorted = [...REPUTATION_TIERS].sort((a, b) => b.minReputation - a.minReputation);
  return sorted.find(tier => reputation >= tier.minReputation) ?? REPUTATION_TIERS[0];
}

export function getCompanyLevel(reputation: number): number {
  return getReputationTier(reputation).level;
}

/** Recomputes Company.level from its current reputation — call after any reputation change. */
export function syncCompanyLevel(company: Company): Company {
  const level = getCompanyLevel(company.reputation);
  return company.level === level ? company : { ...company, level };
}

export interface TierProgress {
  current: ReputationTier;
  next?: ReputationTier;
  repToNext?: number;
}

export function getTierProgress(reputation: number): TierProgress {
  const current = getReputationTier(reputation);
  const next = REPUTATION_TIERS.find(tier => tier.level === current.level + 1);
  return {
    current,
    next,
    repToNext: next ? Math.max(0, next.minReputation - reputation) : undefined,
  };
}

/** Crisis stakes are fixed to the tier the show was booked at, not the company's current reputation. */
export function getCrisisIntensityMultiplierForTier(tierLevel: number): number {
  const tier = REPUTATION_TIERS.find(t => t.level === tierLevel);
  return tier?.crisisIntensityMultiplier ?? 1;
}
