export type Department = 'audio' | 'lighting' | 'video' | 'stage';

export type EventType = 'gig' | 'tour' | 'festival';

export type EventStatus = 'available' | 'planned' | 'in-progress' | 'completed' | 'failed';

export type EventBidStatus = 'active' | 'won' | 'lost';

export type TransactionType = 'income' | 'expense';

export type CrisisStage = 'planning' | 'execution';

export type CrisisSeverity = 'low' | 'medium' | 'high';

export type EquipmentType =
  | 'pa-system'
  | 'monitor-rig'
  | 'lighting-rig'
  | 'led-wall'
  | 'stage-deck'
  | 'power-dist';

export type EquipmentStatus = 'available' | 'assigned' | 'maintenance';

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
  /** Outstanding principal on the bank loan lever (0 = no active loan). */
  loanBalance: number;
}

export interface EquipmentRequirement {
  id: string;
  type: EquipmentType;
  quantity: number;
  description: string;
  allowsRental: boolean;
}

export interface EquipmentItem {
  id: string;
  name: string;
  type: EquipmentType;
  department: Department;
  owned: boolean;
  condition: number; // 0-100
  status: EquipmentStatus;
  maintenanceDue: Date;
  maintenanceCompleteOn?: Date;
  lastServicedOn: Date;
  assignedToEvent?: string;
  rentalInfo?: {
    provider: string;
    returnDate: Date;
    dailyCost: number;
  };
}

export interface CrewCandidate {
  id: string;
  name: string;
  department: Department;
  skillLevel: number; // 1-10
  askingRate: number;
  signingBonus: number;
  experience: number;
  certifications: string[];
  /** One negotiation attempt is allowed per candidate before the pool rotates. */
  negotiated: boolean;
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

export interface CrisisChoice {
  id: string;
  label: string;
  description: string;
  cost?: number;
  transactionCategory?: FinancialCategory;
  satisfactionModifier?: number;
  financialModifier?: number;
  notes?: string;
}

export interface CrisisPrompt {
  id: string;
  eventId: string;
  stage: CrisisStage;
  severity: CrisisSeverity;
  title: string;
  description: string;
  impact: string;
  recommendedActions: string[];
  baseSatisfactionPenalty: number;
  baseFinancialPenalty?: number;
  choices: CrisisChoice[];
  resolved: boolean;
  selectedChoiceId?: string;
  createdAt: Date;
}

export interface PostEventEquipmentReport {
  equipmentId: string;
  name: string;
  conditionBefore: number;
  conditionAfter: number;
}

export interface EventBid {
  competitorId: string;
  amount: number;
  status: EventBidStatus;
  submittedOn: Date;
  reputationWeight: number;
}

export interface EventPostReport {
  completedOn: Date;
  satisfaction: number;
  financial: {
    income: number;
    expense: number;
    net: number;
    balanceAfter: number;
  };
  equipment: PostEventEquipmentReport[];
}

export interface Event {
  id: string;
  name: string;
  type: EventType;
  date: Date;
  /** Reputation tier (1-4) this contract was booked at — fixed at generation, drives pay/requirements/crisis stakes. */
  venueTier: number;
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
  equipmentRequirements: Record<Department, EquipmentRequirement[]>;
  assignedCrew: {
    audio: CrewMember[];
    lighting: CrewMember[];
    video: CrewMember[];
    stage: CrewMember[];
  };
  assignedEquipment: Record<Department, string[]>;
  setupHours: number;
  eventHours: number;
  teardownHours: number;
  travelHours: number;
  clientSatisfaction?: number; // 0-100
  postEventReport?: EventPostReport;
  bids: EventBid[];
  acceptBy: Date;
  lostToCompetitorId?: string;
  lostReason?: string;
}

export type MarketNewsTone = 'info' | 'positive' | 'warning';

export interface MarketNewsItem {
  id: string;
  date: Date;
  title: string;
  summary: string;
  tone: MarketNewsTone;
  companyId?: string;
  eventId?: string;
}

export interface CompetitorScheduledEvent {
  eventId: string;
  status: 'pending' | 'booked' | 'completed';
  payout: number;
  scheduledOn: Date;
  eventDate: Date;
}

export interface CompetitorCompany {
  id: string;
  name: string;
  brandColor: string;
  specialties: Department[];
  reputation: number; // 0-100
  reliability: number; // influences cancellation odds
  baseRateModifier: number; // percentage applied to contract bids
  activeBids: string[];
  scheduledEvents: CompetitorScheduledEvent[];
  scoutingNotes: string[];
  balance: number;
}

export interface ReputationSnapshot {
  date: Date;
  playerReputation: number;
  competitorAverage: number;
  leaderId?: string;
  leaderName?: string;
  leaderReputation?: number;
}

export interface Company {
  name: string;
  balance: number;
  reputation: number; // 0-100
  level: number;
  brandColor: string;
  accentColor: string;
  specialization: 'audio' | 'lighting' | 'video' | 'stage' | 'balanced';
  tagline?: string;
}

export interface GameState {
  company: Company;
  crew: CrewMember[];
  /** Weekly-rotating pool of hireable candidates — the hiring market (Phase 2). */
  crewCandidates: CrewCandidate[];
  equipment: EquipmentItem[];
  events: Event[];
  currentDate: Date;
  selectedEvent?: string;
  finances: FinancesState;
  isBankrupt: boolean;
  crises: CrisisPrompt[];
  competitors: CompetitorCompany[];
  marketNews: MarketNewsItem[];
  reputationHistory: ReputationSnapshot[];
  hasCompletedOnboarding: boolean;
  /** Current state of the seeded PRNG driving contract/crew/competitor rolls. */
  rngState: number;
  /** Total in-game days elapsed since founding; drives weekly payroll/monthly rent cadence. */
  daysElapsed: number;
  /** Consecutive days isBankrupt has been true; resets to 0 the moment it isn't. */
  bankruptStreak: number;
  isGameOver: boolean;
  runSummary?: RunSummary;
}

export interface RunSummary {
  endedOn: Date;
  reason: string;
  daysSurvived: number;
  showsCompleted: number;
  peakBalance: number;
  peakReputation: number;
  finalBalance: number;
}
