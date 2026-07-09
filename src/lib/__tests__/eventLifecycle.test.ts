import { describe, expect, it } from 'vitest';
import { generateEvent, applyEventLifecycle, getShowGraceDeadline } from '../gameData';
import type { CrewMember, EquipmentItem, Event } from '@/types/game';

function makeCrew(id: string, assignedTo?: string): CrewMember {
  return {
    id,
    name: `Tech ${id}`,
    department: 'audio',
    skillLevel: 5,
    hourlyRate: 25,
    fatigue: 10,
    morale: 70,
    availableOn: new Date('2026-01-01'),
    assignedTo,
    experience: 0,
    certifications: [],
  };
}

function makeEquipment(id: string, assignedToEvent?: string): EquipmentItem {
  return {
    id,
    name: `Rig ${id}`,
    type: 'pa-system',
    department: 'audio',
    owned: true,
    condition: 90,
    status: assignedToEvent ? 'assigned' : 'available',
    maintenanceDue: new Date('2026-06-01'),
    lastServicedOn: new Date('2025-12-01'),
    assignedToEvent,
  };
}

describe('applyEventLifecycle', () => {
  it('expires an available contract past acceptBy with no active bids', () => {
    const event = generateEvent(new Date('2026-07-20'), 'gig');
    event.status = 'available';
    event.acceptBy = new Date('2026-07-10');
    event.bids = [];

    const currentDate = new Date('2026-07-11');
    const result = applyEventLifecycle([event], [], [], currentDate, 'Sector Pro');

    expect(result.events[0].status).toBe('failed');
    expect(result.events[0].lostReason).toMatch(/unclaimed/i);
    expect(result.news).toHaveLength(1);
    expect(result.news[0].tone).toBe('info');
    expect(result.transactions).toHaveLength(0);
    expect(result.reputationDelta).toBe(0);
  });

  it('leaves an available contract alone before its accept deadline', () => {
    const event = generateEvent(new Date('2026-07-20'), 'gig');
    event.status = 'available';
    event.acceptBy = new Date('2026-07-18');
    event.bids = [];

    const result = applyEventLifecycle([event], [], [], new Date('2026-07-11'), 'Sector Pro');

    expect(result.events[0].status).toBe('available');
    expect(result.news).toHaveLength(0);
  });

  it('leaves an available contract alone while a competitor bid is still active', () => {
    const event = generateEvent(new Date('2026-07-20'), 'gig');
    event.status = 'available';
    event.acceptBy = new Date('2026-07-10');
    event.bids = [
      { competitorId: 'rival-1', amount: 2000, status: 'active', submittedOn: new Date('2026-07-09'), reputationWeight: 0.5 },
    ];

    const result = applyEventLifecycle([event], [], [], new Date('2026-07-11'), 'Sector Pro');

    expect(result.events[0].status).toBe('available');
  });

  it('flips a planned event to in-progress on its show date', () => {
    const event = generateEvent(new Date('2026-07-11'), 'gig');
    event.status = 'planned';

    const result = applyEventLifecycle([event], [], [], new Date('2026-07-11T09:00:00'), 'Sector Pro');

    expect(result.events[0].status).toBe('in-progress');
  });

  it('leaves a planned event alone before its show date', () => {
    const event = generateEvent(new Date('2026-07-20'), 'gig');
    event.status = 'planned';

    const result = applyEventLifecycle([event], [], [], new Date('2026-07-11'), 'Sector Pro');

    expect(result.events[0].status).toBe('planned');
  });

  it('auto-fails an in-progress show past its grace deadline, charges a penalty, and frees crew/gear', () => {
    const event = generateEvent(new Date('2026-07-01'), 'gig');
    event.status = 'in-progress';
    event.clientPay = 3000;

    const graceDeadline = getShowGraceDeadline(event);
    const pastDeadline = new Date(graceDeadline);
    pastDeadline.setDate(pastDeadline.getDate() + 1);

    const crew = [makeCrew('c1', event.id), makeCrew('c2', 'some-other-event')];
    const equipment = [makeEquipment('e1', event.id), makeEquipment('e2', 'some-other-event')];

    const result = applyEventLifecycle([event], crew, equipment, pastDeadline, 'Sector Pro');

    expect(result.events[0].status).toBe('failed');
    expect(result.events[0].lostReason).toMatch(/grace deadline/i);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].amount).toBe(Math.round(3000 * 0.35));
    expect(result.transactions[0].type).toBe('expense');
    expect(result.reputationDelta).toBeLessThan(0);
    expect(result.news.some(item => item.tone === 'warning')).toBe(true);

    // The show's own crew/gear are released; unrelated assignments are untouched.
    expect(result.crew.find(c => c.id === 'c1')?.assignedTo).toBeUndefined();
    expect(result.crew.find(c => c.id === 'c2')?.assignedTo).toBe('some-other-event');
    expect(result.equipment.find(e => e.id === 'e1')?.status).toBe('available');
    expect(result.equipment.find(e => e.id === 'e1')?.assignedToEvent).toBeUndefined();
    expect(result.equipment.find(e => e.id === 'e2')?.assignedToEvent).toBe('some-other-event');
  });

  it('does not touch an in-progress show still inside its grace window', () => {
    const event = generateEvent(new Date('2026-07-11'), 'gig');
    event.status = 'in-progress';

    const result = applyEventLifecycle([event], [], [], new Date('2026-07-11T20:00:00'), 'Sector Pro');

    expect(result.events[0].status).toBe('in-progress');
    expect(result.transactions).toHaveLength(0);
  });

  it('leaves completed and already-failed events untouched', () => {
    const completed = generateEvent(new Date('2026-01-01'), 'gig');
    completed.status = 'completed';
    const failed = generateEvent(new Date('2026-01-01'), 'gig');
    failed.status = 'failed';
    failed.lostReason = 'Already resolved.';

    const result = applyEventLifecycle([completed, failed], [], [], new Date('2026-07-11'), 'Sector Pro');

    expect(result.events[0]).toEqual(completed);
    expect(result.events[1]).toEqual(failed);
  });
});
