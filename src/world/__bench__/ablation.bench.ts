import { afterAll, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { runBot, STRATEGIES, type BotReport, type Feature, type Strategy } from './bot';
import { renderAblation } from './scenarios';
import { reportsJson } from './report';
import type { CountryCode } from '../content/countries';

/**
 * Management systems, one at a time: the managed company on the same countries and seeds, with
 * each system it uses switched off in turn. Same seed, same world, same offers on day one — so
 * the difference is what that one system was worth (plus whatever chaos it set off).
 *
 *   npm run balance:ablation
 *   ABLATION_RUNS='[["GB",1995]]' ABLATION_SEEDS='[3]' ABLATION_YEARS=6 npm run balance:ablation
 */
const RUNS: [CountryCode, number][] = JSON.parse(process.env.ABLATION_RUNS ?? '[["GB",1995],["ES",1990]]');
const SEEDS: number[] = JSON.parse(process.env.ABLATION_SEEDS ?? '[3,4,5]');
const YEARS = Number(process.env.ABLATION_YEARS ?? 8);
const OUT = process.env.ABLATION_OUT ?? 'docs/balance-ablation';

/** The systems a manager runs (bot.ts features), each switched off on its own, then all at once. */
export const SYSTEMS: { id: Feature; label: string }[] = [
  { id: 'terms', label: 'Contract terms (deposits, cancellation clauses)' },
  { id: 'crew', label: 'Crew politics (keeping feuds apart)' },
  { id: 'heads', label: 'Department heads' },
  { id: 'cash', label: 'Cash-flow forecast' },
  { id: 'learn', label: 'Learning from post-mortems (workshop)' },
  { id: 'maintain', label: 'Refurbishing worn kit' },
  { id: 'riders', label: 'Riders and room fixes' },
  { id: 'replan', label: 'Re-planning around trucks off the road' },
];

const base = STRATEGIES.managed;
const without = (ids: Feature[], id: string, label: string): Strategy => ({ ...base, id, label, features: base.features.filter(f => !ids.includes(f)) });
const VARIANTS: Strategy[] = [base, ...SYSTEMS.map(x => without([x.id], `no-${x.id}`, `without ${x.label}`)), without(SYSTEMS.map(x => x.id), 'none', 'with none of them')];

const reports: BotReport[] = [];
VARIANTS.forEach(v => {
  it(`variant: ${v.id}`, () => {
    for (const [country, startYear] of RUNS)
      for (const seed of SEEDS) {
        const r = runBot({ country, startYear, years: YEARS, seed, strategy: v });
        reports.push(r);
        console.log(v.id, country, startYear, seed, r.survived ? 'alive' : 'bust', Math.round(r.value / 1000), 'k');
      }
  });
});

afterAll(() => {
  const md = renderAblation(reports, VARIANTS, SYSTEMS, { years: YEARS, runs: `${RUNS.map(([c, y]) => `${c} ${y}`).join(' and ')}, seeds ${SEEDS.join(', ')}` });
  mkdirSync(OUT.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  writeFileSync(`${OUT}.md`, md);
  writeFileSync(`${OUT}.json`, reportsJson(reports));
  console.log(`Wrote ${OUT}.md and ${OUT}.json`);
});
