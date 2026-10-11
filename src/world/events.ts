/**
 * Special events (content/events.ts). Months ahead, the organisers tender
 * the production department by department — audio, lighting, video, staging
 * — and every firm in the league puts in a sealed bid. Bid sharp and you'll
 * likely win on price but earn less; bid premium and you need the reputation
 * to justify it. At the close, the best value bid wins each lot.
 *
 * On the night the stakes are higher than any show: a great event is worth
 * a year of reputation, and on live television nothing may be late or break.
 *
 * Citywide events (Fête de la Musique, the Love Parade) instead flood the
 * calendar with small shows on the day.
 */
import { ableRivals, rivalTryTake } from './rivalOps';
import { worldOf } from './mapgen';
import type { Rng } from '@/lib/rng';
import { DEPT_LABELS, tierInfo } from './catalog';
import { dateOfDay, dayOf, formatDay, formatMoney, newId, pushNews } from './core';
import { venueOpenIn } from './content/venueYears';
import { EVENT_NOTICE_DAYS, eventRunsIn, eventTitle, eventsFor, type SpecialEvent } from './content/events';
import { festivalHost } from './festivals';
import { marketOnDay } from './market';
import { actName, buildGig } from './offers';
import type { BidLevel, Dept, Gig, TycoonState, Vehicle, WorldMap } from './types';
import { DEPTS } from './types';

export const BID_LEVELS: Record<BidLevel, { label: string; price: number; blurb: string }> = {
  sharp: { label: 'Sharp', price: 0.85, blurb: 'Undercut the field: likelier to win, thinner margin.' },
  standard: { label: 'Standard', price: 1, blurb: 'The going rate for a job this size.' },
  premium: { label: 'Premium', price: 1.2, blurb: 'Charge for your name — you’ll need the reputation to win it.' },
};
export const BID_LEVEL_IDS: BidLevel[] = ['sharp', 'standard', 'premium'];

/** Reputation organisers want, by event scale. */
export const EVENT_REPUTATION: Record<3 | 4 | 5, number> = { 3: 45, 4: 62, 5: 75 };
/** Reputation swing from a great (or bad) event. */
export const EVENT_PRESTIGE: Record<3 | 4 | 5, number> = { 3: 2, 4: 4, 5: 7 };
/** How much bigger than a normal show of that tier the rig is. */
const SCALE_RIG: Record<3 | 4 | 5, number> = { 3: 1.2, 4: 1.35, 5: 2 };
/** Events pay a premium over the same rig on a normal night. */
const EVENT_PREMIUM = 1.8;
/** Bids close this long before the event (at least). */
const MIN_CLOSE_DAYS = 14;

export const eventTier = (scale: 3 | 4 | 5) => Math.min(4, scale);

export function eventStartDay(state: Pick<TycoonState, 'startYear'>, e: SpecialEvent, year: number): number {
  return Math.round((Date.UTC(year, e.month - 1, e.day) - Date.UTC(state.startYear, 0, 1)) / 86400000);
}

const closeDay = (e: SpecialEvent, start: number) => start - Math.max(MIN_CLOSE_DAYS, Math.round(EVENT_NOTICE_DAYS[e.scale] * 0.3));
const openDay = (e: SpecialEvent, start: number) => start - EVENT_NOTICE_DAYS[e.scale];

export interface EventDate {
  event: SpecialEvent;
  year: number;
  startDay: number;
  closeDay: number;
  host: string;
  lots: Gig[];
}

/** Events coming up in the next year, for the Events tab. */
export function eventCalendar(state: TycoonState, world: WorldMap): EventDate[] {
  const today = dayOf(state.hour);
  const year = dateOfDay(state, today).getUTCFullYear();
  const out: EventDate[] = [];
  [year, year + 1].forEach(y =>
    eventsFor(state.country).forEach(e => {
      if (!eventRunsIn(e, y)) return;
      const start = eventStartDay(state, e, y);
      if (start + (e.days ?? 1) < today || start > today + 365) return;
      out.push({
        event: e,
        year: y,
        startDay: start,
        closeDay: closeDay(e, start),
        host: festivalHost(world, e).name,
        lots: state.gigs.filter(g => g.event?.id === e.id && g.event.year === y),
      });
    }),
  );
  return out.sort((a, b) => a.startDay - b.startDay);
}

