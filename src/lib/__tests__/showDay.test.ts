import { describe, expect, it } from 'vitest';
import {
  calculatePreparationScore,
  getBaseSatisfactionFromPreparation,
  getPhaseForCrisisPrompt,
} from '../showDay';
import { generateEvent } from '../gameData';
import type { CrewMember, EquipmentItem } from '@/types/game';

function makeCrew(overrides: Partial<CrewMember> = {}): CrewMember {
  return {
    id: overrides.id ?? 'crew-1',
    name: 'Test Tech',
    department: 'audio',
    skillLevel: 5,
    hourlyRate: 25,
    fatigue: 20,
    morale: 70,
    availableOn: new Date('2026-01-01'),
    experience: 0,
    certifications: [],
    ...overrides,
  };
}

function makeEquipment(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: overrides.id ?? 'eq-1',
    name: 'Rig',
    type: 'pa-system',
    department: 'audio',
    owned: true,
    condition: 85,
    status: 'assigned',
    maintenanceDue: new Date('2026-06-01'),
    lastServicedOn: new Date('2025-12-01'),
    ...overrides,
  };
}

describe('getPhaseForCrisisPrompt', () => {
  it('maps worn-equipment prompts to load-in', () => {
    expect(getPhaseForCrisisPrompt('event-123-worn-equipment')).toBe('load-in');
  });

  it('maps turnaround-risk prompts to teardown', () => {
    expect(getPhaseForCrisisPrompt('event-123-turnaround-risk')).toBe('teardown');
  });

  it('defaults unmapped execution prompts to showtime', () => {
    expect(getPhaseForCrisisPrompt('event-123-some-future-crisis')).toBe('showtime');
  });
});

describe('calculatePreparationScore', () => {
  it('scores a well-rested, high-skill, well-maintained crew highly', () => {
    const event = generateEvent(new Date('2026-08-01'), 'gig');
    const crew = makeCrew({ skillLevel: 9, fatigue: 5 });
    event.assignedCrew.audio = [crew];
    event.assignedEquipment.audio = ['eq-1'];
    const equipment = [makeEquipment({ condition: 95 })];

    const score = calculatePreparationScore(event, [crew], equipment);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('scores a tired, low-skill crew on worn gear poorly', () => {
    const event = generateEvent(new Date('2026-08-01'), 'gig');
    const crew = makeCrew({ skillLevel: 1, fatigue: 90 });
    event.assignedCrew.audio = [crew];
    event.assignedEquipment.audio = ['eq-1'];
    const equipment = [makeEquipment({ condition: 20 })];

    const score = calculatePreparationScore(event, [crew], equipment);
    expect(score).toBeLessThanOrEqual(30);
  });

  it('falls back to defaults when nobody is assigned (no crew, no gear)', () => {
    const event = generateEvent(new Date('2026-08-01'), 'gig');
    const score = calculatePreparationScore(event, [], []);
    // skillComponent=0 (no crew), restComponent=100 (avgFatigue defaults to 0),
    // conditionComponent=100 (no gear defaults neutral-good): 0*.45 + 100*.25 + 100*.3
    expect(score).toBe(55);
  });
});

describe('getBaseSatisfactionFromPreparation', () => {
  it('is monotonic in preparation score', () => {
    expect(getBaseSatisfactionFromPreparation(0)).toBe(45);
    expect(getBaseSatisfactionFromPreparation(50)).toBe(68);
    expect(getBaseSatisfactionFromPreparation(100)).toBe(90);
  });
});
