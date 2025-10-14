import { Department, EquipmentItem, EquipmentRequirement, EquipmentType, EventType } from '@/types/game';

interface EquipmentDefinition {
  type: EquipmentType;
  department: Department;
  name: string;
  maintenanceIntervalDays: number;
  wearPerShow: number;
  rentalDailyCost: number;
}

const EQUIPMENT_DEFINITIONS: Record<EquipmentType, EquipmentDefinition> = {
  'pa-system': {
    type: 'pa-system',
    department: 'audio',
    name: 'Line Array PA System',
    maintenanceIntervalDays: 45,
    wearPerShow: 8,
    rentalDailyCost: 650,
  },
  'monitor-rig': {
    type: 'monitor-rig',
    department: 'audio',
    name: 'Monitor World Package',
    maintenanceIntervalDays: 60,
    wearPerShow: 6,
    rentalDailyCost: 420,
  },
  'lighting-rig': {
    type: 'lighting-rig',
    department: 'lighting',
    name: 'Intelligent Lighting Rig',
    maintenanceIntervalDays: 40,
    wearPerShow: 7,
    rentalDailyCost: 550,
  },
  'led-wall': {
    type: 'led-wall',
    department: 'video',
    name: 'Modular LED Wall',
    maintenanceIntervalDays: 35,
    wearPerShow: 9,
    rentalDailyCost: 800,
  },
  'stage-deck': {
    type: 'stage-deck',
    department: 'stage',
    name: 'Portable Deck System',
    maintenanceIntervalDays: 55,
    wearPerShow: 5,
    rentalDailyCost: 300,
  },
  'power-dist': {
    type: 'power-dist',
    department: 'stage',
    name: 'Power Distribution Rack',
    maintenanceIntervalDays: 50,
    wearPerShow: 6,
    rentalDailyCost: 350,
  },
};

const requirementTemplates: Record<EventType, Record<Department, EquipmentRequirement[]>> = {
  gig: {
    audio: [
      {
        id: 'gig-audio-pa',
        type: 'pa-system',
        quantity: 1,
        description: 'Main PA for club-sized venue',
        allowsRental: true,
      },
      {
        id: 'gig-audio-monitors',
        type: 'monitor-rig',
        quantity: 1,
        description: 'Monitor rig for on-stage mixes',
        allowsRental: true,
      },
    ],
    lighting: [
      {
        id: 'gig-lighting-package',
        type: 'lighting-rig',
        quantity: 1,
        description: 'Compact programmable lighting kit',
        allowsRental: true,
      },
    ],
    video: [
      {
        id: 'gig-video-led',
        type: 'led-wall',
        quantity: 1,
        description: 'Small backdrop LED wall',
        allowsRental: true,
      },
    ],
    stage: [
      {
        id: 'gig-stage-deck',
        type: 'stage-deck',
        quantity: 1,
        description: 'Standard deck with risers',
        allowsRental: false,
      },
      {
        id: 'gig-power',
        type: 'power-dist',
        quantity: 1,
        description: 'Single-phase power distro',
        allowsRental: true,
      },
    ],
  },
  tour: {
    audio: [
      {
        id: 'tour-audio-pa',
        type: 'pa-system',
        quantity: 1,
        description: 'Tour-grade PA package',
        allowsRental: false,
      },
      {
        id: 'tour-audio-monitors',
        type: 'monitor-rig',
        quantity: 1,
        description: 'Expanded monitor rig with spares',
        allowsRental: true,
      },
    ],
    lighting: [
      {
        id: 'tour-lighting',
        type: 'lighting-rig',
        quantity: 2,
        description: 'Full rig with movers and atmospherics',
        allowsRental: true,
      },
    ],
    video: [
      {
        id: 'tour-video',
        type: 'led-wall',
        quantity: 1,
        description: 'Large LED wall with media server',
        allowsRental: true,
      },
    ],
    stage: [
      {
        id: 'tour-stage-deck',
        type: 'stage-deck',
        quantity: 2,
        description: 'Touring deck package with risers',
        allowsRental: false,
      },
      {
        id: 'tour-power',
        type: 'power-dist',
        quantity: 1,
        description: 'Three-phase distro with transformers',
        allowsRental: true,
      },
    ],
  },
  festival: {
    audio: [
      {
        id: 'festival-audio-pa',
        type: 'pa-system',
        quantity: 2,
        description: 'Dual main hangs with delay towers',
        allowsRental: true,
      },
      {
        id: 'festival-audio-monitors',
        type: 'monitor-rig',
        quantity: 2,
        description: 'Monitor worlds for multiple stages',
        allowsRental: true,
      },
    ],
    lighting: [
      {
        id: 'festival-lighting',
        type: 'lighting-rig',
        quantity: 3,
        description: 'Arena-scale lighting array',
        allowsRental: true,
      },
    ],
    video: [
      {
        id: 'festival-video-led',
        type: 'led-wall',
        quantity: 2,
        description: 'Main stage LED wall and side screens',
        allowsRental: true,
      },
    ],
    stage: [
      {
        id: 'festival-stage-deck',
        type: 'stage-deck',
        quantity: 3,
        description: 'Multi-stage decking and wings',
        allowsRental: true,
      },
      {
        id: 'festival-power',
        type: 'power-dist',
        quantity: 2,
        description: 'High capacity distro and redundancy',
        allowsRental: true,
      },
    ],
  },
};

