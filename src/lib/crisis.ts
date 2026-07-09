import {
  CrisisPrompt,
  CrisisSeverity,
  CrisisStage,
  CrewMember,
  EquipmentItem,
  Event,
} from '@/types/game';
import { isEventEquipmentReady, isEventFullyStaffed } from './gameData';

interface CrisisContext {
  crew: CrewMember[];
  equipment: EquipmentItem[];
  companyReputation: number;
  companySpecialization?: string;
}

export interface CrisisOutcome {
  promptId: string;
  title: string;
  stage: CrisisStage;
  severity: CrisisSeverity;
  resolution: string;
  satisfactionDelta: number;
  financialDelta: number;
  notes?: string;
}

const SEVERITY_BADGE: Record<CrisisSeverity, { penalty: number }> = {
  low: { penalty: 6 },
  medium: { penalty: 10 },
  high: { penalty: 18 },
};

function buildPrompt(
  event: Event,
  key: string,
  overrides: Omit<CrisisPrompt, 'id' | 'eventId' | 'createdAt'>,
): CrisisPrompt {
  return {
    id: `${event.id}-${key}`,
    eventId: event.id,
    createdAt: new Date(),
    ...overrides,
  };
}

function formatList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  const last = items[items.length - 1];
  return `${items.slice(0, -1).join(', ')} and ${last}`;
}

