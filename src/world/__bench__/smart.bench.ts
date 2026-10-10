import { it } from 'vitest';
import { runBot, STRATEGIES } from './bot';
import { explain } from './report';
import type { CountryCode } from '../content/countries';

const RUNS: [CountryCode, number, number][] = JSON.parse(process.env.BOT_RUNS ?? '[["GB",1995,9]]');
const SEED = Number(process.env.BOT_SEED ?? 3);
const STRATEGY = STRATEGIES[process.env.STRATEGY ?? 'managed'] ?? STRATEGIES.managed;

/**
 * One strategy, a few runs, printed: a RES line per run and the explanation.
 *
 *   BOT_RUNS='[["GB",1995,9]]' BOT_SEED=3 STRATEGY=managed npm run balance
 *
 * Strategies: baseline, managed, premium, lean, reckless (bot.ts). For the full comparison
 * report across strategies and seeds, `npm run balance:report`.
 */
it('smart bot', () => {
  for (const [country, startYear, years] of RUNS) {
    const r = runBot({ country, startYear, years, seed: SEED, strategy: STRATEGY });
    console.log(
      'RES',
      JSON.stringify({ country, startYear, seed: SEED, strategy: r.strategy, alive: r.survived, value: Math.round(r.value / 1000), cash: Math.round(r.cash / 1000), rep: r.reputation, shows: r.shows, failed: r.failed, quality: r.avgQuality, fleet: r.fleet, crew: r.crew, invariants: r.invariantViolations.length }),
    );
    explain(r).forEach(l => console.log('  ·', l));
  }
});