function postEvent(s: TycoonState, world: WorldMap, rng: Rng, e: SpecialEvent, year: number, start: number) {
  const host = festivalHost(world, e);
  const venues = host.venues.filter(v => v.kind !== 'airport' && venueOpenIn(v.name, year)).sort((a, b) => b.tier - a.tier);
  if (!venues.length) return;

  if (e.kind === 'citywide') {
    // Small shows everywhere (or all over the host town).
    const towns = e.id === 'fete' ? world.cities : [host];
    for (let i = 0; i < (e.shows ?? 6); i++) {
      const town = towns[i % towns.length];
      const room = town.venues.filter(v => v.kind !== 'airport' && v.tier <= 2 && venueOpenIn(v.name, year));
      if (!room.length) continue;
      const venue = rng.pick(room);
      const gig = buildGig(s, rng, { venue, day: start, act: actName(rng), real: false, feeMultiplier: 1.25 });
      gig.acceptByDay = start - 3;
      gig.event = { id: e.id, year, name: e.name, lot: 'audio', broadcast: false, scale: e.scale, citywide: true };
      gig.terms = undefined;
      s.gigs.push(gig);
    }
    pushNews(s, `${eventTitle(e, year)}: ${e.bill ?? 'shows all over town'} — ${e.shows} extra shows on ${formatDay(s, start)}. Check Shows.`, 'big', { cityId: host.id });
    return;
  }

  const site = venues[0];
  const tier = eventTier(e.scale);
  const rig = SCALE_RIG[e.scale];
  const base = tierInfo(tier);
  const total = DEPTS.reduce((sum, d) => sum + base.needs[d], 0);
  const days = e.days ?? 1;
  const close = closeDay(e, start);
  e.lots.forEach(lot => {
    const gig = buildGig(s, rng, { venue: site, day: start, act: e.name, real: false, tier, days, needsScale: rig });
    // Each lot is one department's share of the production.
    const share = Math.max(0.12, (base.needs[lot] + (lot === 'audio' ? base.needs.console : 0)) / total);
    DEPTS.forEach(d => {
      if (d !== lot && !(lot === 'audio' && d === 'console')) gig.needs[d] = 0;
    });
    if (lot === 'audio' && e.broadcast) gig.needs.console += 1; // a spare desk for broadcast
    gig.crewNeeded = Math.max(2, Math.round(gig.crewNeeded * share * 1.6));
    gig.rider = undefined;
    // A lot only carries its own department's rider: the sound lot (which brings the desks) keeps the
    // inputs, show file and PA list; lighting, video and staging lots have no desk to check.
    gig.techSpec = lot === 'audio' ? gig.techSpec : undefined;
    // Events are tendered on their own contract, not standard booking terms.
    gig.terms = undefined;
    gig.fee = Math.round((base.baseFee * rig * share * EVENT_PREMIUM * days * marketOnDay(s, start).fees) / 100) * 100;
    gig.acceptByDay = close;
    gig.event = { id: e.id, year, name: e.name, lot, broadcast: !!e.broadcast, scale: e.scale };
    s.gigs.push(gig);
  });
  pushNews(
    s,
    `${eventTitle(e, year)} (${formatDay(s, start)}, ${host.name}) is tendering its production: ${e.lots.map(l => DEPT_LABELS[l].toLowerCase()).join(', ')}.${e.broadcast ? ' Live on TV.' : ''} Bids close ${formatDay(s, close)}.`,
    'big',
    { cityId: host.id },
  );
}

const bidScore = (reputation: number, price: number, bonus: number, noise: number) => (Math.pow(Math.max(1, reputation) / 100, 1.3) * bonus * noise) / price;

