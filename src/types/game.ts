export type Department = 'audio' | 'lighting' | 'video' | 'stage';

export type EventType = 'gig' | 'tour' | 'festival';

export type EventStatus = 'available' | 'planned' | 'in-progress' | 'completed' | 'failed';

export type TransactionType = 'income' | 'expense';

export type FinancialCategory =
  | 'contracts'
  | 'payroll'
  | 'operations'
  | 'maintenance'
  | 'misc';

export interface FinancialTransaction {
  id: string;
  date: Date;
  type: TransactionType;
  amount: number;
  description: string;
  category: FinancialCategory;
  eventId?: string;
}

export interface FinancesState {
  transactions: FinancialTransaction[];
  creditLimit: number;
  overdraftDays: number;
}

export interface CrewMember {
  id: string;
  name: string;
  department: Department;
  skillLevel: number; // 1-10
  hourlyRate: number;
  fatigue: number; // 0-100
  morale: number; // 0-100
  availableOn: Date;
  assignedTo?: string; // event ID
  experience: number;
  certifications: string[];
  recentMoraleShift?: {
    id: string;
    date: Date;
    description: string;
    delta: number;
    type: 'positive' | 'negative';
  };
}

export interface Event {
  id: string;
  name: string;
  type: EventType;
  date: Date;
  startHour: number; // 0-23
  status: EventStatus;
  venue: string;
  clientPay: number;
  requirements: {
    audio: number;
    lighting: number;
    video: number;
    stage: number;
  };
  assignedCrew: {
    audio: CrewMember[];
    lighting: CrewMember[];
    video: CrewMember[];
    stage: CrewMember[];
  };
  setupHours: number;
  eventHours: number;
  teardownHours: number;
  travelHours: number;
  clientSatisfaction?: number; // 0-100
}

export interface Company {
  name: string;
  balance: number;
  reputation: number; // 0-100
  level: number;
}

export interface GameState {
  company: Company;
  crew: CrewMember[];
  events: Event[];
  currentDate: Date;
  selectedEvent?: string;
  finances: FinancesState;
  isBankrupt: boolean;
}
