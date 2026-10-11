/**
 * How the rivals play: simulation tuning, not history. A strategy is a set of small nudges on
 * decisions a rival already makes — how hard it chases offers and how far from home, what it spends
 * meeting a rider, when it reinvests, whether it brings a subcontracted department in-house, starts
 * price wars or buys struggling firms.
 *
 * Strategy eras are attached to a company and a span of years, never to a person: a firm can change
 * how it plays when its business changes (Espiral moving to Madrid institutional work, Fluge going
 * from a sound company to an integrated one), and a documented leader (content/people.ts) is shown
 * and reported without being turned into a personality stat. Each era carries the documented
 * behaviour it was read from.
 */
import type { Rng } from '@/lib/rng';
import type { Rival } from './types';

export type StrategyId =
  | 'pioneer'
  | 'perfectionist'
  | 'expansionist'
  | 'dealmaker'
  | 'prudent'
  | 'hustler'
  | 'specialist'
  | 'regional'
  | 'integrator';

export interface StrategyTraits {
  label: string;
  /** One line for the League window. */
  blurb: string;
  /** Chance of going for an offer (×). */
  take: number;
  /** Chance of going for work far from home (×, on top of distance). Below 1 keeps it local. */
  far: number;
  /** Cash cushion, in months of overhead, before it reinvests (3 = the default). */
  reinvest: number;
  /** Kit currency it aims for, relative to the era's norm for its tier. */
  quality: number;
  /** How far it'll stretch (× RIVAL_FIX_LIMIT) to meet a rider or a room. */
  fix: number;
  /** Yearly chance it brings a department it keeps subcontracting in-house. */
  diversify: number;
  /** Weight as the instigator of a price war. */
  war: number;
  /** Weight as a buyer when a struggling firm is up for grabs. */
  buyer: number;
  /** Added to its grudge (rivalry aggression). */
  grudge: number;
  /** Chance of stepping up a tier when its name allows (×). */
  growth: number;
}

const T = (t: StrategyTraits) => t;

export const STEADY = T({ label: 'Steady', blurb: 'Runs the business like most do.', take: 1, far: 1, reinvest: 3, quality: 0, fix: 1, diversify: 0.12, war: 1, buyer: 1, grudge: 0, growth: 1 });

export const STRATEGIES: Record<StrategyId, StrategyTraits> = {
  pioneer: T({ label: 'Pioneer', blurb: 'Builds its own kit or is first with the new technology; reinvests early.', take: 1, far: 1, reinvest: 2.5, quality: 0.5, fix: 1.25, diversify: 0.2, war: 0.6, buyer: 0.8, grudge: 0, growth: 1.2 }),
  perfectionist: T({ label: 'Perfectionist', blurb: 'Picky about work, never short on a rider, rarely fights on price.', take: 0.85, far: 1, reinvest: 2.5, quality: 0.7, fix: 1.5, diversify: 0.08, war: 0.4, buyer: 0.7, grudge: -0.1, growth: 0.9 }),
  expansionist: T({ label: 'Expansionist', blurb: 'Chases every job and every new town; quick to undercut.', take: 1.2, far: 1.3, reinvest: 2, quality: 0, fix: 1, diversify: 0.35, war: 1.4, buyer: 1.6, grudge: 0.1, growth: 1.5 }),
  dealmaker: T({ label: 'Consolidator', blurb: 'Grows by buying other firms rather than by fighting them.', take: 1.05, far: 1.1, reinvest: 3, quality: 0, fix: 1, diversify: 0.25, war: 0.8, buyer: 2.2, grudge: 0, growth: 1.1 }),
  prudent: T({ label: 'Prudent', blurb: 'Keeps cash in the bank and takes only what it can do well.', take: 0.95, far: 0.85, reinvest: 4.5, quality: -0.2, fix: 0.8, diversify: 0.05, war: 0.5, buyer: 0.8, grudge: -0.15, growth: 0.8 }),
  hustler: T({ label: 'Hustler', blurb: 'Cheap, fast and everywhere; cuts corners and holds grudges.', take: 1.25, far: 1.1, reinvest: 3, quality: -0.3, fix: 0.7, diversify: 0.12, war: 1.8, buyer: 1, grudge: 0.2, growth: 1.1 }),
  specialist: T({ label: 'Specialist', blurb: 'Sticks to its own department and does it well; others subcontract to it.', take: 1, far: 1, reinvest: 3, quality: 0.3, fix: 1.1, diversify: 0, war: 0.6, buyer: 0.6, grudge: 0, growth: 0.9 }),
  regional: T({ label: 'Regional', blurb: 'Lives off its own patch — councils, fiestas, local promoters — and rarely strays.', take: 1.05, far: 0.55, reinvest: 3.5, quality: -0.1, fix: 0.9, diversify: 0.1, war: 0.7, buyer: 0.7, grudge: 0.05, growth: 0.7 }),
  integrator: T({ label: 'Integrator', blurb: 'Subcontracts what it lacks, then brings it in-house: sound, then light, then video.', take: 1.1, far: 1.1, reinvest: 2.5, quality: 0.1, fix: 1.1, diversify: 0.5, war: 0.9, buyer: 1.3, grudge: 0, growth: 1.2 }),
};

