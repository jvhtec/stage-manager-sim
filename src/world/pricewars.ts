/**
 * Price wars. Now and then a rival decides your town is theirs and starts
 * undercutting: fees there fall and they win more of the work. You can ride
 * it out (cheap, slow — a war hurts them too), fight (it costs, but you hit
 * them harder and keep more of your fees), or pay for peace.
 */
import type { Rng } from '@/lib/rng';
import { dayOf, formatMoney, newId, pushNews } from './core';
import { marketingScale } from './marketing';
import { rivalHealth } from './rivals';
import { roadDistance } from './pathfinding';
import { worldOf } from './mapgen';
import type { PriceWar, TycoonState } from './types';

/** Monthly chance a rival starts one (when none are on, a bit less when one is). */
export const WAR_CHANCE = 0.05;
export const MAX_WARS = 2;
/** A rival has to be this healthy to afford a war. */
const WAR_MIN_HEALTH = 55;
/** …and based this close to a town you work in. */
const WAR_REACH = 35;
/** Rival health lost per month: riding it out vs fighting. */
export const WAR_DAMAGE = { ride: 2, fight: 5 };
/** A fighter keeps this share of the undercut off their own fees (a fight is on quality). */
const FIGHT_FEE_SHARE = 0.5;
/** Rivals win this much more of the work in a war town. */
export const WAR_WIN_BONUS = 1.3;
/** A rival this weak backs down. */
const BACK_DOWN_HEALTH = 35;

export const warAt = (s: Pick<TycoonState, 'priceWars'>, cityId: string) => (s.priceWars ?? []).filter(w => w.cityId === cityId);

/** Multiplier on fees in a town: every live war undercuts. */
export function priceWarFactor(s: Pick<TycoonState, 'priceWars'>, cityId: string): number {
  return warAt(s, cityId).reduce((f, w) => f * (1 - w.undercut * (w.fight ? FIGHT_FEE_SHARE : 1)), 1);
}

/** How much more a rival wins in a town you've not stood up in. */
export const warWinBonus = (s: Pick<TycoonState, 'priceWars'>, cityId: string, rivalId: string) =>
  warAt(s, cityId).some(w => w.rivalId === rivalId && !w.fight) ? WAR_WIN_BONUS : 1;

export const fightCost = (s: Pick<TycoonState, 'company'>) => Math.round((marketingScale(s) * 2) / 10) * 10;
export const truceCost = (s: Pick<TycoonState, 'company'>) => Math.round((marketingScale(s) * 4) / 10) * 10;

/** Monthly: a rival may start a war; live wars grind on and end. */
export function monthlyPriceWars(s: TycoonState, rng: Rng) {
  const today = dayOf(s.hour);
  // Existing wars wear the aggressor down.
  s.priceWars = s.priceWars.filter(w => {
    const rival = s.rivals.find(r => r.id === w.rivalId);
    const city = worldOf(s).cityById.get(w.cityId)?.name;
    if (!rival) return false;
    rival.health = Math.max(0, rivalHealth(rival) - (w.fight ? WAR_DAMAGE.fight : WAR_DAMAGE.ride));
    if (rivalHealth(rival) < BACK_DOWN_HEALTH) {
      pushNews(s, `${rival.name} can't afford the price war in ${city} and backs down. Fees recover.`, 'good', { cityId: w.cityId });
      return false;
    }
    if (today >= w.endDay) {
      pushNews(s, `The price war in ${city} fizzles out. Fees are back to normal.`, 'info', { cityId: w.cityId });
      return false;
    }
    return true;
  });

  if (s.priceWars.length >= MAX_WARS || !rng.chance(WAR_CHANCE)) return;
  const world = worldOf(s);
  const myTowns = new Set(s.depots.map(d => d.cityId));
  const candidates = s.rivals.filter(r => rivalHealth(r) >= WAR_MIN_HEALTH && !s.priceWars.some(w => w.rivalId === r.id));
  const pairs = candidates.flatMap(r =>
    [...myTowns]
      .filter(c => !warAt(s, c).length)
      .filter(c => {
        const d = roadDistance(world, r.hqCityId, c);
        return Number.isFinite(d) && d <= WAR_REACH;
      })
      .map(c => ({ r, c })),
  );
  if (!pairs.length) return;
  const { r, c } = rng.pick(pairs);
  const undercut = Math.round((0.08 + rng.next() * 0.12) * 100) / 100;
  const war: PriceWar = { id: newId(s, 'war'), cityId: c, rivalId: r.id, startDay: today, endDay: today + 60 + Math.floor(rng.next() * 61), undercut, fight: false };
  s.priceWars.push(war);
  const city = world.cityById.get(c)?.name;
  s.dilemmas.push({
    id: newId(s, 'dl'),
    kind: 'pricewar',
    title: `${r.name} start a price war in ${city}`,
    text: `${r.name} are undercutting everyone in ${city} by about ${Math.round(undercut * 100)}% and snapping up the work. Fees there will fall until it blows over — or somebody blinks.`,
    options: [
      { id: 'ride', label: 'Ride it out', detail: `Fees there drop ${Math.round(undercut * 100)}% and they win more — but it bleeds them too.` },
      { id: 'fight', label: 'Fight back', detail: `Spend ${formatMoney(s, fightCost(s))} on a local push: you keep half your fees and hit them hard, so it ends sooner.`, cost: fightCost(s) },
      { id: 'truce', label: 'Buy a truce', detail: `${formatMoney(s, truceCost(s))} to call it off now (and they come out looking strong).`, cost: truceCost(s) },
    ],
    defaultOption: 'ride',
    payload: war.id,
    createdHour: s.hour,
    expiresHour: s.hour + 24 * 5,
  });
  pushNews(s, `${r.name} start undercutting in ${city}.`, 'bad', { cityId: c });
}
