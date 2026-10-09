/**
 * Rivalry. Rivals are people too: some are grudge-holders. Provoke one —
 * raid its crew, fight it on price — or simply sit in an aggressive
 * neighbour's patch and the heat rises, and with it the dirty tricks: rumours,
 * tampered racks, tip-offs. You can pay for security, hit back, or hire an
 * investigator to see what they're up to and get a step ahead.
 */
import type { Rng } from '@/lib/rng';
import { book, dayOf, formatMoney, newId, pushNews } from './core';
import { marketingScale } from './marketing';
import { rivalHealth } from './rivals';
import { roadDistance } from './pathfinding';
import { worldOf } from './mapgen';
import { ownedStock } from './wear';
import { getProduct } from './content/gear';
import type { Gig, Rival, TycoonState } from './types';

/** Heat at which a rival starts playing dirty. */
export const HEAT_DIRTY = 35;
export const HEAT_MAX = 100;
/** Cooling each month. */
export const HEAT_DECAY = 3;
/** How near a rival must be (road tiles) to a base of yours to resent it. */
export const NEIGHBOUR_REACH = 35;
/** Provocations. */
export const HEAT_HEADHUNT = 12;
export const HEAT_FIGHT = 8;
export const HEAT_TRUCE = -5;
/** Investigators. */
export const INTEL_DAYS = 90;
export const INTEL_CAUGHT_CHANCE = 0.2;
/** Chances taken by a rival with your investigator watching (offers). */
export const INTEL_OFFER_FACTOR = 0.6;
export const RETALIATE_SUCCESS = 0.55;
export const RETALIATE_DAMAGE = 8;
export const SECURITY_COOL = 8;

const hash = (str: string) => [...str].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 17);
/** 0.2-0.9: how readily this rival holds a grudge. Stable per rival. */
export const aggression = (r: Pick<Rival, 'id'>) => 0.2 + ((hash(r.id) % 71) / 70) * 0.7;

export const heatOf = (s: Pick<TycoonState, 'rivalry'>, rivalId: string) => s.rivalry?.[rivalId]?.heat ?? 0;
export const hasIntel = (s: Pick<TycoonState, 'rivalry' | 'hour'>, rivalId: string) => (s.rivalry?.[rivalId]?.intelUntil ?? -1) > dayOf(s.hour);
export const intelFactor = (s: Pick<TycoonState, 'rivalry' | 'hour'>, rivalId: string) => (hasIntel(s, rivalId) ? INTEL_OFFER_FACTOR : 1);

export function addHeat(s: TycoonState, rivalId: string, amount: number) {
  const row = ((s.rivalry ??= {})[rivalId] ??= { heat: 0 });
  row.heat = Math.max(0, Math.min(HEAT_MAX, row.heat + amount));
}

export const securityCost = (s: Pick<TycoonState, 'company'>) => Math.round((marketingScale(s) * 1.5) / 10) * 10;
export const retaliateCost = (s: Pick<TycoonState, 'company'>) => Math.round((marketingScale(s) * 3) / 10) * 10;
export const investigatorCost = (s: Pick<TycoonState, 'company'>) => Math.round((marketingScale(s) * 1.5) / 10) * 10;

export function investigatorBlocker(s: TycoonState, r: Rival): string | null {
  if (s.goneRivals.includes(r.id)) return 'They have gone under.';
  if (hasIntel(s, r.id)) return 'Your investigator is already on it.';
  const cost = investigatorCost(s);
  if (s.company.cash < cost) return `An investigator costs ${formatMoney(s, cost)}.`;
  return null;
}

export function hireInvestigator(s: TycoonState, r: Rival, rng: Rng): string {
  const cost = investigatorCost(s);
  book(s, 'marketing', -cost);
  const day = dayOf(s.hour);
  addHeat(s, r.id, 0);
  s.rivalry[r.id].intelUntil = day + INTEL_DAYS;
  if (rng.chance(INTEL_CAUGHT_CHANCE)) {
    addHeat(s, r.id, 8);
    s.company.reputation = Math.max(0, s.company.reputation - 1);
    pushNews(s, `${r.name} catch your investigator going through their bins. They are not amused.`, 'bad');
    return `${r.name} caught your investigator — heat up, reputation down. (You still got your look.)`;
  }
  return `Your investigator is watching ${r.name} for ${INTEL_DAYS} days.`;
}

type TrickId = 'rumours' | 'tamper' | 'tipoff';
const TRICKS: Record<TrickId, { title: (r: string) => string; text: (r: string) => string }> = {
  rumours: {
    title: r => `${r} are spreading rumours`,
    text: r => `Word reaches you that ${r} are telling promoters your crews are unreliable and your kit is tired.`,
  },
  tamper: {
    title: r => `Someone's been at your racks`,
    text: r => `A fault-finding session turns up cut cables and loosened fittings in your warehouse. Everyone suspects ${r}.`,
  },
  tipoff: {
    title: r => `A tip-off to the council`,
    text: r => `An anonymous call sends the council's noise and safety officers to your next show. The voice sounded a lot like someone from ${r}.`,
  },
};

