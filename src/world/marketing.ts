/**
 * Getting your name about. A standing marketing budget buys more offers and a
 * slow climb in reputation; the trade-show season (PLASA, Prolight + Sound,
 * LDI) puts a decision in front of you each year: take a stand, just walk the
 * floor, or skip it. Shows bring a burst of enquiries and cheaper kit.
 */
import { book, dateOfDay, dayOf, newId, pushNews, yearOf } from './core';
import { showsIn, travelFactor, type TradeShow } from './content/tradeShows';
import { getCountry } from './content/countries';
import { marketNow } from './market';
import type { MarketingLevel, TycoonState } from './types';

export interface MarketingInfo {
  label: string;
  /** Monthly cost as a share of the scale (400 + 20 × reputation). */
  rate: number;
  /** Multiplier on offers. */
  offers: number;
  /** Reputation per month (fades as you near the top). */
  reputation: number;
  blurb: string;
}

export const MARKETING: Record<MarketingLevel, MarketingInfo> = {
  none: { label: 'None', rate: 0, offers: 1, reputation: 0, blurb: 'Word of mouth only.' },
  local: { label: 'Local ads', rate: 0.25, offers: 1.04, reputation: 0.08, blurb: 'Cards in the shop windows and an ad in the local paper.' },
  trade: { label: 'Trade press', rate: 0.6, offers: 1.09, reputation: 0.18, blurb: 'Regular ads in the industry magazines and a mailing list.' },
  national: { label: 'National campaign', rate: 1.4, offers: 1.16, reputation: 0.3, blurb: 'Sponsored award tables, big ads, a name on everyone’s lips.' },
};
export const MARKETING_LEVELS: MarketingLevel[] = ['none', 'local', 'trade', 'national'];

export const marketingScale = (s: Pick<TycoonState, 'company'>) => 400 + s.company.reputation * 20;
export const marketingMonthly = (s: Pick<TycoonState, 'company'>, level: MarketingLevel) => Math.round((marketingScale(s) * MARKETING[level].rate) / 10) * 10;

/** Monthly: pay the agency; reputation creeps up while you're still climbing. */
export function monthlyMarketing(s: TycoonState) {
  const level = s.policies.marketing;
  const info = MARKETING[level];
  if (!info.rate) return;
  book(s, 'marketing', -marketingMonthly(s, level));
  s.company.reputation = Math.min(100, s.company.reputation + info.reputation * Math.max(0, 1 - s.company.reputation / 100));
}

/** Offer-rate multiplier today: the standing budget times any show buzz still running. */
export function offerBuzz(s: TycoonState): number {
  const promo = s.promo;
  const buzz = promo && dayOf(s.hour) <= promo.offerUntil ? promo.offerMult : 1;
  return MARKETING[s.policies.marketing].offers * buzz;
}

/** Price multiplier on kit today from show deals. */
export function showDiscount(s: Pick<TycoonState, 'promo' | 'hour'>): number {
  const promo = s.promo;
  return promo && dayOf(s.hour) <= promo.gearUntil ? 1 - promo.gearDiscount : 1;
}

export interface ShowTerms {
  stand: number;
  visit: number;
}

/** What a show costs you: exhibiting scales with your size, everything with the distance. */
export function showCost(s: TycoonState, show: TradeShow): ShowTerms {
  const travel = travelFactor(s.country, show.country);
  const base = marketingScale(s);
  return { stand: Math.round((base * 4 * travel) / 10) * 10, visit: Math.round((base * 0.8 * travel) / 10) * 10 };
}

export const EXHIBIT = { offerMult: 1.25, offerDays: 30, gearDiscount: 0.12, gearDays: 14, reputation: 0.8 };
export const VISIT = { offerMult: 1.08, offerDays: 14, gearDiscount: 0.05, gearDays: 7, reputation: 0.1 };

/** Daily: on a show's opening day, ask whether you're going. */
export function dailyTradeShows(s: TycoonState) {
  const today = dayOf(s.hour);
  const date = dateOfDay(s, today);
  const year = date.getUTCFullYear();
  if (marketNow(s).shutdown) return;
  showsIn(year).forEach(show => {
    if (date.getUTCMonth() + 1 !== show.month || date.getUTCDate() !== show.day) return;
    if (s.hour < 24) return; // not on the first morning of the game
    const cost = showCost(s, show);
    const where = show.country === s.country ? show.city : `${show.city}, ${getCountry(show.country).name}`;
    s.dilemmas.push({
      id: newId(s, 'dl'),
      kind: 'tradeshow',
      title: `${show.name} ${year}`,
      text: `${show.name} opens in ${where}. ${show.blurb} Everybody who books crews will be there.`,
      options: [
        { id: 'stand', label: 'Take a stand', detail: `A month of enquiries (+${Math.round((EXHIBIT.offerMult - 1) * 100)}% offers), ${Math.round(EXHIBIT.gearDiscount * 100)}% off kit for two weeks, and a name.`, cost: cost.stand },
        { id: 'visit', label: 'Walk the floor', detail: `A bit of networking and some deals (+${Math.round((VISIT.offerMult - 1) * 100)}% offers for two weeks, ${Math.round(VISIT.gearDiscount * 100)}% off kit for a week).`, cost: cost.visit },
        { id: 'skip', label: 'Stay home', detail: 'Free. The phone stays quiet.' },
      ],
      defaultOption: 'skip',
      payload: show.id,
      createdHour: s.hour,
      expiresHour: s.hour + 72,
    });
  });
}

/** Mutating: what you did at the show. */
export function attendShow(s: TycoonState, showId: string, how: 'stand' | 'visit') {
  const e = how === 'stand' ? EXHIBIT : VISIT;
  const today = dayOf(s.hour);
  s.promo = {
    offerMult: Math.max(e.offerMult, s.promo && today <= s.promo.offerUntil ? s.promo.offerMult : 1),
    offerUntil: today + e.offerDays,
    gearDiscount: e.gearDiscount,
    gearUntil: today + e.gearDays,
  };
  s.company.reputation = Math.min(100, s.company.reputation + e.reputation);
  const show = showsIn(yearOf(s, s.hour)).find(x => x.id === showId);
  pushNews(s, `${s.company.name} ${how === 'stand' ? 'exhibits at' : 'works the floor at'} ${show?.name ?? 'the show'}: the phones are ringing.`, 'good');
}