function createEquipmentId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function createEquipmentItem(
  type: EquipmentType,
  owned: boolean,
  currentDate: Date,
  overrides: Partial<EquipmentItem> = {}
): EquipmentItem {
  const definition = EQUIPMENT_DEFINITIONS[type];
  const baseCondition = overrides.condition ?? (80 + Math.floor(Math.random() * 15));
  const maintenanceDue = new Date(overrides.maintenanceDue ?? currentDate);
  maintenanceDue.setDate(maintenanceDue.getDate() + definition.maintenanceIntervalDays);

  return {
    id: overrides.id ?? createEquipmentId(type),
    name: overrides.name ?? definition.name,
    type,
    department: definition.department,
    owned,
    condition: Math.min(100, baseCondition),
    status: overrides.status ?? 'available',
    maintenanceDue,
    maintenanceCompleteOn: overrides.maintenanceCompleteOn,
    lastServicedOn: overrides.lastServicedOn ?? new Date(currentDate),
    assignedToEvent: overrides.assignedToEvent,
    rentalInfo: overrides.rentalInfo,
  };
}

export function generateInitialEquipment(currentDate: Date = new Date()): EquipmentItem[] {
  return [
    createEquipmentItem('pa-system', true, currentDate, { condition: 88 }),
    createEquipmentItem('monitor-rig', true, currentDate, { condition: 82 }),
    createEquipmentItem('lighting-rig', true, currentDate, { condition: 85 }),
    createEquipmentItem('lighting-rig', true, currentDate, { condition: 78, name: 'Compact Lighting Kit' }),
    createEquipmentItem('led-wall', true, currentDate, { condition: 80 }),
    createEquipmentItem('stage-deck', true, currentDate, { condition: 90 }),
    createEquipmentItem('power-dist', true, currentDate, { condition: 84 }),
  ];
}

export function getEquipmentDefinition(type: EquipmentType) {
  return EQUIPMENT_DEFINITIONS[type];
}

export function getAllEquipmentTypes(): EquipmentType[] {
  return Object.keys(EQUIPMENT_DEFINITIONS) as EquipmentType[];
}

export function getEquipmentRequirementsForEvent(type: EventType): Record<Department, EquipmentRequirement[]> {
  return requirementTemplates[type];
}

export function calculateMaintenanceCost(equipment: EquipmentItem) {
  const definition = getEquipmentDefinition(equipment.type);
  const wear = 100 - equipment.condition;
  const base = 150 + wear * 8;
  return Math.max(200, Math.round(base + definition.wearPerShow * 10));
}

export function createRentalEquipment(
  type: EquipmentType,
  currentDate: Date,
  rentalDays: number,
  provider = 'Regional Vendor'
): EquipmentItem {
  const definition = getEquipmentDefinition(type);
  const rentalItem = createEquipmentItem(type, false, currentDate, {
    condition: 95,
    rentalInfo: {
      provider,
      dailyCost: definition.rentalDailyCost,
      returnDate: new Date(currentDate),
    },
  });

  if (rentalItem.rentalInfo) {
    rentalItem.rentalInfo.returnDate.setDate(currentDate.getDate() + rentalDays);
  }

  return rentalItem;
}

export function getWearForEvent(type: EventType) {
  switch (type) {
    case 'festival':
      return 18;
    case 'tour':
      return 12;
    default:
      return 8;
  }
}
