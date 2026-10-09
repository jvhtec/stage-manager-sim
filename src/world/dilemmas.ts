/**
 * Things that need a decision. A truck breaks down with a show at stake, the
 * venue's power is undersized, the local union wants more hands, the act's
 * manager asks for extras… Each one pops up with a few choices and a
 * deadline; ignore it and the do-nothing option happens.
 *
 * Venue choices don't play out until the show: they're kept on the gig as
 * `mods` and folded into the night's quality, failure risk and weather.
 */
import type { Rng } from '@/lib/rng';
import { getModel } from './catalog';
import { book, depotInCity, formatMoney, gigById, loadInHour, newId, pushNews, showStartHour } from './core';
import { FREELANCE_DAY_RATE } from './crew';
import { aboard, moveToDepot, syncCrew } from './people';
import { getRegion } from './content/world';
import type { Dilemma, DilemmaKind, Gig, ShowMods, TycoonState, Vehicle } from './types';

const money = (s: TycoonState, n: number) => formatMoney(s, n);

/** Chance a booked show throws up a problem at load-in (a bit more for big shows). */
/** A rig crossing a border is far likelier to hit trouble. */
export const OVERSEAS_CRISIS_CHANCE = 0.25;
export const CRISIS_CHANCE = (tier: number) => 0.06 + 0.012 * tier;

const addMods = (gig: Gig, mods: ShowMods) => {
  const m = (gig.mods ??= {});
  if (mods.quality) m.quality = (m.quality ?? 0) + mods.quality;
  if (mods.failureFactor) m.failureFactor = (m.failureFactor ?? 1) * mods.failureFactor;
  if (mods.stormFactor !== undefined) m.stormFactor = Math.min(m.stormFactor ?? 1, mods.stormFactor);
};

// ---------------------------------------------------------------------------
// Road: breakdowns with a show at stake
// ---------------------------------------------------------------------------

export const recoveryCost = (v: Vehicle) => Math.max(150, Math.round(getModel(v.modelId).price * 0.015 / 10) * 10);

/** Called when a player's truck breaks down: if a show is waiting on it, it's your call. */
export function breakdownDilemma(s: TycoonState, v: Vehicle) {
  const gig = v.orders.map(id => gigById(s, id)).find(g => g && g.status === 'booked');
  if (!gig) return;
  const wait = Math.max(1, (v.brokenUntil ?? s.hour) - s.hour);
  const late = (v.brokenUntil ?? s.hour) > loadInHour(gig) - 12 ? ' That could make it late for load-in.' : '';
  s.dilemmas.push({
    id: newId(s, 'dl'),
    kind: 'breakdown',
    title: `${v.name} has broken down`,
    text: `${v.name} is stuck on the hard shoulder on the way to ${gig.act}. The local mechanic reckons ${wait} hours.${late}`,
    options: [
      { id: 'wait', label: 'Wait for the mechanic', detail: `Back on the road in about ${wait}h.` },
      { id: 'recovery', label: 'Call out a recovery truck', detail: 'Moving again within the hour.', cost: recoveryCost(v) },
      { id: 'bodge', label: 'Bodge it and drive on', detail: 'Free and immediate — but the truck will be less reliable.' },
    ],
    defaultOption: 'wait',
    vehicleId: v.id,
    gigId: gig.id,
    createdHour: s.hour,
    expiresHour: v.brokenUntil ?? s.hour,
  });
}

// ---------------------------------------------------------------------------
// Venue: problems at load-in
// ---------------------------------------------------------------------------

type Maker = (s: TycoonState, gig: Gig, rng: Rng) => Omit<Dilemma, 'id' | 'gigId' | 'createdHour' | 'expiresHour'> | null;