export function generateCrisisPrompts(
  event: Event,
  context: CrisisContext,
): CrisisPrompt[] {
  const prompts: CrisisPrompt[] = [];
  const assignedCrew = Object.values(event.assignedCrew).flat();
  const assignedEquipmentIds = new Set<string>(
    Object.values(event.assignedEquipment).flat(),
  );
  const assignedEquipment = context.equipment.filter(eq =>
    assignedEquipmentIds.has(eq.id),
  );
  const reputationPressure = context.companyReputation < 45;

  const staffingGaps: string[] = [];
  (['audio', 'lighting', 'video', 'stage'] as const).forEach(dept => {
    const required = event.requirements[dept];
    const filled = event.assignedCrew[dept].length;
    if (filled < required) {
      staffingGaps.push(`${required - filled} ${dept}`);
    }
  });

  if (staffingGaps.length > 0) {
    prompts.push(
      buildPrompt(event, 'staffing-gap', {
        stage: 'planning',
        severity: 'high',
        title: 'Staffing Gap Detected',
        description: `There are unfilled call sheet slots for ${formatList(staffingGaps)}.`,
        impact:
          'Client expects full coverage. Running understaffed risks schedule slips and reputation hits.',
        recommendedActions: ['Assign additional crew', 'Book trusted freelancers'],
        baseSatisfactionPenalty: 20,
        baseFinancialPenalty: 800,
        choices: [
          {
            id: 'book-freelancers',
            label: 'Book local freelancers ($1,000)',
            description:
              'Contract trusted locals to cover the open positions. Adds to payroll but keeps the show on track.',
            cost: 1000,
            transactionCategory: 'payroll',
            satisfactionModifier: 18,
            financialModifier: -800,
            notes: 'Freelancers filled the gap without disrupting the show.',
          },
          {
            id: 'reassign-internally',
            label: 'Reallocate internal crew',
            description:
              'Shuffle assignments and lean on department leads to cover. Some extra strain, but workable.',
            satisfactionModifier: 10,
            financialModifier: -400,
            notes: 'Teams doubled up on duties after extra prep meetings.',
          },
          {
            id: 'run-lean',
            label: 'Run lean and hope for the best',
            description: 'Accept the risk of longer changeovers and potential client penalties.',
            satisfactionModifier: 0,
            notes: 'Short-handed crews struggled to keep up with cues.',
          },
        ],
        resolved: false,
      }),
    );
  }

  const equipmentGaps: string[] = [];
  (['audio', 'lighting', 'video', 'stage'] as const).forEach(dept => {
    const requirements = event.equipmentRequirements[dept] ?? [];
    const required = requirements.reduce((total, req) => total + req.quantity, 0);
    const reserved = event.assignedEquipment[dept].length;
    if (required > 0 && reserved < required) {
      equipmentGaps.push(`${required - reserved} ${dept}`);
    }
  });

  if (equipmentGaps.length > 0) {
    prompts.push(
      buildPrompt(event, 'equipment-gap', {
        stage: 'planning',
        severity: 'high',
        title: 'Equipment Shortfall',
        description: `Required gear allocations are missing for ${formatList(equipmentGaps)}.`,
        impact:
          'Running the show without the full package will lead to penalties, rentals, or damage payouts.',
        recommendedActions: ['Reserve the remaining gear', 'Arrange cross-rentals'],
        baseSatisfactionPenalty: 18,
        baseFinancialPenalty: 1200,
        choices: [
          {
            id: 'rent-backup',
            label: 'Rent replacements ($900)',
            description: 'Secure backup inventory from a partner vendor. Keeps performance standards high.',
            cost: 900,
            transactionCategory: 'operations',
            satisfactionModifier: 16,
            financialModifier: -1200,
            notes: 'Rental partners delivered the missing kit overnight.',
          },
          {
            id: 'borrow-promoter',
            label: 'Borrow from promoter',
            description:
              'Lean on the client for onsite spares. Saves money, but quality may not match rider spec.',
            satisfactionModifier: 8,
            financialModifier: -600,
            notes: 'Borrowed gear covered the basics, though there were compromises.',
          },
          {
            id: 'go-without',
            label: 'Proceed without extras',
            description: 'Accept the reputational and damage risk if the show under-delivers.',
            satisfactionModifier: 0,
            notes: 'Gaps in coverage were obvious to the client.',
          },
        ],
        resolved: false,
      }),
    );
  }

  const fatiguedCrew = assignedCrew.filter(crew => crew.fatigue >= 70);
  if (fatiguedCrew.length > 0) {
    prompts.push(
      buildPrompt(event, 'fatigue-warning', {
        stage: 'planning',
        severity: 'medium',
        title: 'Crew Fatigue Warning',
        description: `${formatList(
          fatiguedCrew.map(crew => crew.name),
        )} ${fatiguedCrew.length === 1 ? 'is' : 'are'} near burnout thresholds.`,
        impact:
          'Tired crew members are more likely to make mistakes and draw overtime. Morale will dip if ignored.',
        recommendedActions: ['Rotate in rested staff', 'Offer rest stipends'],
        baseSatisfactionPenalty: 12,
        choices: [
          {
            id: 'schedule-rest',
            label: 'Schedule an extra rest day ($400)',
            description: 'Reduce load-in pace and add a rest stipend so the team hits showtime refreshed.',
            cost: 400,
            transactionCategory: 'operations',
            satisfactionModifier: 10,
            notes: 'Extra rest kept energy high during the show.',
          },
          {
            id: 'offer-bonus',
            label: 'Offer overtime bonuses ($250)',
            description: 'Pay a premium to keep the crew motivated through the crunch.',
            cost: 250,
            transactionCategory: 'payroll',
            satisfactionModifier: 6,
            notes: 'The bonus bought goodwill, though everyone was still tired.',
          },
          {
            id: 'push-through',
            label: 'Push through without changes',
            description: 'Hope the team powers through even with high fatigue.',
            satisfactionModifier: 0,
            notes: 'Exhaustion led to slower cue execution.',
          },
        ],
        resolved: false,
      }),
    );
  }

  const lowSkillCrew = assignedCrew.filter(crew => crew.skillLevel <= 3);
  if (lowSkillCrew.length > 0) {
    prompts.push(
      buildPrompt(event, 'skill-gap', {
        stage: 'planning',
        severity: 'medium',
        title: 'Experience Gap Identified',
        description: `${formatList(
          lowSkillCrew.map(crew => crew.name),
        )} ${lowSkillCrew.length === 1 ? 'needs' : 'need'} extra support to hit the rider spec.`,
        impact:
          'Inexperienced staff on headline cues can cause client confidence issues during the show.',
        recommendedActions: ['Pair with senior leads', 'Run extra rehearsals'],
        baseSatisfactionPenalty: 8,
        choices: [
          {
            id: 'book-rehearsal',
            label: 'Book a focused rehearsal ($300)',
            description: 'Add rehearsal time to drill the cues and coach the team.',
            cost: 300,
            transactionCategory: 'operations',
            satisfactionModifier: 6,
            notes: 'Extra rehearsal time paid off with tighter execution.',
          },
          {
            id: 'assign-mentor',
            label: 'Pair with senior mentor',
            description: 'Assign a department lead to shadow the less experienced techs.',
            satisfactionModifier: 4,
            notes: 'Mentorship slowed other prep work but kept errors minimal.',
          },
          {
            id: 'accept-risk',
            label: 'Accept the risk',
            description: 'Proceed without additional prep and hope the crew keeps up.',
            satisfactionModifier: 0,
            notes: 'Cue timing slipped in a few spots.',
          },
        ],
        resolved: false,
      }),
    );
  }

  const wornEquipment = assignedEquipment.filter(eq => eq.condition <= 55);
  if (wornEquipment.length > 0) {
    prompts.push(
      buildPrompt(event, 'worn-equipment', {
        stage: 'execution',
        severity: 'medium',
        title: 'Aging Gear Flagged',
        description: `${formatList(
          wornEquipment.map(eq => eq.name),
        )} ${wornEquipment.length === 1 ? 'is' : 'are'} in rough shape.`,
        impact:
          'Failing gear mid-show leads to comped expenses, refunds, and reputation damage.',
        recommendedActions: ['Rent show-ready spares', 'Add onsite QA checks'],
        baseSatisfactionPenalty: 10,
        baseFinancialPenalty: 900,
        choices: [
          {
            id: 'rent-spares',
            label: 'Rent show-ready spares ($750)',
            description: 'Bring in redundancies so a failure never reaches the audience.',
            cost: 750,
            transactionCategory: 'operations',
            satisfactionModifier: 10,
            financialModifier: -900,
            notes: 'Backline backups saved the headliner changeover.',
          },
          {
            id: 'deep-inspection',
            label: 'Schedule deep inspection ($250)',
            description: 'Add time for detailed QC and part swaps before doors.',
            cost: 250,
            transactionCategory: 'maintenance',
            satisfactionModifier: 7,
            financialModifier: -600,
            notes: 'The inspection caught a loose connector before doors opened.',
          },
          {
            id: 'trust-the-rig',
            label: 'Trust the existing rig',
            description: 'Skip additional prep and hope nothing fails during the show.',
            satisfactionModifier: 0,
            notes: 'Gear glitches forced a partial refund.',
          },
        ],
        resolved: false,
      }),
    );
  }

  const totalActiveHours = event.setupHours + event.eventHours + event.teardownHours;
  if (event.travelHours >= 8 || totalActiveHours >= 16) {
    prompts.push(
      buildPrompt(event, 'turnaround-risk', {
        stage: 'execution',
        severity: 'low',
        title: 'Tight Turnaround',
        description:
          'Logistics are compressed with long travel or show hours, leaving little recovery time.',
        impact:
          'Load-in can slip and shorten soundcheck without additional buffers or crew adjustments.',
        recommendedActions: ['Pad the logistics plan', 'Pre-rig what you can'],
        baseSatisfactionPenalty: 6,
        choices: [
          {
            id: 'add-buffer',
            label: 'Add logistics buffer ($300)',
            description: 'Bring in extra hands or trucks to widen the schedule.',
            cost: 300,
            transactionCategory: 'operations',
            satisfactionModifier: 5,
            notes: 'The padded schedule kept the day calm.',
          },
          {
            id: 'brief-team',
            label: 'Brief team on double-duty',
            description: 'Lean on the existing crew to pre-stage gear and turn faster.',
            satisfactionModifier: 2,
            notes: 'Crew hustled and mostly kept on pace.',
          },
          {
            id: 'keep-plan',
            label: 'Stay with original plan',
            description: 'Risk running behind if anything unexpected happens.',
            satisfactionModifier: 0,
            notes: 'Tight timing shaved minutes off soundcheck.',
          },
        ],
        resolved: false,
      }),
    );
  }

  if (prompts.length === 0 && (event.status === 'planned' || event.status === 'in-progress')) {
    // Even well-prepared shows can surface a proactive reminder so players feel the system.
    prompts.push(
      buildPrompt(event, 'spot-check', {
        stage: 'planning',
        severity: 'low',
        title: 'Spot Check Recommended',
        description: 'No major risks detected, but run a final tech checklist to stay sharp.',
        impact: reputationPressure
          ? 'You are rebuilding trust with clients—show your diligence before doors.'
          : 'A quick double-check reinforces good habits and keeps the client confident.',
        recommendedActions: ['Confirm day-of checklists', 'Verify cue sheets with leads'],
        baseSatisfactionPenalty: SEVERITY_BADGE.low.penalty,
        choices: [
          {
            id: 'run-check',
            label: 'Run the full checklist ($150)',
            description: 'Invest a small amount of time and money to keep standards high.',
            cost: 150,
            transactionCategory: 'operations',
            satisfactionModifier: 6,
            notes: 'The extra checklist caught a mislabeled feeder.',
          },
          {
            id: 'confidence',
            label: 'We are ready',
            description: 'Skip the reminder and trust existing prep.',
            satisfactionModifier: 0,
            notes: 'Everything stayed on track, but it was a close call.',
          },
        ],
        resolved: false,
      }),
    );
  }

  // Ensure prompts align with current readiness. If a player resolved the underlying issue, remove leftover prompts.
  const filtered = prompts.filter(prompt => {
    if (prompt.id.endsWith('staffing-gap') && isEventFullyStaffed(event)) {
      return false;
    }
    if (prompt.id.endsWith('equipment-gap') && isEventEquipmentReady(event)) {
      return false;
    }
    return true;
  });

  return filtered;
}

