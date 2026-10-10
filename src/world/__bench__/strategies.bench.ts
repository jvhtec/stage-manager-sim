import { afterAll, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runBot, STRATEGIES, type BotReport } from './bot';
import { renderReport } from './report';
import type { CountryCode } from '../content/countries';

/**
 * Deterministic long-term scenarios: every strategy plays the same countries, start years and
 * seeds, and the results are written up as docs/balance-report.md (and .json).
 *
 *   npm run balance:report
 *   REPORT_RUNS='[["GB",1995],["ES",1990]]' REPORT_SEEDS='[3,4]' REPORT_YEARS=8 REPORT_STRATEGIES=managed,lean npm run balance:report
 */
const RUNS: [CountryCode, number][] = JSON.parse(process.env.REPORT_RUNS ?? '[["GB",1995],["ES",1990]]');
const SEEDS: number[] = JSON.parse(process.env.REPORT_SEEDS ?? '[3,4]');
const YEARS = Number(process.env.REPORT_YEARS ?? 8);
const IDS = (process.env.REPORT_STRATEGIES ?? Object.keys(STRATEGIES).join(',')).split(',').filter(id => STRATEGIES[id]);
const OUT = process.env.REPORT_OUT ?? 'docs/balance-report';

const reports: BotReport[] = [];

IDS.forEach(id => {
  it(`strategy: ${id}`, () => {
    for (const [country, startYear] of RUNS)
      for (const seed of SEEDS) {
        const r = runBot({ country, startYear, years: YEARS, seed, strategy: STRATEGIES[id] });
        reports.push(r);
        console.log(id, country, startYear, seed, r.survived ? 'alive' : 'bust', Math.round(r.value / 1000), 'k');
      }
  });
});

afterAll(() => {
  const md = renderReport(reports, IDS.map(id => STRATEGIES[id]), { years: YEARS, runs: `${RUNS.map(([c, y]) => `${c} ${y}`).join(' and ')}, seeds ${SEEDS.join(', ')}` });
  mkdirSync(OUT.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  writeFileSync(`${OUT}.md`, md);
  writeFileSync(`${OUT}.json`, JSON.stringify(reports, null, 1));
  console.log(`Wrote ${OUT}.md and ${OUT}.json`);
});