const MAKERS: Record<Exclude<DilemmaKind, 'breakdown'>, Maker> = {
  customs: (s, gig) =>
    !gig.overseas
      ? null
      : {
          kind: 'customs',
          title: 'Held at customs',
          text: `The rig for ${gig.act}'s ${getRegion(gig.overseas.regionId).name} is stuck in the customs shed — the carnet paperwork doesn't match the flight cases.`,
          options: [
            { id: 'broker', label: 'Hire a customs broker', detail: 'Cleared by the afternoon, no fuss.', cost: Math.round(gig.fee * 0.03) },
            { id: 'partial', label: 'Release it minus the flagged cases', detail: 'Free, but some kit stays behind: a thinner show.' },
            { id: 'wait', label: 'Sit it out in the shed', detail: 'Free — and the crew lose a day: a rushed, tired show.' },
          ],
          defaultOption: 'wait',
        },
  power: (s, gig) =>
    gig.overseas
      ? null
      : {
          kind: 'power',
          title: 'Undersized power',
          text: `The supply at ${gig.act}'s venue won't carry your rig — the house electrician shrugs.`,
          options: [
            { id: 'generator', label: 'Hire a generator', detail: 'Clean power all night.', cost: Math.round(gig.fee * 0.05) },
            { id: 'house', label: 'Run on house power', detail: 'Free — but expect dimmers to trip and amps to cut out.' },
          ],
          defaultOption: 'house',
        },
  union: (s, gig) =>
    gig.tier < 3 || gig.overseas
      ? null
      : {
          kind: 'union',
          title: 'Union call',
          text: `The local stagehands' union insists on four more hands for ${gig.act}'s load-in.`,
          options: [
            { id: 'hire', label: 'Take the extra hands', detail: 'Everyone stays friends.', cost: 4 * FREELANCE_DAY_RATE * (gig.days ?? 1) },
            { id: 'refuse', label: 'Refuse', detail: 'A slow, sulky load-in — and the town remembers.' },
          ],
          defaultOption: 'refuse',
        },
  manager: (s, gig) =>
    gig.festival || gig.event
      ? null
      : {
          kind: 'manager',
          title: 'The manager wants more',
          text: `${gig.act}'s tour manager wants an extra side-fill and a couple of specials "for the encore".`,
          options: [
            { id: 'pay', label: 'Find it for them', detail: 'A better show and a grateful act.', cost: Math.round(gig.fee * 0.04) },
            { id: 'decline', label: 'Politely decline', detail: 'They won’t forget it.' },
          ],
          defaultOption: 'decline',
        },
  curfew: (s, gig) =>
    gig.overseas
      ? null
      : {
          kind: 'curfew',
          title: 'Hard curfew',
          text: `The council will enforce a strict curfew on ${gig.act}'s show. The act wants to play the full set.`,
          options: [
            { id: 'fine', label: 'Play on and pay the fine', detail: 'Full set, happy crowd.', cost: Math.round(gig.fee * 0.06) },
            { id: 'plug', label: 'Pull the plug on time', detail: 'No fine — but a cut-short show.' },
          ],
          defaultOption: 'plug',
        },
  injury: (s, gig, rng) => {
    const people = s.vehicles.filter(v => v.owner === 'player' && v.orders[0] === gig.id).flatMap(v => aboard(s, v.id));
    if (!people.length) return null;
    const m = rng.pick(people);
    return {
      kind: 'injury',
      title: `${m.name} is hurt`,
      text: `${m.name} has done their back in unloading the truck for ${gig.act}.`,
      options: [
        { id: 'home', label: 'Send them home', detail: 'One less pair of hands tonight.' },
        { id: 'work', label: 'Strap it up and carry on', detail: 'Full crew — but they’ll be wrecked, and the crew notices.' },
      ],
      defaultOption: 'home',
      personId: m.id,
    };
  },
  storm: (s, gig) =>
    !gig.festival
      ? null
      : {
          kind: 'storm',
          title: 'Storm warning',
          text: `The forecasters have a storm warning out for the ${gig.festival.stage} site.`,
          options: [
            { id: 'ballast', label: 'Extra ballast & rain covers', detail: 'Most of the weather bounces off.', cost: Math.round(gig.fee * 0.04) },
            { id: 'chance', label: 'Take the chance', detail: 'It might miss us.' },
          ],
          defaultOption: 'chance',
        },
};
const VENUE_KINDS = Object.keys(MAKERS) as (keyof typeof MAKERS)[];