export function mergeExistingCrisisState(
  prompts: CrisisPrompt[],
  existing: CrisisPrompt[],
): CrisisPrompt[] {
  return prompts.map(prompt => {
    const match = existing.find(item => item.id === prompt.id);
    if (!match) return prompt;
    return {
      ...prompt,
      resolved: match.resolved,
      selectedChoiceId: match.selectedChoiceId,
      createdAt: match.createdAt,
    };
  });
}

/**
 * Recomputes the crisis prompts for a single event after something about it
 * changed (crew/equipment assignment, status transition), preserving any
 * resolution the player already locked in.
 */
export function rebuildEventCrises(
  existingCrises: CrisisPrompt[],
  updatedEvent: Event,
  updatedCrew: CrewMember[],
  updatedEquipment: EquipmentItem[],
  companyReputation: number,
  companySpecialization: string,
): CrisisPrompt[] {
  const shouldTrack =
    updatedEvent.status === 'planned' || updatedEvent.status === 'in-progress';

  const remaining = existingCrises.filter(crisis => crisis.eventId !== updatedEvent.id);
  if (!shouldTrack) {
    return remaining;
  }

  const generated = generateCrisisPrompts(updatedEvent, {
    crew: updatedCrew,
    equipment: updatedEquipment,
    companyReputation,
    companySpecialization,
  });

  const merged = mergeExistingCrisisState(
    generated,
    existingCrises.filter(crisis => crisis.eventId === updatedEvent.id),
  );

  return [...remaining, ...merged];
}

