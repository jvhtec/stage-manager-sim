/**
 * Historic scenarios: start in a real place at a real moment with one job to win — the night the
 * industry still talks about. Each starts you as an established small firm (reputation and cash
 * enough to bid), and the goal is to win a lot of the event's production and bring the night off.
 */
import type { CountryCode } from './content/countries';
import type { TycoonState } from './types';

export interface Scenario {
  id: string;
  title: string;
  blurb: string;
  country: CountryCode;
  startYear: number;
  /** HQ town (by name). */
  hq: string;
  /** The special event (content/events.ts id) you must win a lot of and deliver. */
  event: string;
  /** Years you have from the start. */
  years: number;
  reputation: number;
  /** Multiple of the usual starting cash. */
  cash: number;
}

export const SCENARIOS: Scenario[] = [
  { id: 'liveaid85', title: 'Live Aid, 1985', blurb: 'A stadium, a satellite link and two billion watching. Win a lot of Wembley\'s production — and don\'t let it fail.', country: 'GB', startYear: 1985, hq: 'London', event: 'liveaid-uk', years: 1, reputation: 76, cash: 5 },
  { id: 'wall90', title: 'The Wall, Berlin 1990', blurb: 'A 170-metre wall built and torn down on Potsdamer Platz, months after the real one fell. Win a lot of Roger Waters\' production.', country: 'DE', startYear: 1990, hq: 'Berlin', event: 'wall90', years: 1, reputation: 77, cash: 5 },
  { id: 'italia90', title: 'Italia ’90', blurb: 'The World Cup opens in Milan. Win a lot of the opening ceremony before the first whistle.', country: 'IT', startYear: 1990, hq: 'Milano', event: 'italia90', years: 1, reputation: 64, cash: 4 },
  { id: 'bcn92', title: 'Barcelona ’92', blurb: 'The Olympic opening ceremony, Caballé and Carreras, the world watching. Win a lot of its production.', country: 'ES', startYear: 1992, hq: 'Barcelona', event: 'bcn92', years: 1, reputation: 77, cash: 5 },
  { id: 'expo92', title: 'Expo ’92, Sevilla', blurb: 'The Universal Exposition opens on the Cartuja island. Win a lot of the opening production.', country: 'ES', startYear: 1992, hq: 'Sevilla', event: 'expo92', years: 1, reputation: 64, cash: 4 },
  { id: 'atlanta96', title: 'Atlanta ’96', blurb: 'The centennial Olympics open in a stadium built for it. Win a lot of the ceremony.', country: 'US', startYear: 1996, hq: 'Atlanta', event: 'atlanta96', years: 1, reputation: 64, cash: 4 },
  { id: 'london2012', title: 'London 2012', blurb: 'Danny Boyle\'s Isles of Wonder, the Queen and Bond. Win a lot of the opening ceremony.', country: 'GB', startYear: 2012, hq: 'London', event: 'london2012', years: 1, reputation: 66, cash: 4 },
];

export const getScenario = (id: string | undefined) => SCENARIOS.find(s => s.id === id);

/** Has the company delivered a lot of the scenario's event, and how well? */
export function scenarioProgress(s: Pick<TycoonState, 'gigs' | 'scenario'>): { won: boolean; bid: boolean; lots: number; text: string } {
  const sc = getScenario(s.scenario);
  if (!sc) return { won: false, bid: false, lots: 0, text: '' };
  const mine = s.gigs.filter(g => g.event?.id === sc.event && !g.event.citywide && (g.status === 'booked' || g.status === 'done'));
  const done = mine.filter(g => g.status === 'done' && (g.result?.quality ?? 0) >= 0.5);
  return {
    won: done.length > 0,
    bid: mine.length > 0,
    lots: mine.length,
    text: done.length ? 'Delivered' : mine.length ? `You hold ${mine.length} lot${mine.length > 1 ? 's' : ''}` : 'No lot yet — bid',
  };
}