function closeBidding(s: TycoonState, gig: Gig, rng: Rng) {
  const ev = gig.event!;
  const tier = gig.tier;
  const world = worldOf(s);
  // Only firms that could deliver the lot (kit free on the day, rider and site met) put in a bid.
  const contenders = ableRivals(s, world, s.rivals.filter(r => r.maxTier >= tier && r.reputation >= EVENT_REPUTATION[ev.scale as 3 | 4 | 5] - 15), gig);
  const rivalBids = contenders.map(r => ({
    r,
    price: 0.88 + rng.next() * 0.3,
    score: 0,
  }));
  rivalBids.forEach(b => (b.score = bidScore(b.r.reputation, b.price, b.r.specialty === ev.lot ? 1.15 : 1, 0.9 + rng.next() * 0.2)));
  const best = rivalBids.sort((a, b) => b.score - a.score)[0];
  if (gig.bid) {
    const price = BID_LEVELS[gig.bid].price;
    const mine = bidScore(s.company.reputation, price, gig.asksForYou ? 1.1 : 1, 0.9 + rng.next() * 0.2);
    if (!best || mine >= best.score) {
      gig.status = 'booked';
      gig.fee = Math.round((gig.fee * price) / 50) * 50;
      pushNews(s, `You won the ${DEPT_LABELS[ev.lot].toLowerCase()} contract for ${ev.name} — ${formatMoney(s, gig.fee)}. Assign trucks!`, 'good', { cityId: gig.cityId, gigId: gig.id });
      return;
    }
    pushNews(s, `${best.r.name} beat your bid for the ${DEPT_LABELS[ev.lot].toLowerCase()} at ${ev.name}.`, 'info', { cityId: gig.cityId, gigId: gig.id });
  }
  if (!best) {
    gig.status = 'expired';
    return;
  }
  rivalTryTake(s, world, best.r, gig);
  gig.status = 'rival';
  gig.rivalId = best.r.id;
  const truck: Vehicle = {
    id: newId(s, 'rv'),
    owner: best.r.id,
    modelId: 'artic-40',
    name: `${best.r.name} truck`,
    homeCityId: best.r.hqCityId,
    boughtHour: s.hour,
    reliability: 90,
    lastServiceHour: s.hour,
    status: 'parked',
    cityId: best.r.hqCityId,
    orders: [gig.id],
    cargo: {},
    crew: 0,
    profitThisYear: 0,
    profitLastYear: 0,
  };
  s.vehicles.push(truck);
}

/** Daily: open tenders, close bidding and award the lots. */
export function dailyEvents(s: TycoonState, world: WorldMap, rng: Rng) {
  const today = dayOf(s.hour);
  const year = dateOfDay(s, today).getUTCFullYear();
  [year, year + 1].forEach(y =>
    eventsFor(s.country).forEach(e => {
      const key = `${e.id}-${y}`;
      if (!eventRunsIn(e, y) || s.eventsPosted.includes(key)) return;
      const start = eventStartDay(s, e, y);
      const opens = e.kind === 'citywide' ? start - 30 : openDay(e, start);
      const latest = e.kind === 'citywide' ? start - 5 : closeDay(e, start) - 3;
      if (today < opens || today > latest) return;
      s.eventsPosted.push(key);
      if (marketOnDay(s, start).shutdown) {
        pushNews(s, `${eventTitle(e, y)} is cancelled.`, 'bad');
        return;
      }
      postEvent(s, world, rng, e, y, start);
    }),
  );
  s.gigs.forEach(g => {
    if (g.event && !g.event.citywide && g.status === 'offer' && g.acceptByDay < today) closeBidding(s, g, rng);
  });
  s.eventsPosted = s.eventsPosted.filter(k => Number(k.slice(k.lastIndexOf('-') + 1)) >= year - 1);
}

export interface EventOutcome {
  qualityPenalty: number;
  reputation: number;
  note: string;
}

/** The extra stakes of an event night, on top of the normal show result. */
export function eventStakes(gig: Gig, quality: number, trouble: boolean): EventOutcome {
  const ev = gig.event;
  if (!ev || ev.citywide) return { qualityPenalty: 0, reputation: 0, note: '' };
  const scale = ev.scale as 3 | 4 | 5;
  const penalty = ev.broadcast && trouble ? 0.15 : 0;
  const q = quality - penalty;
  if (q >= 0.8) return { qualityPenalty: penalty, reputation: EVENT_PRESTIGE[scale], note: ` The whole industry is talking about the ${DEPT_LABELS[ev.lot].toLowerCase()} at ${ev.name}.` };
  if (q < 0.6)
    return {
      qualityPenalty: penalty,
      reputation: -EVENT_PRESTIGE[scale] * 1.5,
      note: ev.broadcast && trouble ? ` It went wrong live on television.` : ` The ${DEPT_LABELS[ev.lot].toLowerCase()} let ${ev.name} down.`,
    };
  return { qualityPenalty: penalty, reputation: 0, note: '' };
}

export const lotLabel = (lot: Dept) => DEPT_LABELS[lot];
