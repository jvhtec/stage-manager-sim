/**
 * Brand sponsors and good causes. A company that's getting noticed is
 * approached by brands that want their name on the trucks — for a monthly
 * retainer, if you keep the shows coming. Charities ask for favours too;
 * saying yes costs money now and builds the goodwill that makes sponsors
 * call more often and pay better.
 */
import { createRng } from '@/lib/rng';
import type { Rng } from '@/lib/rng';
import { book, dayOf, formatMoney, newId, pushNews, yearOf } from './core';
import { marketingScale } from './marketing';
import { worldOf } from './mapgen';
import type { SponsorDeal, TycoonState } from './types';

export type SponsorCategory = 'drinks' | 'telecom' | 'bank' | 'fuel' | 'tech' | 'retail';

export interface SponsorBrand {
  id: string;
  name: string;
  category: SponsorCategory;
  from: number;
  to?: number;
}

/** Invented brands — nothing here is a real company. */
export const SPONSOR_BRANDS: SponsorBrand[] = [
  { id: 'crest', name: 'Crest Lager', category: 'drinks', from: 1975 },
  { id: 'volta', name: 'Volta Cola', category: 'drinks', from: 1975 },
  { id: 'northbank', name: 'Northbank', category: 'bank', from: 1975 },
  { id: 'beacon', name: 'Blue Beacon Fuel', category: 'fuel', from: 1975 },
  { id: 'hightown', name: 'Hightown Stores', category: 'retail', from: 1980 },
  { id: 'penny', name: 'Penny Telecom', category: 'telecom', from: 1990 },
  { id: 'dotmobile', name: 'Dot Mobile', category: 'telecom', from: 1997 },
  { id: 'pixelcraft', name: 'Pixelcraft', category: 'tech', from: 1995 },
  { id: 'streamly', name: 'Streamly', category: 'tech', from: 2008 },
];

export const MAX_SPONSORS = 2;
export const TERM_MONTHS = 12;
/** Missed this many months' commitments in a row and they walk. */
export const MAX_SHORTFALLS = 2;
export const HAGGLE_RAISE = 1.2;
export const HAGGLE_WALK_CHANCE = 0.4;
const MIN_REPUTATION = 25;
const MIN_SHOWS = 10;
/** Goodwill scales both the offer rate and the retainer. */
export const goodwillOf = (s: Pick<TycoonState, 'goodwill'>) => s.goodwill ?? 0;

export const activeSponsors = (s: Pick<TycoonState, 'sponsors'>) => s.sponsors.filter(d => d.status === 'active');

export function brandsFor(s: TycoonState): SponsorBrand[] {
  const year = yearOf(s, s.hour);
  const taken = new Set(s.sponsors.map(d => brandOf(d.brandId)?.category));
  return SPONSOR_BRANDS.filter(b => b.from <= year && (!b.to || b.to >= year) && !taken.has(b.category));
}

export const brandOf = (id: string) => SPONSOR_BRANDS.find(b => b.id === id);

const fleetSize = (s: TycoonState) => s.vehicles.filter(v => v.owner === 'player').length;

/** What a sponsor would pay a month, and what they expect in return. */
export function sponsorTerms(s: TycoonState) {
  const fleet = fleetSize(s);
  const monthly = Math.round(((500 + 30 * s.company.reputation) * Math.max(0.7, Math.min(2.5, fleet / 3)) * (1 + goodwillOf(s) / 250)) / 10) * 10;
  return { monthly, minShows: Math.max(2, Math.round(fleet * 1.5)) };
}

/** Per-month chance a brand comes calling. */
export const offerChance = (s: TycoonState) => 0.1 + goodwillOf(s) / 500;

/** Daily-ish helper: shows played since the last monthly check. */
export const showsThisMonth = (s: TycoonState) => s.stats.showsPlayed - (s.sponsorMark ?? 0);

/** Mutating: sign (or haggle for) an offered deal. Returns a line. */
export function signSponsor(s: TycoonState, dealId: string, haggle: boolean, rng: Rng): string {
  const deal = s.sponsors.find(d => d.id === dealId);
  if (!deal) return '';
  const brand = brandOf(deal.brandId)!;
  if (haggle && rng.chance(HAGGLE_WALK_CHANCE)) {
    s.sponsors = s.sponsors.filter(d => d.id !== dealId);
    pushNews(s, `${brand.name} walk away from the table — too much haggling.`, 'bad');
    return `${brand.name} walk away.`;
  }
  if (haggle) deal.monthly = Math.round((deal.monthly * HAGGLE_RAISE) / 10) * 10;
  deal.status = 'active';
  deal.startDay = dayOf(s.hour);
  deal.endDay = dayOf(s.hour) + TERM_MONTHS * 30;
  deal.shortfalls = 0;
  s.sponsorMark ??= s.stats.showsPlayed;
  pushNews(s, `${brand.name} sign on as sponsors: ${formatMoney(s, deal.monthly)} a month for ${deal.minShows}+ shows a month.`, 'good');
  return `${brand.name} sponsor you for ${formatMoney(s, deal.monthly)}/month.`;
}

export function declineSponsor(s: TycoonState, dealId: string) {
  s.sponsors = s.sponsors.filter(d => d.id !== dealId);
}

