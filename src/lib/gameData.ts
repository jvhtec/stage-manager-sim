import { CrewMember, Event, Company, Department } from '@/types/game';

const firstNames = ['Alex', 'Jordan', 'Sam', 'Riley', 'Casey', 'Morgan', 'Taylor', 'Jamie', 'Chris', 'Avery'];
const lastNames = ['Chen', 'Smith', 'Johnson', 'Martinez', 'Brown', 'Davis', 'Wilson', 'Moore', 'Taylor', 'Anderson'];

export function generateCrewMember(department: Department, skillLevel: number = 5): CrewMember {
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  return {
    id: `crew-${Date.now()}-${Math.random()}`,
    name: `${firstName} ${lastName}`,
    department,
    skillLevel,
    hourlyRate: 20 + (skillLevel * 5),
    fatigue: Math.floor(Math.random() * 30),
    morale: 70 + Math.floor(Math.random() * 30),
    availableOn: new Date(),
  };
}

export function generateInitialCrew(): CrewMember[] {
  return [
    generateCrewMember('audio', 6),
    generateCrewMember('audio', 4),
    generateCrewMember('lighting', 5),
    generateCrewMember('lighting', 4),
    generateCrewMember('video', 5),
    generateCrewMember('stage', 6),
    generateCrewMember('stage', 5),
  ];
}

export function generateEvent(date: Date, type: 'gig' | 'tour' | 'festival' = 'gig'): Event {
  const venues = ['The Warehouse', 'City Arena', 'Blue Moon Club', 'Metro Theater', 'Riverside Hall', 'Central Auditorium'];
  const eventNames = ['Rock Night', 'Jazz Evening', 'EDM Festival', 'Corporate Event', 'Comedy Show', 'Music Awards'];

  const startHour = type === 'festival'
    ? 12 + Math.floor(Math.random() * 4) // Midday start for festivals
    : type === 'tour'
      ? 16 + Math.floor(Math.random() * 3) // Late afternoon/evening for tours
      : 18 + Math.floor(Math.random() * 3); // Evening club gigs

  const travelHours = type === 'festival'
    ? 10 + Math.floor(Math.random() * 4)
    : type === 'tour'
      ? 6 + Math.floor(Math.random() * 4)
      : 3 + Math.floor(Math.random() * 3);
  
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
  
  return {
    id: `event-${Date.now()}-${Math.random()}`,
    name: eventNames[Math.floor(Math.random() * eventNames.length)],
    type,
    date,
    startHour,
    status: 'available',
    venue: venues[Math.floor(Math.random() * venues.length)],
    clientPay: basePay[type] + Math.floor(Math.random() * 1000),
    requirements: baseRequirements[type],
    assignedCrew: {
      audio: [],
      lighting: [],
      video: [],
      stage: [],
    },
    setupHours: type === 'festival' ? 8 : type === 'tour' ? 4 : 2,
    eventHours: type === 'festival' ? 12 : type === 'tour' ? 6 : 4,
    teardownHours: type === 'festival' ? 6 : type === 'tour' ? 3 : 2,
    travelHours,
  };
}

export function createInitialCompany(): Company {
  return {
    name: 'Sector Pro Productions',
    balance: 15000,
    reputation: 50,
    level: 1,
  };
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
