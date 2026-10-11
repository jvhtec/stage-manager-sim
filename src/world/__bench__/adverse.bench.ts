import { afterAll, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runBot, STRATEGIES, type BotReport } from './bot';
import { renderAdverse } from './scenarios';
import { reportsJson } from './report';
import type { ShockKind } from '../shocks';
import type { CountryCode } from '../content/countries';

/**
 * Deliberately bad years: an established company loses its biggest client, has its fleet recalled,
 * hits a downturn, and gets paid late — one at a time, then all at once — compared with the same
 * seed left alone.
 *
 *   npm run balance:adverse
 *   ADVERSE_RUNS='[["GB",1995]]' ADVERSE_SEEDS='[3]' ADVERSE_STRATEGIES=managed npm run balance:adverse
 */
const RUNS: [CountryCode, number][] = JSON.parse(process.env.ADVERSE_RUNS ?? '[["GB",1995],["ES",1990]]');
const SEEDS: number[] = JSON.parse(process.env.ADVERSE_SEEDS ?? '[3,4,5]');
const YEARS = Number(process.env.ADVERSE_YEARS ?? 8);
const SHOCK_DAY = Number(process.env.ADVERSE_DAY ?? 365 * 4 + 120);
const IDS = (process.env.ADVERSE_STRATEGIES ?? 'managed,lean').split(',').filter(id => STRATEGIES[id]);
const OUT = process.env.ADVERSE_OUT ?? 'docs/balance-adverse';

const KINDS: ShockKind[] = ['lose-client', 'recall', 'downturn', 'late-payers'];
const SCENARIOS: { id: string; shocks: { kind: ShockKind; day: number }[] }[] = [
  { id: 'control', shocks: [] },
  ...KINDS.map(kind => ({ id: kind, shocks: [{ kind, day: SHOCK_DAY }] })),
  { id: 'all', shocks: KINDS.map((kind, i) => ({ kind, day: SHOCK_DAY + i * 20 })) },
];

const reports: BotReport[] = [];
IDS.forEach(id =>
  SCENARIOS.forEach(sc => {
    it(`${id}: ${sc.id}`, () => {
      for (const [country, startYear] of RUNS)
        for (const seed of SEEDS) {
          const r = runBot({ country, startYear, years: YEARS, seed, strategy: STRATEGIES[id], shocks: sc.shocks });
          reports.push(r);
          console.log(id, sc.id, country, startYear, seed, r.survived ? 'alive' : 'bust', Math.round(r.value / 1000), 'k', r.shockLog.map(x => x.what).join('; '));
        }
    });
  }),
);

afterAll(() => {
  const md = renderAdverse(reports, IDS.map(id => STRATEGIES[id]), { years: YEARS, runs: `${RUNS.map(([c, y]) => `${c} ${y}`).join(' and ')}, seeds ${SEEDS.join(', ')}`, shockDay: SHOCK_DAY });
  mkdirSync(OUT.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  writeFileSync(`${OUT}.md`, md);
  writeFileSync(`${OUT}.json`, reportsJson(reports));
  console.log(`Wrote ${OUT}.md and ${OUT}.json`);
});