export interface StrategyEra {
  actor: string;
  from: number;
  to?: number;
  strategy: StrategyId;
  /** The documented behaviour this reading is based on. */
  basis: string;
}

const E = (actor: string, from: number, strategy: StrategyId, basis: string, to?: number): StrategyEra => ({ actor, from, to, strategy, basis });

export const STRATEGY_ERAS: StrategyEra[] = [
  // International / US
  E('clair', 1966, 'pioneer', 'first flown arena PA, the S4 cabinet', 1994),
  E('clair', 1995, 'dealmaker', 'grew by buying Showco, Britannia Row, Black Box, Eighth Day and others, keeping their names'),
  E('prg', 1983, 'dealmaker', 'a roll-up of rental houses from a single New York base'),
  E('solotech', 2007, 'pioneer', 'founded by the Montreal Olympics sound man', 2016),
  E('solotech', 2017, 'expansionist', 'an acquisition-led push into Britain and the US'),
  E('tycobrahe', 1969, 'pioneer', 'designed its own consoles and amplifiers'),
  E('showco', 1970, 'perfectionist', 'in-house desks and systems for Led Zeppelin and Genesis', 1980),
  E('showco', 1981, 'pioneer', 'its R&D became Vari-Lite'),
  E('soundimage', 1971, 'pioneer', 'ten patents, composite cabinets', 1980),
  E('soundimage', 1981, 'perfectionist', '"never missed a truck, a load-in or a show"'),
  E('bandit', 1968, 'pioneer', 'early onto LED rigs', 2007),
  E('bandit', 2008, 'prudent', 'paid staff health cover through the recession'),
  E('upstaging', 1972, 'prudent', 'a family firm that promotes from within'),
  E('thunder', 1978, 'prudent', 'a bootstrapped family business growing step by step'),
  E('firehouse', 1994, 'perfectionist', 'a monitor specialist, hands-on in every system design'),
  E('christie', 1998, 'expansionist', 'one standard kit list in every branch, opened town by town'),
  // Britain
  E('martinaudio', 1971, 'perfectionist', 'a brilliant horn designer, "no businessman"'),
  E('britrow', 1975, 'pioneer', 'Pink Floyd\'s own rig, hired out', 1983),
  E('britrow', 1984, 'perfectionist', '"you\'re only as good as your last show"; long staff loyalty', 2016),
  E('britrow', 2017, 'dealmaker', 'Clair-owned; bought Skan'),
  E('lsd', 1975, 'pioneer', 'its R&D built the Icon moving light', 1997),
  E('lsd', 1998, 'dealmaker', 'part of PRG'),
  E('sse', 1976, 'dealmaker', 'built Britain\'s biggest audio group by buying Canegreen, Wigwam and Capital', 2017),
  E('sse', 2018, 'expansionist', 'Solotech\'s British arm'),
  E('negearth', 1983, 'prudent', 'family-run and independent'),
  E('adlib', 1984, 'prudent', 'independent, "agile", founder still mixing front of house'),
  E('ct', 1986, 'pioneer', 'early into LED screens'),
  E('delta', 1988, 'expansionist', 'from corporate shows to a Dubai office'),
  E('skan', 1996, 'perfectionist', 'run on service'),
  E('22live', 2022, 'expansionist', 'a start-up of SSE veterans'),
  // Spain
  E('milan', 1976, 'perfectionist', 'a big electronics repair workshop behind the hire fleet', 1999),
  E('milan', 2000, 'prudent', 'branched into installation and service with Milán Miscelánea'),
  E('espiral', 1982, 'pioneer', 'telecom engineers who built amplifiers; its people founded Altair, AEQ and others', 1999),
  E('espiral', 2000, 'regional', 'concentrated on Madrid venues and institutions'),
  E('valladar', 1980, 'specialist', 'stages, barriers, grandstands and towers only'),
  E('berenice', 1986, 'perfectionist', 'a Madrid concert-sound house that trained engineers later found at Meyer and Twin Cam'),
  E('sorter', 1986, 'pioneer', 'founded by musicians on self-built systems', 1996),
  E('sorter', 1997, 'perfectionist', 'heavy investment in EAW, then L-Acoustics'),
  E('cinelux', 1988, 'specialist', 'lighting for TV, theatre and events'),
  E('fluge', 1990, 'integrator', 'a sound company that used outside lighting firms, then brought lighting and video in-house'),
  E('tri', 1995, 'specialist', 'stages, roofs and qualified riggers'),
  E('eml', 2006, 'integrator', 'a foreign group\'s full-service Madrid subsidiary', 2010),
  E('eml', 2011, 'expansionist', 'PRG\'s Spanish platform: Mad Cool main stages by 2016'),
  E('twincam', 1979, 'pioneer', 'Meyer importer, then each new L-Acoustics generation'),
  E('arcoiris', 1983, 'specialist', 'a dedicated lighting rental house', 2004),
  E('arcoiris', 2005, 'integrator', 'broadened into sound and production'),
  E('sono', 1972, 'specialist', 'corporate and institutional AV, a training ground for the sector'),
  E('dushowes', 2005, 'expansionist', 'a French group\'s Spanish arm'),
  E('pronorte', 1985, 'prudent', 'workshop, repeat clients and one brand of box'),
  E('megafer', 1980, 'regional', 'two people serving Ferrol\'s councils and fiestas', 1994),
  E('megafer', 1995, 'regional', 'the founder\'s son broadens into lighting, video and stages, still at home'),
  E('emsac', 1993, 'integrator', 'sound, lighting and structures under one roof'),
  E('swing', 1987, 'regional', 'Valladolid production with national touring'),
  E('use', 1993, 'regional', 'a family firm', 2013),
  E('use', 2014, 'perfectionist', 'bought a premium Meyer LYON system for national tours'),
  E('realaudio', 2008, 'regional', 'a small Valladolid family firm'),
  E('soinua', 1990, 'regional', 'Basque live production'),
  E('ingunza', 2008, 'regional', 'Bilbao council festival work'),
  E('sonorock', 1992, 'regional', 'Andalusian touring sound'),
  E('ojeda', 1992, 'regional', 'Cádiz events and fiestas'),
  E('apogee', 1993, 'integrator', 'sound, light, video, rental and repair'),
  E('tcm', 1994, 'integrator', 'an Andalusian sound, light and video cluster'),
  E('tole', 2007, 'pioneer', 'bought a bigger system to move up'),
  E('efectes', 1981, 'specialist', 'Mallorca lighting'),
  E('balearacustic', 1990, 'regional', 'Mallorca\'s all-in event supplier'),
  // France / Germany / Italy
  E('novelty', 1982, 'dealmaker', 'about seventy companies bought along the way'),
  E('melpomen', 1985, 'perfectionist', 'a decade on the road with Royal de Luxe'),
  E('dushow', 1982, 'expansionist', 'Paris, Nice, Marseille, then Barcelona'),
  E('mes', 1981, 'specialist', 'theatre and event lighting in western France'),
  E('nmueller', 1981, 'prudent', 'independent, growing a branch at a time'),
  E('gb', 1983, 'pioneer', 'built its own monitors and video walls; its own academy'),
  E('blackbox', 1985, 'perfectionist', 'one campus for everything a tour needs'),
  E('procon', 1988, 'pioneer', 'computer-controlled lighting', 1998),
  E('procon', 1999, 'dealmaker', 'a listed group buying video, camera, audio and staging firms'),
  E('lightpower', 1978, 'pioneer', 'introduced new lighting products to the trade'),
  E('amptown', 1990, 'prudent', 'founder-led, a whole-system approach'),
  E('niclen', 1992, 'hustler', 'Germany\'s biggest dry-hire house, on volume and price'),
  E('satisfy', 1993, 'integrator', 'one-stop full service through a single project lead'),
  E('feedback', 1996, 'pioneer', 'first in Germany with Turbosound Flashline'),
  E('agora', 1990, 'expansionist', 'from Bocelli tours to Olympic ceremonies'),
  E('mixer', 1986, 'pioneer', 'among the first in Italy with moving lights'),
  E('sts', 1984, 'integrator', 'congress kit, then trade shows, TV and concerts'),
  E('euphon', 2003, 'dealmaker', 'a listed group with stakes in Sono and Deltatre'),
];

