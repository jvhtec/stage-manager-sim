import { Company } from '@/types/game';
import type { ExperienceGainResult } from '@/lib/crewProgression';
import type { CrisisOutcome } from '@/lib/crisis';

/** Generic outcome shape for actions that can be rejected with a reason. */
export interface ActionResult {
  success: boolean;
  reason?: string;
}

export type CompanyIdentityInput = Pick<
  Company,
  'name' | 'brandColor' | 'accentColor' | 'specialization'
> & {
  tagline?: string;
};

export interface EventCompletionSummary {
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