/** Same as rebuildEventCrises, but reconciles every planned/in-progress event at once. */
export function rebuildAllPlannedCrises(
  existingCrises: CrisisPrompt[],
  events: Event[],
  crew: CrewMember[],
  equipment: EquipmentItem[],
  companyReputation: number,
  companySpecialization: string,
): CrisisPrompt[] {
  const prompts: CrisisPrompt[] = [];

  events.forEach(event => {
    if (event.status === 'planned' || event.status === 'in-progress') {
      const generated = generateCrisisPrompts(event, {
        crew,
        equipment,
        companyReputation,
        companySpecialization,
      });
      const merged = mergeExistingCrisisState(
        generated,
        existingCrises.filter(crisis => crisis.eventId === event.id),
      );
      prompts.push(...merged);
    }
  });

  return prompts;
}

export function evaluateCrisisOutcomes(
  event: Event,
  prompts: CrisisPrompt[],
): { satisfactionDelta: number; additionalExpenses: number; outcomes: CrisisOutcome[] } {
  let satisfactionDelta = 0;
  let additionalExpenses = 0;
  const outcomes: CrisisOutcome[] = [];

  prompts.forEach(prompt => {
    const basePenalty = -prompt.baseSatisfactionPenalty;
    let satisfactionChange = basePenalty;
    let financialChange = prompt.baseFinancialPenalty ?? 0;
    let resolution = 'Left unresolved';
    let notes = prompt.impact;

    if (prompt.resolved && prompt.selectedChoiceId) {
      const choice = prompt.choices.find(option => option.id === prompt.selectedChoiceId);
      if (choice) {
        resolution = choice.label;
        satisfactionChange =
          -prompt.baseSatisfactionPenalty + (choice.satisfactionModifier ?? 0);
        if (prompt.baseFinancialPenalty) {
          financialChange = prompt.baseFinancialPenalty + (choice.financialModifier ?? 0);
        } else if (choice.financialModifier !== undefined) {
          financialChange = choice.financialModifier;
        } else {
          financialChange = 0;
        }
        if (choice.notes) {
          notes = choice.notes;
        }
      }
    }

    satisfactionDelta += satisfactionChange;
    additionalExpenses += financialChange;

    outcomes.push({
      promptId: prompt.id,
      title: prompt.title,
      stage: prompt.stage,
      severity: prompt.severity,
      resolution,
      satisfactionDelta: satisfactionChange,
      financialDelta: financialChange,
      notes,
    });
  });

  return { satisfactionDelta, additionalExpenses, outcomes };
}
