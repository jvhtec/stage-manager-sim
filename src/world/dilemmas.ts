/**
 * Things that need a decision. A truck breaks down with a show at stake, the
 * venue's power is undersized, the local union wants more hands, the act's
 * manager asks for extras… Each one pops up with a few choices and a
 * deadline; ignore it and the do-nothing option happens.
 *
 * Venue choices don't play out until the show: they're kept on the gig as
 * `mods` and folded into the night's quality, failure risk and weather.
 */
import { difficultyOf } from './scenario';
import type { Rng } from '@/lib/rng';
import { getModel } from './catalog';
import { book, depotInCity, formatMoney, gigById, loadInHour, newId, pushNews, showStartHour } from './core';
import { FREELANCE_DAY_RATE, PAY } from './crew';
import { aboard, dayRate, moveToDepot, roleOf, syncCrew } from './people';
import { getRegion } from './content/world';
import { attendShow } from './marketing';
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

const MAKERS: Record<Exclude<DilemmaKind, 'breakdown' | 'raise' | 'burnout' | 'tradeshow' | 'pricewar' | 'shareholders'>, Maker> = {
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
    if (!rng.chance((gig.overseas ? OVERSEAS_CRISIS_CHANCE : CRISIS_CHANCE(gig.tier)) * difficultyOf(s).crises)) return;
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

// ---------------------------------------------------------------------------
// Crew: people on the road have their own problems
// ---------------------------------------------------------------------------

/** Daily chance, per star on the road, that they ask for more. Likelier when morale is low. */
export const RAISE_CHANCE = 0.012;
/** Daily chance an exhausted tech on the road hits the wall. */
export const BURNOUT_CHANCE = 0.04;
export const RAISE_BUMP = 1.15;
const RAISE_STARS = 3;
const BURNOUT_FATIGUE = 75;

/** Daily: stars on the road ask for a raise; the exhausted burn out. Each person has at most one open question. */
export function dailyCrewDilemmas(s: TycoonState, rng: Rng, morale: number) {
  const open = new Set(s.dilemmas.map(d => d.personId).filter(Boolean));
  const unhappy = 1 + Math.max(0, (70 - morale) / 25);
  s.people.forEach(m => {
    if (!m.vehicleId || open.has(m.id)) return;
    const v = s.vehicles.find(x => x.id === m.vehicleId);
    const gig = v?.orders.map(id => gigById(s, id)).find(g => g && g.status === 'booked');
    if (!v || !gig) return;
    const level = Math.floor(m.skills[m.primary]);
    const wage = Math.round(dayRate(m) * PAY[s.policies.pay].wage);
    if (m.fatigue >= BURNOUT_FATIGUE && rng.chance(BURNOUT_CHANCE)) {
      s.dilemmas.push({
        id: newId(s, 'dl'),
        kind: 'burnout',
        title: `${m.name} has hit the wall`,
        text: `${m.name} has been on the road too long and can barely stand at the desk. ${gig.act} is the next show.`,
        options: [
          { id: 'rest', label: 'Send them home to rest', detail: 'Off the tour; back at base they’ll recover.' },
          { id: 'push', label: 'They’ll push through', detail: 'They play on — a rougher show, and the crew grumbles.' },
        ],
        defaultOption: 'rest',
        gigId: gig.id,
        vehicleId: v.id,
        personId: m.id,
        createdHour: s.hour,
        expiresHour: s.hour + 18,
      });
      open.add(m.id);
      return;
    }
    if (level >= RAISE_STARS && (m.loyalUntil ?? 0) <= s.hour && rng.chance(RAISE_CHANCE * unhappy)) {
      s.dilemmas.push({
        id: newId(s, 'dl'),
        kind: 'raise',
        title: `${m.name} wants more`,
        text: `${m.name}, your ${level}★ ${roleOf(m)}, says other firms are calling and wants better pay — or they walk at the next stop.`,
        options: [
          { id: 'raise', label: `A ${Math.round((RAISE_BUMP - 1) * 100)}% raise`, detail: `Costs ${money(s, Math.round(wage * (RAISE_BUMP - 1)))}/day for good, and they’ll turn rivals down for six months.` },
          { id: 'bonus', label: 'A one-off bonus', detail: 'Twelve days’ pay now; they stay for a couple of months, then ask again.', cost: wage * 12 },
          { id: 'refuse', label: 'Call their bluff', detail: 'They walk. Free — and a gap in the crew.' },
        ],
        defaultOption: 'bonus',
        gigId: gig.id,
        vehicleId: v.id,
        personId: m.id,
        createdHour: s.hour,
        expiresHour: s.hour + 24,
      });
      open.add(m.id);
    }
  });
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
    book(s, d.kind === 'breakdown' ? 'servicing' : d.kind === 'tradeshow' || d.kind === 'pricewar' ? 'marketing' : d.kind === 'shareholders' ? 'equity' : 'onsite', -option.cost);
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
    case 'raise:raise': {
      const m = s.people.find(p => p.id === d.personId);
      if (m) {
        m.payBump = Math.round((m.payBump ?? 1) * RAISE_BUMP * 100) / 100;
        m.loyalUntil = s.hour + 24 * 180;
        line = `${m.name} gets the raise and stays.`;
      }
      break;
    }
    case 'raise:bonus': {
      const m = s.people.find(p => p.id === d.personId);
      if (m) {
        m.loyalUntil = s.hour + 24 * 60;
        line = `${m.name} pockets the bonus and stays — for now.`;
      }
      break;
    }
    case 'raise:refuse': {
      const m = s.people.find(p => p.id === d.personId);
      if (m) {
        s.people = s.people.filter(p => p.id !== m.id);
        s.poachBids = s.poachBids.filter(b => b.personId !== m.id);
        syncCrew(s);
        line = `${m.name} walks off the tour.`;
        pushNews(s, `${m.name} quit mid-tour over pay. The crew are a person short.`, 'bad', v ? { vehicleId: v.id } : undefined);
      }
      break;
    }
    case 'burnout:rest': {
      const m = s.people.find(p => p.id === d.personId);
      const base = v ? depotInCity(s, v.homeCityId) : undefined;
      if (m && base) {
        moveToDepot(m, base.id);
        syncCrew(s);
        line = `${m.name} is on the train home to rest.`;
      }
      break;
    }
    case 'burnout:push': {
      const m = s.people.find(p => p.id === d.personId);
      if (m) m.fatigue = 100;
      if (gig) addMods(gig, { quality: -0.03 });
      s.crewMorale = Math.max(0, s.crewMorale - 2);
      break;
    }
    case 'shareholders:appease':
      if (s.listing) s.listing.confidence = Math.min(100, s.listing.confidence + 25);
      break;
    case 'shareholders:stand':
      if (s.listing) s.listing.confidence = Math.max(0, s.listing.confidence - 10);
      s.company.reputation = Math.max(0, s.company.reputation - 2);
      break;
    case 'pricewar:fight': {
      const war = s.priceWars.find(w => w.id === d.payload);
      if (war) war.fight = true;
      break;
    }
    case 'pricewar:truce': {
      const war = s.priceWars.find(w => w.id === d.payload);
      s.priceWars = s.priceWars.filter(w => w.id !== d.payload);
      const rival = s.rivals.find(r => r.id === war?.rivalId);
      if (rival) rival.reputation = Math.min(100, rival.reputation + 1);
      break;
    }
    case 'tradeshow:stand':
      attendShow(s, d.payload ?? '', 'stand');
      break;
    case 'tradeshow:visit':
      attendShow(s, d.payload ?? '', 'visit');
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
