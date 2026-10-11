import { afterAll, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runBot, STRATEGIES, type BotReport } from './bot';
import { renderDecades, yearly } from './scenarios';
import { reportsJson } from './report';
import type { ShockKind } from '../shocks';
import type { CountryCode } from '../content/countries';

/**
 * Thirty years of reputation: does it climb, plateau, fall and come back? Each run is played
 * clean and again with everything going wrong at once a decade in.
 *
 *   npm run balance:decades
 *   DECADES_RUNS='[["GB",1980]]' DECADES_SEEDS='[3]' DECADES_YEARS=30 npm run balance:decades
 */
const RUNS: [CountryCode, number][] = JSON.parse(process.env.DECADES_RUNS ?? '[["GB",1980],["ES",1980]]');
const SEEDS: number[] = JSON.parse(process.env.DECADES_SEEDS ?? '[3,4]');
const YEARS = Number(process.env.DECADES_YEARS ?? 30);
const SHOCK_YEAR = Number(process.env.DECADES_SHOCK_YEAR ?? 10);
const IDS = (process.env.DECADES_STRATEGIES ?? 'managed').split(',').filter(id => STRATEGIES[id]);
const OUT = process.env.DECADES_OUT ?? 'docs/balance-decades';

const KINDS: ShockKind[] = ['lose-client', 'recall', 'downturn', 'late-payers'];
const reports: BotReport[] = [];
IDS.forEach(id =>
  [false, true].forEach(shocked => {
    it(`${id}${shocked ? ' shocked' : ''}`, () => {
      for (const [country, startYear] of RUNS)
        for (const seed of SEEDS) {
          const shocks = shocked ? KINDS.map((kind, i) => ({ kind, day: 365 * SHOCK_YEAR + 60 + i * 20 })) : [];
          const r = runBot({ country, startYear, years: YEARS, seed, strategy: STRATEGIES[id], shocks });
          reports.push(r);
          console.log(id, shocked ? 'shocked' : 'clean', country, startYear, seed, r.survived ? 'alive' : 'bust', 'rep', yearly(r.series).map(y => Math.round(y.reputation)).join(','));
        }
    });
  }),
);

afterAll(() => {
  const md = renderDecades(reports, { years: YEARS, runs: `${RUNS.map(([c, y]) => `${c} ${y}`).join(' and ')}, seeds ${SEEDS.join(', ')}, ${IDS.join(', ')}`, shockYear: SHOCK_YEAR });
  mkdirSync(OUT.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  writeFileSync(`${OUT}.md`, md);
  writeFileSync(`${OUT}.json`, reportsJson(reports));
  console.log(`Wrote ${OUT}.md and ${OUT}.json`);
});