/** Hourly: at load-in, a booked show you're delivering may throw up a problem. */
export function hourlyCrises(s: TycoonState, rng: Rng) {
  s.gigs.forEach(gig => {
    if (gig.status !== 'booked' || s.hour !== loadInHour(gig)) return;
    if (!s.vehicles.some(v => v.owner === 'player' && v.orders.includes(gig.id))) return;
    if (!rng.chance(gig.overseas ? OVERSEAS_CRISIS_CHANCE : CRISIS_CHANCE(gig.tier))) return;
    // Abroad, the rig crossing a border is the likeliest thing to go wrong.
    const kinds = gig.overseas ? (['customs', 'customs', 'manager', 'injury'] as (keyof typeof MAKERS)[]) : VENUE_KINDS.filter(k => k !== 'storm' && k !== 'customs' || (k === 'storm' && !!gig.festival));
    for (let tries = 0; tries < 3; tries++) {
      const made = MAKERS[rng.pick(kinds)](s, gig, rng);
      if (!made) continue;
      s.dilemmas.push({ ...made, id: newId(s, 'dl'), gigId: gig.id, createdHour: s.hour, expiresHour: Math.max(s.hour + 1, showStartHour(gig) - 1) });
      return;
    }
  });
  // Deadlines: whatever you didn't answer, the do-nothing option happens.
  s.dilemmas
    .filter(d => s.hour >= d.expiresHour)
    .forEach(d => resolveDilemma(s, d.id, d.defaultOption, true));
}

/** Mutating: apply a choice. Returns a line for the toast. */
export function resolveDilemma(s: TycoonState, id: string, optionId: string, auto = false): string | null {
  const d = s.dilemmas.find(x => x.id === id);
  if (!d) return null;
  const option = d.options.find(o => o.id === optionId) ?? d.options.find(o => o.id === d.defaultOption)!;
  s.dilemmas = s.dilemmas.filter(x => x.id !== id);
  const gig = d.gigId ? gigById(s, d.gigId) : undefined;
  const v = d.vehicleId ? s.vehicles.find(x => x.id === d.vehicleId) : undefined;
  if (option.cost) {
    book(s, d.kind === 'breakdown' ? 'servicing' : 'onsite', -option.cost);
    if (v) v.profitThisYear -= option.cost;
  }
  let line = `${d.title}: ${option.label.toLowerCase()}${option.cost ? ` (${money(s, option.cost)})` : ''}.`;
  switch (`${d.kind}:${option.id}`) {
    case 'breakdown:recovery':
      if (v?.status === 'broken') v.brokenUntil = Math.min(v.brokenUntil ?? s.hour, s.hour + 1);
      break;
    case 'breakdown:bodge':
      if (v?.status === 'broken') {
        v.brokenUntil = s.hour;
        v.reliability = Math.max(10, v.reliability - 8);
      }
      break;
    case 'customs:partial':
      if (gig) addMods(gig, { quality: -0.07, failureFactor: 1.15 });
      break;
    case 'customs:wait':
      if (gig) addMods(gig, { quality: -0.05 });
      s.crewMorale = Math.max(0, s.crewMorale - 2);
      break;
    case 'power:house':
      if (gig) addMods(gig, { quality: -0.03, failureFactor: 1.6 });
      break;
    case 'union:refuse':
      if (gig) {
        addMods(gig, { quality: -0.05 });
        s.cityRatings[gig.cityId] = Math.max(0, (s.cityRatings[gig.cityId] ?? 50) - 5);
      }
      break;
    case 'manager:pay':
      if (gig) {
        addMods(gig, { quality: 0.04 });
        s.artistRelations[gig.act] = (s.artistRelations[gig.act] ?? 0) + 1;
      }
      break;
    case 'manager:decline':
      if (gig) s.artistRelations[gig.act] = Math.max(0, (s.artistRelations[gig.act] ?? 0) - 1);
      break;
    case 'curfew:plug':
      if (gig) addMods(gig, { quality: -0.07 });
      break;
    case 'injury:home': {
      const m = s.people.find(p => p.id === d.personId);
      const truck = m?.vehicleId ? s.vehicles.find(x => x.id === m.vehicleId) : undefined;
      const base = truck ? depotInCity(s, truck.homeCityId) : undefined;
      if (m && base) {
        moveToDepot(m, base.id);
        m.fatigue = Math.min(100, m.fatigue + 20);
        syncCrew(s);
        line = `${m.name} is on the train home.`;
      }
      break;
    }
    case 'injury:work': {
      const m = s.people.find(p => p.id === d.personId);
      if (m) m.fatigue = 100;
      s.crewMorale = Math.max(0, s.crewMorale - 3);
      break;
    }
    case 'storm:ballast':
      if (gig) addMods(gig, { stormFactor: 0.35 });
      break;
  }
  if (auto) pushNews(s, `No answer — ${line.charAt(0).toLowerCase()}${line.slice(1)}`, 'info', gig ? { gigId: gig.id, cityId: gig.cityId } : v ? { vehicleId: v.id } : undefined);
  return line;
}
