import { Company, CompetitorCompany, MarketNewsItem } from '@/types/game';
import type { Department } from '@/types/game';

interface CompetitorTemplate {
  name: string;
  palette: string[];
  specialties: Department[];
  reputation: number;
  reliability: number;
  rateModifier: number;
  notes: string[];
}

const competitorTemplates: CompetitorTemplate[] = [
  {
    name: 'Pulsewave Collective',
    palette: ['#f97316', '#fb923c'],
    specialties: ['audio'],
    reputation: 62,
    reliability: 78,
    rateModifier: 1.08,
    notes: [
      'Preferred vendor for regional radio showcases.',
      'Engineers swap mix templates with touring FOH crews.',
    ],
  },
  {
    name: 'LumenLyric Studios',
    palette: ['#facc15', '#fde047'],
    specialties: ['lighting'],
    reputation: 58,
    reliability: 84,
    rateModifier: 1.02,
    notes: [
      'Signature filament looks for televised award shows.',
      'Crew rumored to overcommit during festival season.',
    ],
  },
  {
    name: 'FrameForge Visuals',
    palette: ['#38bdf8', '#0ea5e9'],
    specialties: ['video'],
    reputation: 65,
    reliability: 72,
    rateModifier: 1.11,
    notes: [
      'Invested early in HDR-compatible IMAG packages.',
      'Maintains a trusted bench of freelance shader techs.',
    ],
  },
  {
    name: 'Deck & Drape Cooperative',
    palette: ['#14b8a6', '#5eead4'],
    specialties: ['stage'],
    reputation: 55,
    reliability: 88,
    rateModifier: 0.96,
    notes: [
      'Unmatched turnaround on quick-change scenic builds.',
      'Union relationships keep morale high even on doubles.',
    ],
  },
  {
    name: 'Northstar Tour Systems',
    palette: ['#ef4444', '#f87171'],
    specialties: ['audio', 'lighting', 'video', 'stage'],
    reputation: 70,
    reliability: 76,
    rateModifier: 1.04,
    notes: [
      'Full-service rival prized for bundled tour packages.',
      'Loses margin on boutique gigs but wins via reputation.',
    ],
  },
];

function selectTemplates(count: number): CompetitorTemplate[] {
  const pool = [...competitorTemplates];
  const selected: CompetitorTemplate[] = [];
  while (selected.length < count && pool.length > 0) {
    const index = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }
  return selected;
}

function describeSpecialties(specialties: Department[]): string {
  if (specialties.length === 4) {
    return 'full-service production packages';
  }
  if (specialties.length === 1) {
    return `${specialties[0]}-first shows`;
  }
  if (specialties.length === 2) {
    return `${specialties[0]} and ${specialties[1]} collaborations`;
  }
  return `${specialties.length} department lineups`;
}

export function generateInitialCompetitors(playerCompany: Company, count = 4): CompetitorCompany[] {
  const templates = selectTemplates(count);
  return templates.map((template, idx) => ({
    id: `competitor-${Date.now()}-${idx}-${Math.random().toString(16).slice(2)}`,
    name: template.name,
    brandColor: template.palette[0] ?? '#52525b',
    specialties: template.specialties,
    reputation: template.reputation,
    reliability: template.reliability,
    baseRateModifier: template.rateModifier,
    activeBids: [],
    scheduledEvents: [],
    scoutingNotes: [
      ...template.notes,
      `${template.name} is watching ${describeSpecialties(template.specialties)} this quarter.`,
      `${template.name} keeps a close eye on ${playerCompany.name}'s moves.`,
    ],
  }));
}

export function createInitialMarketNews(
  competitors: CompetitorCompany[],
  playerCompany: Company,
  currentDate: Date,
): MarketNewsItem[] {
  const timestamp = currentDate.getTime();
  const competitorStories = competitors.map((competitor, index) => ({
    id: `market-${timestamp}-${index}`,
    date: new Date(currentDate),
    title: `${competitor.name} scouts new contracts`,
    summary: `${competitor.name} is targeting ${describeSpecialties(competitor.specialties)} to start the season.`,
    tone: 'info' as const,
    companyId: competitor.id,
  }));

  const playerStory: MarketNewsItem = {
    id: `market-${timestamp}-player`,
    date: new Date(currentDate),
    title: `${playerCompany.name} prepares to launch`,
    summary: `${playerCompany.name} is assembling crews ahead of their ${playerCompany.specialization} focus.`,
    tone: 'positive',
  };

  return [playerStory, ...competitorStories];
}
