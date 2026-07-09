import {
  Company,
  CompetitorCompany,
  CompetitorScheduledEvent,
  MarketNewsItem,
  Event,
  EventBid,
} from '@/types/game';
import type { Department } from '@/types/game';
import { getEventPrimaryDepartment } from './gameData';
import type { Rng } from './rng';

interface BiddingSimulationContext {
  events: Event[];
  competitors: CompetitorCompany[];
  currentDate: Date;
  playerCompany: Company;
  rng: Rng;
}

interface BiddingSimulationResult {
  events: Event[];
  competitors: CompetitorCompany[];
  news: MarketNewsItem[];
}

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

function selectTemplates(count: number, rng: Rng): CompetitorTemplate[] {
  const pool = [...competitorTemplates];
  const selected: CompetitorTemplate[] = [];
  while (selected.length < count && pool.length > 0) {
    const index = rng.nextInt(pool.length);
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

export function generateInitialCompetitors(
  playerCompany: Company,
  rng: Rng,
  count = 4,
): CompetitorCompany[] {
  const templates = selectTemplates(count, rng);
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
    balance: 25000 + rng.nextInt(5000),
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

function calculateBidQuote(event: Event, competitor: CompetitorCompany, rng: Rng): number {
  const variance = 0.92 + rng.next() * 0.16; // 0.92 - 1.08
  const quote = event.clientPay * competitor.baseRateModifier * variance;
  return Math.round(quote);
}

function getActiveBids(event: Event): EventBid[] {
  return event.bids.filter(bid => bid.status === 'active');
}

function updateBidStatus(event: Event, competitorId: string, status: EventBid['status']): Event {
  return {
    ...event,
    bids: event.bids.map(bid =>
      bid.competitorId === competitorId
        ? { ...bid, status, submittedOn: new Date() }
        : bid,
    ),
  };
}

function removeBidFromCompetitor(
  competitor: CompetitorCompany,
  eventId: string,
): CompetitorCompany {
  if (!competitor.activeBids.includes(eventId)) {
    return competitor;
  }
  return {
    ...competitor,
    activeBids: competitor.activeBids.filter(id => id !== eventId),
  };
}

function shouldBidOnEvent(
  event: Event,
  competitor: CompetitorCompany,
  currentDate: Date,
): boolean {
  const primaryDepartment = getEventPrimaryDepartment(event);
  const matchBonus = competitor.specialties.includes(primaryDepartment) ? 0.6 : 0.3;
  const reputationFactor = competitor.reputation / 120; // 0 - ~0.83
  const workloadPenalty = Math.max(0, competitor.activeBids.length - 1) * 0.25;

  const upcomingConflicts = competitor.scheduledEvents.filter(booking => {
    if (booking.status === 'completed') return false;
    const diff = Math.abs(
      Math.floor(
        (booking.eventDate.getTime() - event.date.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
    return diff <= 2;
  }).length;

  const availabilityPenalty = upcomingConflicts * 0.35;
  const bidWindowDays = Math.max(
    1,
    Math.floor((event.acceptBy.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const urgencyBonus = bidWindowDays <= 2 ? 0.5 : 0.2;

  const desirability = matchBonus + reputationFactor + urgencyBonus - workloadPenalty - availabilityPenalty;

  if (competitor.balance < event.clientPay * 0.25) {
    return false;
  }

  return desirability >= 0.4;
}

function scoreBid(bid: EventBid): number {
  return bid.amount * (1 + bid.reputationWeight * 0.35);
}

function resolveBids(
  event: Event,
  competitors: CompetitorCompany[],
  currentDate: Date,
): {
  event: Event;
  competitors: CompetitorCompany[];
  news?: MarketNewsItem;
} {
  const activeBids = getActiveBids(event);
  if (activeBids.length === 0) {
    return { event, competitors };
  }

  const competitorMap = new Map(competitors.map(comp => [comp.id, comp]));
  const scoredBids = activeBids.map(bid => ({
    bid,
    score: scoreBid(bid),
    competitor: competitorMap.get(bid.competitorId),
  }));

  const sorted = scoredBids
    .filter(entry => entry.competitor)
    .sort((a, b) => b.score - a.score);

  if (sorted.length === 0) {
    return { event, competitors };
  }

  const winner = sorted[0];
  const winnerCompany = winner.competitor!;

  const updatedEvent: Event = {
    ...event,
    status: 'failed',
    lostToCompetitorId: winnerCompany.id,
    lostReason: `${winnerCompany.name} secured the contract.`,
    bids: event.bids.map(bid => ({
      ...bid,
      status: bid.competitorId === winnerCompany.id ? 'won' : 'lost',
    })),
  };

  const updatedCompetitors = competitors.map(comp => {
    if (comp.id === winnerCompany.id) {
      const reputationBoost = Math.max(1, Math.round(event.clientPay / 12000));
      const reliabilityBump = comp.reliability >= 92 ? 0 : 1;
      return {
        ...comp,
        activeBids: comp.activeBids.filter(id => id !== event.id),
        scheduledEvents: [
          ...comp.scheduledEvents,
          {
            eventId: event.id,
            status: 'booked',
            payout: event.clientPay,
            scheduledOn: new Date(currentDate),
            eventDate: new Date(event.date),
          },
        ],
        balance: comp.balance + Math.round(event.clientPay * 0.1),
        reputation: Math.min(100, comp.reputation + reputationBoost),
        reliability: Math.min(100, comp.reliability + reliabilityBump),
        scoutingNotes: [
          `${comp.name} secured ${event.name} ahead of rivals.`,
          ...comp.scoutingNotes,
        ].slice(0, 6),
      } satisfies CompetitorCompany;
    }
    if (!comp.activeBids.includes(event.id)) {
      return comp;
    }

    const reputationPenalty = comp.reputation > 35 ? 1 : 0;
    return {
      ...removeBidFromCompetitor(comp, event.id),
      reputation: Math.max(10, comp.reputation - reputationPenalty),
      scoutingNotes: [`${comp.name} lost the ${event.name} bid.`, ...comp.scoutingNotes].slice(0, 6),
    } satisfies CompetitorCompany;
  });

  const newsItem: MarketNewsItem = {
    id: `market-${currentDate.getTime()}-${event.id}`,
    date: new Date(currentDate),
    title: `${winnerCompany.name} wins ${event.name}`,
    summary: `${winnerCompany.name} outbid rivals for ${event.venue}. Contract value $${event.clientPay.toLocaleString()}.`,
    tone: 'warning',
    companyId: winnerCompany.id,
    eventId: event.id,
  };

  return { event: updatedEvent, competitors: updatedCompetitors, news: newsItem };
}

export function simulateCompetitorBidding({
  events,
  competitors,
  currentDate,
  playerCompany,
  rng,
}: BiddingSimulationContext): BiddingSimulationResult {
  const workingEvents = events.map(event => ({ ...event }));
  let workingCompetitors = competitors.map(competitor => ({ ...competitor }));
  const newsItems: MarketNewsItem[] = [];

  workingEvents.forEach((event, index) => {
    if (event.status !== 'available') {
      return;
    }

    const bidWindowMs = event.acceptBy.getTime() - currentDate.getTime();

    workingCompetitors = workingCompetitors.map(competitor => {
      const alreadyBidding = competitor.activeBids.includes(event.id);
      if (shouldBidOnEvent(event, competitor, currentDate)) {
        if (alreadyBidding) {
          return competitor;
        }
        if (competitor.activeBids.length >= 4) {
          return competitor;
        }

        const quote = calculateBidQuote(event, competitor, rng);
        const reputationWeight = Math.max(0.1, competitor.reputation / 100);
        const bid: EventBid = {
          competitorId: competitor.id,
          amount: quote,
          status: 'active',
          submittedOn: new Date(currentDate),
          reputationWeight,
        };

        workingEvents[index] = {
          ...workingEvents[index],
          bids: [...workingEvents[index].bids, bid],
        };

        return {
          ...competitor,
          activeBids: [...competitor.activeBids, event.id],
          scoutingNotes: competitor.scoutingNotes.slice(0, 6),
        } satisfies CompetitorCompany;
      }

      if (alreadyBidding && bidWindowMs > 0) {
        const withdrawalChance = rng.next();
        if (withdrawalChance > 0.7) {
          workingEvents[index] = updateBidStatus(workingEvents[index], competitor.id, 'lost');
          return removeBidFromCompetitor(competitor, event.id);
        }
      }

      return competitor;
    });

    const shouldResolve =
      bidWindowMs <= 0 ||
      currentDate.getTime() > event.date.getTime() - 1000 * 60 * 60 * 24 * 2;

    if (shouldResolve) {
      const { event: resolvedEvent, competitors: resolvedCompetitors, news } = resolveBids(
        workingEvents[index],
        workingCompetitors,
        currentDate,
      );
      workingEvents[index] = resolvedEvent;
      workingCompetitors = resolvedCompetitors;
      if (news) {
        newsItems.push(news);
      }
    }
  });

  if (playerCompany.specialization === 'balanced' && newsItems.length > 0) {
    newsItems.push({
      id: `market-${currentDate.getTime()}-player-context`,
      date: new Date(currentDate),
      title: `${playerCompany.name} evaluates rival bids`,
      summary: `${playerCompany.name} tracks ${newsItems.length} contested opportunities this week.`,
      tone: 'info',
    });
  }

  return {
    events: workingEvents,
    competitors: workingCompetitors,
    news: newsItems,
  };
}

export function progressCompetitorSchedules(
  competitors: CompetitorCompany[],
  currentDate: Date,
  rng: Rng,
): { competitors: CompetitorCompany[]; news: MarketNewsItem[] } {
  const newsItems: MarketNewsItem[] = [];

  const updatedCompetitors = competitors.map(competitor => {
    let reputation = competitor.reputation;
    let reliability = competitor.reliability;
    let balance = competitor.balance;
    let notes = competitor.scoutingNotes;

    const updatedSchedule = competitor.scheduledEvents.map(event => {
      if (event.status !== 'booked') {
        return event;
      }

      if (event.eventDate.getTime() > currentDate.getTime()) {
        return event;
      }

      const failureChance = Math.max(0.08, (100 - competitor.reliability) / 110);
      const didFail = rng.chance(failureChance);

      if (didFail) {
        const reputationLoss = 2 + Math.max(1, Math.round(event.payout / 15000));
        const penalty = Math.round(event.payout * 0.2);
        reputation = Math.max(5, reputation - reputationLoss);
        reliability = Math.max(50, reliability - 2);
        balance = Math.max(0, balance - penalty);
        notes = [`Contract fallout rumored for ${competitor.name}.`, ...notes].slice(0, 6);
        newsItems.push({
          id: `market-${currentDate.getTime()}-${event.eventId}-setback`,
          date: new Date(currentDate),
          title: `${competitor.name} stumbles on booked show`,
          summary: `${competitor.name} reportedly faced issues on a $${event.payout.toLocaleString()} engagement. Market confidence dips.`,
          tone: 'warning',
          companyId: competitor.id,
          eventId: event.eventId,
        });
      } else {
        const payout = Math.round(event.payout * 0.65);
        const reputationGain = 1 + Math.max(1, Math.round(event.payout / 20000));
        reputation = Math.min(100, reputation + reputationGain);
        reliability = Math.min(96, reliability + 1);
        balance += payout;
        notes = [`${competitor.name} delivered a clean show this week.`, ...notes].slice(0, 6);
        newsItems.push({
          id: `market-${currentDate.getTime()}-${event.eventId}-win`,
          date: new Date(currentDate),
          title: `${competitor.name} completes high-value contract`,
          summary: `${competitor.name} wrapped a $${event.payout.toLocaleString()} booking without incident, boosting reputation.`,
          tone: 'positive',
          companyId: competitor.id,
          eventId: event.eventId,
        });
      }

      return {
        ...event,
        status: 'completed',
      };
    });

    const rateTarget = 1 + (reputation - 60) / 220;
    const smoothedRate = Math.min(1.25, Math.max(0.75, Number((competitor.baseRateModifier * 0.7 + rateTarget * 0.3).toFixed(2))));

    return {
      ...competitor,
      reputation,
      reliability,
      balance,
      scheduledEvents: updatedSchedule as CompetitorScheduledEvent[],
      baseRateModifier: smoothedRate,
      scoutingNotes: notes,
    } satisfies CompetitorCompany;
  });

  return { competitors: updatedCompetitors, news: newsItems };
}
