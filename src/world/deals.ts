/**
 * Production deals. An act you've done proud again and again may offer you
 * their production exclusively for two years: a monthly retainer, and every
 * tour they announce comes straight to you — rivals don't get a look in. The
 * catch: let one of their tours lapse, or give them a bad night, and that's a
 * strike. Two strikes and they walk.
 */
import type { Rng } from '@/lib/rng';
import { tierInfo } from './catalog';
import { book, dayOf, formatMoney, newId, pushNews, yearOf } from './core';
import { ARTISTS, artistTierIn } from './content/artists';
import type { TycoonState } from './types';

/** Good shows together before an act offers a deal. */
export const DEAL_RELATION = 3;
const OFFER_CHANCE = 0.06;
/** After a deal ends or an offer lapses, an act waits this long before asking again. */
const COOLDOWN_DAYS = 365;
const OFFER_OPEN_DAYS = 21;
export const DEAL_YEARS = 2;
/** Retainer per month as a share of one show's fee at the act's tier. */
const RETAINER_RATE = 0.25;
export const STRIKES_TO_WALK = 2;
/** A deal act's shows below this count as a bad night. */
export const BAD_NIGHT = 0.5;

export const activeDealFor = (state: TycoonState, act: string) => state.deals.find(d => d.act === act && d.status === 'active');

/** Monthly: retainers in; acts that love you may offer a deal. */
export function monthlyDeals(s: TycoonState, rng: Rng) {
  const today = dayOf(s.hour);
  const year = yearOf(s, s.hour);
  s.deals.forEach(d => {
    if (d.status === 'active') {
      if (today >= d.endDay) {
        d.status = 'ended';
        pushNews(s, `Your production deal with ${d.act} has run its course${d.strikes ? '' : ' — they’d love to go again'}.`, 'info');
        if (!d.strikes) s.artistRelations[d.act] = Math.max(DEAL_RELATION, s.artistRelations[d.act] ?? 0);
        return;
      }
      book(s, 'deals', d.monthly);
    } else if (d.status === 'offer' && today > d.offerExpires) {
      d.status = 'ended';
    }
  });
  const candidates = ARTISTS.filter(a => {
    if ((s.artistRelations[a.name] ?? 0) < DEAL_RELATION) return false;
    if (a.country && a.country !== s.country) return false;
    if (artistTierIn(a, year) < 2) return false;
    return !s.deals.some(d => d.act === a.name && (d.status === 'active' || d.status === 'offer' || today - Math.max(d.endDay, d.offerExpires) < COOLDOWN_DAYS));
  });
  candidates.forEach(a => {
    if (!rng.chance(OFFER_CHANCE)) return;
    const tier = artistTierIn(a, year);
    const monthly = Math.round((tierInfo(tier).baseFee * RETAINER_RATE) / 100) * 100;
    s.deals.push({ id: newId(s, 'deal'), act: a.name, tier, monthly, startDay: 0, endDay: 0, strikes: 0, status: 'offer', offerExpires: today + OFFER_OPEN_DAYS });
    pushNews(s, `${a.name}'s management offers you their production exclusively for ${DEAL_YEARS} years — ${formatMoney(s, monthly)}/month retainer. See Shows → Contracts.`, 'big');
  });
}

/** A deal act's tour lapsed or a show went badly. Mutates. */
export function strike(s: TycoonState, act: string, why: string) {
  const d = activeDealFor(s, act);
  if (!d) return;
  d.strikes += 1;
  if (d.strikes >= STRIKES_TO_WALK) {
    d.status = 'ended';
    d.endDay = dayOf(s.hour);
    s.artistRelations[act] = 0;
    s.company.reputation = Math.max(0, s.company.reputation - 3);
    pushNews(s, `${act} walk out of their production deal: ${why}. The industry noticed.`, 'bad');
  } else {
    pushNews(s, `Strike one with ${act}: ${why}. Another and they walk.`, 'bad');
  }
}