/** Mutating: a charity favour; `generous` gives the full production. */
export function giveCharity(s: TycoonState, cityId: string | undefined, generous: boolean) {
  s.goodwill = Math.min(100, goodwillOf(s) + (generous ? 15 : 6));
  s.company.reputation = Math.min(100, s.company.reputation + (generous ? 0.8 : 0.3));
  if (cityId) s.cityRatings[cityId] = Math.min(100, (s.cityRatings[cityId] ?? 50) + (generous ? 4 : 1.5));
  s.charityDone = (s.charityDone ?? 0) + 1;
}

export const charityCost = (s: TycoonState) => Math.round((marketingScale(s) * 1.2) / 10) * 10;

/** Monthly: settle active deals, maybe get an offer, maybe get asked for a favour. */
export function monthlySponsors(s: TycoonState, rng: Rng) {
  const played = showsThisMonth(s);
  s.sponsorMark = s.stats.showsPlayed;
  const today = dayOf(s.hour);

  s.sponsors = s.sponsors.filter(d => {
    if (d.status !== 'active') return true;
    const brand = brandOf(d.brandId)!;
    if (played >= d.minShows) {
      book(s, 'sponsorship', d.monthly);
      d.paid += d.monthly;
      d.shortfalls = 0;
    } else {
      d.shortfalls += 1;
      pushNews(s, `${brand.name} are unhappy: only ${played} show${played === 1 ? '' : 's'} last month against ${d.minShows}. No retainer this month.`, 'bad');
      if (d.shortfalls >= MAX_SHORTFALLS) {
        pushNews(s, `${brand.name} pull their sponsorship after two quiet months.`, 'bad');
        s.goodwill = Math.max(0, goodwillOf(s) - 10);
        s.company.reputation = Math.max(0, s.company.reputation - 1);
        return false;
      }
      return true;
    }
    if (today >= d.endDay) {
      pushNews(s, `${brand.name}'s sponsorship runs its course — they were happy (${formatMoney(s, d.paid)} paid in all).`, 'info');
      s.goodwill = Math.min(100, goodwillOf(s) + 5);
      return false;
    }
    return true;
  });
  s.goodwill = Math.max(0, goodwillOf(s) - 1);

  const open = (k: string) => s.dilemmas.some(d => d.kind === k);
  const eligible = s.company.reputation >= MIN_REPUTATION && s.stats.showsPlayed >= MIN_SHOWS;
  if (eligible && activeSponsors(s).length + s.sponsors.filter(d => d.status === 'offer').length < MAX_SPONSORS && !open('sponsor') && rng.chance(offerChance(s))) {
    const options = brandsFor(s);
    if (options.length) {
      const brand = rng.pick(options);
      const terms = sponsorTerms(s);
      const deal: SponsorDeal = { id: newId(s, 'spn'), brandId: brand.id, monthly: terms.monthly, minShows: terms.minShows, status: 'offer', startDay: today, endDay: today, shortfalls: 0, paid: 0 };
      s.sponsors.push(deal);
      s.dilemmas.push({
        id: newId(s, 'dl'),
        kind: 'sponsor',
        title: `${brand.name} want their name on your trucks`,
        text: `${brand.name} will pay ${formatMoney(s, deal.monthly)} a month for a year, provided you keep at least ${deal.minShows} shows a month on the road. Miss it two months running and they walk.`,
        options: [
          { id: 'sign', label: 'Sign', detail: `${formatMoney(s, deal.monthly)}/month, ${deal.minShows}+ shows a month.` },
          { id: 'haggle', label: 'Push for more', detail: `+20% a month — but ${Math.round(HAGGLE_WALK_CHANCE * 100)}% they walk.` },
          { id: 'decline', label: 'Decline', detail: 'Keep the trucks clean.' },
        ],
        defaultOption: 'decline',
        payload: deal.id,
        createdHour: s.hour,
        expiresHour: s.hour + 24 * 14,
      });
      pushNews(s, `${brand.name} approach you about sponsorship.`, 'info');
    }
  }

  if (s.company.reputation >= 20 && s.stats.showsPlayed >= 5 && !open('charity') && s.depots.length && rng.chance(0.04)) {
    const depot = rng.pick(s.depots);
    const city = worldOf(s).cityById.get(depot.cityId)?.name;
    const cost = charityCost(s);
    s.dilemmas.push({
      id: newId(s, 'dl'),
      kind: 'charity',
      title: `A benefit night in ${city}`,
      text: `A local charity is putting on a benefit show in ${city} and asks if you could provide the production for free.`,
      options: [
        { id: 'donate', label: 'Do it properly', detail: `${formatMoney(s, cost)} of kit, crew and fuel. Goodwill +15, reputation up, the town remembers.`, cost },
        { id: 'half', label: 'A basic rig', detail: `${formatMoney(s, Math.round(cost / 2))}. Goodwill +6.`, cost: Math.round(cost / 2) },
        { id: 'decline', label: 'Say no', detail: 'Politely.' },
      ],
      defaultOption: 'decline',
      payload: depot.cityId,
      createdHour: s.hour,
      expiresHour: s.hour + 24 * 14,
    });
  }
}

/** For the decision handler, a seeded roll that doesn't disturb the sim. */
export const dealRng = (s: TycoonState, dealId: string) => createRng((s.mapSeed ^ [...dealId].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 11) ^ s.hour) >>> 0);
