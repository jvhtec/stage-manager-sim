import { describe, expect, it } from 'vitest';
import { generateEvent } from '../gameData';
import { generateCrisisPrompts } from '../crisis';
import { createRng } from '../rng';
import type { CrewMember } from '@/types/game';

function understaffedEvent(reputation: number) {
  // Deliberately understaffed (no crew assigned) so the staffing-gap
  // prompt reliably generates regardless of tier.
  return generateEvent(new Date('2026-08-01'), 'gig', createRng(1), reputation);
}

describe('generateCrisisPrompts — venue tier intensity', () => {
  it('scales base penalties up for a higher-tier show than a lower-tier one', () => {
    const lowTierEvent = understaffedEvent(10); // tier 1
    const highTierEvent = understaffedEvent(90); // tier 4
    expect(lowTierEvent.venueTier).toBe(1);
    expect(highTierEvent.venueTier).toBe(4);

    const context = { crew: [] as CrewMember[], equipment: [], companyReputation: 50 };
    const lowTierPrompts = generateCrisisPrompts(lowTierEvent, context);
    const highTierPrompts = generateCrisisPrompts(highTierEvent, context);

    const lowStaffingGap = lowTierPrompts.find(p => p.id.endsWith('staffing-gap'));
    const highStaffingGap = highTierPrompts.find(p => p.id.endsWith('staffing-gap'));
    expect(lowStaffingGap).toBeDefined();
    expect(highStaffingGap).toBeDefined();
    expect(highStaffingGap!.baseSatisfactionPenalty).toBeGreaterThan(
      lowStaffingGap!.baseSatisfactionPenalty,
    );
    expect(highStaffingGap!.baseFinancialPenalty!).toBeGreaterThan(
      lowStaffingGap!.baseFinancialPenalty!,
    );
  });

  it('does not rescale if the company reputation later changes — tier is fixed at booking', () => {
    const event = understaffedEvent(90); // booked at tier 4
    const context = { crew: [] as CrewMember[], equipment: [], companyReputation: 5 }; // reputation cratered since
    const prompts = generateCrisisPrompts(event, context);
    const staffingGap = prompts.find(p => p.id.endsWith('staffing-gap'));

    // Still scaled per the event's own venueTier (4), not the current (low) reputation.
    expect(event.venueTier).toBe(4);
    expect(staffingGap!.baseSatisfactionPenalty).toBeGreaterThan(20); // base is 20 before scaling
  });
});