/** The damage a trick does if you do nothing (or fail to stop it). */
export function applyTrick(s: TycoonState, trick: TrickId, rng: Rng): string {
  if (trick === 'rumours') {
    s.company.reputation = Math.max(0, s.company.reputation - 2);
    return 'Reputation −2.';
  }
  if (trick === 'tamper') {
    const owned = Object.keys(ownedStock(s));
    if (!owned.length) return 'They found nothing to tamper with.';
    const id = rng.pick(owned);
    s.gearCondition[id] = Math.max(0, (s.gearCondition[id] ?? 100) - 30);
    return `${getProduct(id).brand} ${getProduct(id).name} racks lose 30 condition.`;
  }
  const today = dayOf(s.hour);
  const gig = s.gigs.filter((g: Gig) => g.status === 'booked' && g.day >= today && g.day <= today + 21).sort((a, b) => a.day - b.day)[0];
  if (gig) {
    const m = (gig.mods ??= {});
    m.quality = (m.quality ?? 0) - 0.05;
    m.failureFactor = (m.failureFactor ?? 1) * 1.1;
    return `${gig.act}: the show suffers a distraction (quality −5%).`;
  }
  s.company.reputation = Math.max(0, s.company.reputation - 0.5);
  return 'Nothing booked to disrupt; reputation −0.5.';
}

/** Mutating: the player's answer to a trick. `payload` = `${rivalId}|${trick}`. */
export function answerTrick(s: TycoonState, payload: string, choice: string, rng: Rng): string {
  const [rivalId, trick] = payload.split('|') as [string, TrickId];
  const rival = s.rivals.find(r => r.id === rivalId);
  if (choice === 'security') {
    addHeat(s, rivalId, -SECURITY_COOL);
    return 'Security tightened: the attempt fizzles.';
  }
  if (choice === 'retaliate' && rival && rng.chance(RETALIATE_SUCCESS)) {
    rival.health = Math.max(0, rivalHealth(rival) - RETALIATE_DAMAGE);
    addHeat(s, rivalId, -15);
    pushNews(s, `${rival.name} are exposed for dirty tricks — their clients are not impressed.`, 'good');
    return `You caught them red-handed: ${rival.name} lose ${RETALIATE_DAMAGE} finances.`;
  }
  // Ignored, or the counter-strike failed.
  const damage = applyTrick(s, trick, rng);
  if (choice === 'retaliate') {
    addHeat(s, rivalId, 10);
    s.company.reputation = Math.max(0, s.company.reputation - 1);
    return `It backfired. ${damage}`;
  }
  return damage;
}

/** Monthly: heat builds near an aggressive neighbour, cools otherwise, and sometimes boils over. */
export function monthlyRivalry(s: TycoonState, rng: Rng) {
  const world = worldOf(s);
  s.rivals.forEach(r => {
    const near = s.depots.some(d => {
      const dist = roadDistance(world, r.hqCityId, d.cityId);
      return Number.isFinite(dist) && dist <= NEIGHBOUR_REACH;
    });
    if (near) addHeat(s, r.id, aggression(r) * 4);
    addHeat(s, r.id, -HEAT_DECAY);
  });

  if (s.dilemmas.some(d => d.kind === 'dirty')) return;
  const hot = s.rivals
    .filter(r => heatOf(s, r.id) >= HEAT_DIRTY && rivalHealth(r) >= 30 && !s.goneRivals.includes(r.id))
    .sort((a, b) => heatOf(s, b.id) - heatOf(s, a.id))[0];
  if (!hot) return;
  const chance = Math.min(0.35, (heatOf(s, hot.id) - 25) / 150);
  if (!rng.chance(chance)) return;
  const trick = rng.pick(['rumours', 'tamper', 'tipoff'] as TrickId[]);
  const sec = securityCost(s);
  const ret = retaliateCost(s);
  s.dilemmas.push({
    id: newId(s, 'dl'),
    kind: 'dirty',
    title: TRICKS[trick].title(hot.name),
    text: TRICKS[trick].text(hot.name),
    options: [
      { id: 'security', label: 'Tighten security', detail: `${formatMoney(s, sec)}. Stops this one and cools things down.`, cost: sec },
      { id: 'retaliate', label: 'Hit back', detail: `${formatMoney(s, ret)} on investigators and lawyers: ${Math.round(RETALIATE_SUCCESS * 100)}% you expose them (they lose ${RETALIATE_DAMAGE} finances); else it backfires.`, cost: ret },
      { id: 'ignore', label: 'Ignore it', detail: 'Take the damage and move on.' },
    ],
    defaultOption: 'ignore',
    payload: `${hot.id}|${trick}`,
    createdHour: s.hour,
    expiresHour: s.hour + 24 * 7,
  });
  pushNews(s, `${hot.name} are playing dirty.`, 'bad');
}
