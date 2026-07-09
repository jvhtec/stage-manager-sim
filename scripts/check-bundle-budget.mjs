#!/usr/bin/env node
// Fails the build if dist/assets/*.js grows past a budget. Run after
// `npm run build` / `npm run build:pages`. See docs/game-feel-plan.md
// workstream G — code-splitting only pays off if regressions get caught.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ASSETS_DIR = join(process.cwd(), 'dist', 'assets');
// Raw (pre-gzip) budget in KB. Current total is ~1000KB after the PR 1
// code-split; this leaves headroom for the game-feel plan's remaining
// workstreams (avatars, scene, map) before it needs raising again.
const TOTAL_BUDGET_KB = 1400;
// No single chunk should silently balloon past this without a deliberate
// decision (e.g. adding framer-motion in PR 2 should bump this, not blow
// through it unnoticed).
const CHUNK_BUDGET_KB = 500;

let files;
try {
  files = readdirSync(ASSETS_DIR).filter(f => f.endsWith('.js'));
} catch {
  console.error(`Could not read ${ASSETS_DIR} — did the build run first?`);
  process.exit(1);
}

const sizesKb = files.map(f => ({
  file: f,
  kb: Math.round(statSync(join(ASSETS_DIR, f)).size / 1024),
}));

const totalKb = sizesKb.reduce((sum, entry) => sum + entry.kb, 0);
const oversizedChunks = sizesKb.filter(entry => entry.kb > CHUNK_BUDGET_KB);

console.log(`Bundle: ${totalKb}KB total across ${files.length} JS chunks (budget: ${TOTAL_BUDGET_KB}KB)`);
sizesKb
  .sort((a, b) => b.kb - a.kb)
  .slice(0, 5)
  .forEach(entry => console.log(`  ${entry.kb}KB  ${entry.file}`));

let failed = false;

if (totalKb > TOTAL_BUDGET_KB) {
  console.error(`\nTotal JS bundle (${totalKb}KB) exceeds the ${TOTAL_BUDGET_KB}KB budget.`);
  failed = true;
}

if (oversizedChunks.length > 0) {
  console.error(`\nChunk(s) exceed the ${CHUNK_BUDGET_KB}KB per-chunk budget:`);
  oversizedChunks.forEach(entry => console.error(`  ${entry.kb}KB  ${entry.file}`));
  failed = true;
}

if (failed) {
  console.error('\nIf this growth is deliberate, raise the budget in scripts/check-bundle-budget.mjs with a comment explaining why.');
  process.exit(1);
}

console.log('Bundle budget OK.');