const STARTUP: StrategyId[] = ['hustler', 'expansionist', 'prudent', 'pioneer', 'regional', 'specialist'];
const hash = (str: string) => [...str].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);
const HISTORIC = new Set(STRATEGY_ERAS.map(e => e.actor));

export function strategyEraOf(actorId: string, year: number): StrategyEra | undefined {
  const era = STRATEGY_ERAS.filter(e => e.actor === actorId && e.from <= year).pop();
  return era && (era.to === undefined || year <= era.to) ? era : undefined;
}

/** How this rival plays this year. Start-ups get a strategy of their own, stable per firm. */
export function strategyIdOf(r: Pick<Rival, 'id'>, year: number): StrategyId | undefined {
  const era = strategyEraOf(r.id, year);
  if (era) return era.strategy;
  if (HISTORIC.has(r.id) || r.id.length < 3 || !r.id.startsWith('rival')) return undefined;
  return STARTUP[hash(r.id) % STARTUP.length];
}

export const styleOf = (r: Pick<Rival, 'id'>, year: number): StrategyTraits => {
  const id = strategyIdOf(r, year);
  return id ? STRATEGIES[id] : STEADY;
};

/** Pick one item with chance proportional to its weight. */
export function pickWeighted<T>(rng: Rng, items: readonly T[], weight: (t: T) => number): T | undefined {
  const total = items.reduce((n, t) => n + Math.max(0, weight(t)), 0);
  if (!(total > 0)) return undefined;
  let roll = rng.next() * total;
  for (const t of items) {
    roll -= Math.max(0, weight(t));
    if (roll < 0) return t;
  }
  return items[items.length - 1];
}
