/**
 * Turning a bot run into an explanation: where the money came from and went, why shows went
 * wrong, how close the company came to running dry, what its clients and crew did, and how the
 * rivals fared under the same rules. `explain` gives the findings for one run; `renderReport`
 * lays out a comparison of strategies as markdown.
 */
import { LEDGER_LABELS, type LedgerCategory } from '../types';
import type { BotReport, Strategy } from './bot';

const CAUSES: Record<string, string> = {
  'unpaid-invoices': 'money tied up in unpaid invoices',
  overdrawn: 'an overdraft',
  loan: 'debt service',
  'thin-cash': 'thin cash',
  'losing-trucks': 'trucks losing money',
  overdue: 'services put off',
  old: 'trucks past their working life',
  worn: 'worn-out trucks',
  winter: 'winter roads',
  'bad-luck': 'bad luck',
  breakdown: 'a truck breaking down on the way',
  'no-show': 'nobody arriving',
  late: 'late load-ins',
  'kit-failed': 'kit dying on stage',
  'kit-worn': 'tired kit',
  'short-crew': 'short-handed crews',
  'tired-crew': 'exhausted crews',
  prep: 'kit left behind',
  unrehearsed: 'no rehearsal',
  tickets: 'uncertified crew',
  venue: 'venue limits',
  rider: 'broken technical riders',
  room: 'rigs that didn’t fit the room',
  feud: 'crew at loggerheads',
  'slow-load': 'slow load-ins',
  'change-hour': 'unpaid extra hours',
  'change-kit': 'unpaid extra kit',
  'change-early': 'rushed load-ins for early soundchecks',
  'client-cancel': 'clients cancelling',
  terms: 'cancellation clauses paying out',
  'no-terms': 'cancellations with no clause',
  disaster: 'shows falling apart',
  'no-goodwill': 'no goodwill with the promoter',
  'rider-twice': 'repeat rider breaches',
  'brand-fault': 'manufacturer faults',
  standardised: 'all eggs in one brand',
};
const label = (k: string) => CAUSES[k] ?? k;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const k = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : `${Math.round(n / 1000)}k`);

/** The show-side causes: what went wrong on the night. */
const NIGHT = ['late', 'kit-failed', 'kit-worn', 'short-crew', 'tired-crew', 'prep', 'unrehearsed', 'tickets', 'venue', 'rider', 'room', 'feud', 'slow-load', 'breakdown', 'no-show', 'change-hour', 'change-kit', 'change-early'];

export function explain(r: BotReport): string[] {
  const out: string[] = [];
  const margin = r.revenue ? (r.revenue - r.costs) / r.revenue : 0;
  out.push(r.survived ? `Survived ${r.yearsRun} years, worth ${k(r.value)} (reputation ${r.reputation}).` : `Went under after ${r.yearsRun} years: ${r.gameOver}`);
  // Money.
  const ledger = Object.entries(r.ledger) as [LedgerCategory, number][];
  const income = ledger.filter(([c, v]) => v > 0 && c !== 'equity' && c !== 'sales').sort((a, b) => b[1] - a[1]);
  const spend = ledger.filter(([, v]) => v < 0).sort((a, b) => a[1] - b[1]);
  if (r.revenue) {
    out.push(`Earned ${k(r.revenue)}: ${income.slice(0, 3).map(([c, v]) => `${LEDGER_LABELS[c].toLowerCase()} ${pct(v / r.revenue)}`).join(', ')}.`);
    out.push(`Operating margin ${pct(margin)}. Biggest costs as a share of revenue: ${spend.slice(0, 4).map(([c, v]) => `${LEDGER_LABELS[c].toLowerCase()} ${pct(-v / r.revenue)}`).join(', ')}.`);
  }
  out.push(`Ran ${r.fleet} vehicles at ${r.utilisation} shows per vehicle-year; ${r.shows} shows at ${pct(r.avgQuality)} average, ${r.failed} failed (${pct(r.failed / Math.max(1, r.shows + r.failed))}).`);
  // Why nights went wrong.
  const night = Object.entries(r.incidents.main).filter(([c]) => NIGHT.includes(c)).sort((a, b) => b[1] - a[1]);
  if (night.length) out.push(`Bad nights were mostly down to ${night.slice(0, 3).map(([c, n]) => `${label(c)} (${n})`).join(', ')}.`);
  const roots = ['overdue', 'unpaid-invoices', 'kit-failed', 'tired-crew', 'brand-fault'].filter(c => r.incidents.causes[c]);
  if (roots.length) out.push(`Root conditions in the incident log: ${roots.map(c => `${label(c)} ×${r.incidents.causes[c]}`).join(', ')}.`);
  // Cash stress.
  const cashIncidents = r.incidents.kinds.cash ?? 0;
  if (r.monthsOverdrawn || cashIncidents || r.forecastWarnings)
    out.push(`Cash: ${r.monthsOverdrawn} month${r.monthsOverdrawn === 1 ? '' : 's'} overdrawn, lowest balance ${k(r.lowestCash)}, ${cashIncidents} bill${cashIncidents === 1 ? '' : 's'} deferred, ${r.forecastWarnings} forecast warning${r.forecastWarnings === 1 ? '' : 's'}${r.bot.borrowed ? `, borrowed ${k(r.bot.borrowed)}` : ''}${r.bot.factoredMonths ? `, factored invoices ${r.bot.factoredMonths} months` : ''}.`);
  else out.push(`Cash never got tight (lowest ${k(r.lowestCash)}).`);
  // Clients.
  const cancels = r.incidents.causes['client-cancel'] ?? 0;
  const bare = r.incidents.causes['no-terms'] ?? 0;
  if (cancels || r.bot.termsAsked || r.bans)
    out.push(`Clients: ${cancels} cancellation${cancels === 1 ? '' : 's'} (${bare} with nothing to claim), ${r.bans} ban${r.bans === 1 ? '' : 's'}${r.bot.termsAsked ? `; asked for better terms ${r.bot.termsAsked} times, won ${r.bot.termsWon}` : ''}.`);
  // Crew.
  out.push(`Crew: ${r.crew} on the books, ${r.crewLost} lost along the way, burnout ${r.burnout}%, ${r.trusted} trusted pairs and ${r.feuds} feuds${r.bot.crewSplits ? `; split feuding crews ${r.bot.crewSplits} times` : ''}${r.bot.heads.length ? `; hired ${r.bot.heads.join(', ')}` : ''}.`);
  // Riders, rooms, kit.
  const rider = r.incidents.causes.rider ?? 0;
  const room = r.incidents.causes.room ?? 0;
  out.push(`Riders and rooms: ${r.bot.crossHires} cross-hires and ${r.bot.fixes} room fixes booked; ${rider} rider breach${rider === 1 ? '' : 'es'} and ${room} room problem${room === 1 ? '' : 's'} reached the stage.`);
  const breakdowns = r.incidents.kinds.breakdown ?? 0;
  const faults = r.incidents.causes['brand-fault'] ?? 0;
  if (breakdowns || faults) out.push(`Kit and fleet: ${breakdowns} breakdowns, ${faults} manufacturer fault${faults === 1 ? '' : 's'}.`);
  // Rivals, under the same rules.
  const dec = Object.entries(r.rivals.declined).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  out.push(`Rivals (same rules): ${r.rivals.alive} trading, ${r.rivals.gone} gone; ${r.rivals.shows} shows at ${pct(r.rivals.avgQuality)} average, ${r.rivals.failed} failed; ${r.rivals.crossHires} cross-hires and ${r.rivals.fixes} room fixes paid${dec.length ? `; turned work down for ${dec.map(([c, n]) => `${c} ×${n}`).join(', ')}` : ''}${r.rivals.cashNegative ? `; ${r.rivals.cashNegative} overdrawn` : ''}.`);
  if (r.bot.lessons.length) out.push(`Learned from its post-mortems: ${r.bot.lessons.join(', ')}.`);
  if (r.invariantViolations.length) out.push(`⚠️ ${r.invariantViolations.length} invariant violations, first: ${r.invariantViolations[0]}`);
  return out;
}

const median = (xs: number[]) => {
  const a = [...xs].sort((x, y) => x - y);
  return a.length ? (a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : 0;
};

export function renderReport(reports: BotReport[], strategies: Strategy[], meta: { years: number; runs: string }): string {
  const lines: string[] = [];
  lines.push('# Balance report');
  lines.push('');
  lines.push(`Generated by \`npm run balance:report\` — ${meta.runs}, ${meta.years} years each. Deterministic: the same code gives the same report.`);
  lines.push('');
  lines.push('## Strategies compared');
  lines.push('');
  lines.push('| Strategy | Survived | Median value | Margin | Avg quality | Failed | Overdrawn months | Crew lost | Cancellations | Bans |');
  lines.push('|---|---|---|---|---|---|---|---|---|---|');
  strategies.forEach(st => {
    const rs = reports.filter(r => r.strategy === st.id);
    if (!rs.length) return;
    const margin = median(rs.map(r => (r.revenue ? (r.revenue - r.costs) / r.revenue : 0)));
    lines.push(
      `| ${st.label} | ${rs.filter(r => r.survived).length}/${rs.length} | ${k(median(rs.map(r => r.value)))} | ${pct(margin)} | ${pct(median(rs.map(r => r.avgQuality)))} | ${pct(median(rs.map(r => r.failed / Math.max(1, r.shows + r.failed))))} | ${median(rs.map(r => r.monthsOverdrawn))} | ${median(rs.map(r => r.crewLost))} | ${median(rs.map(r => r.incidents.causes['client-cancel'] ?? 0))} | ${median(rs.map(r => r.bans))} |`,
    );
  });
  lines.push('');
  strategies.forEach(st => {
    const rs = reports.filter(r => r.strategy === st.id);
    if (!rs.length) return;
    lines.push(`## ${st.label}`);
    lines.push('');
    lines.push(st.blurb);
    lines.push('');
    rs.forEach(r => {
      lines.push(`### ${r.country} from ${r.startYear}, seed ${r.seed}`);
      lines.push('');
      explain(r).forEach(l => lines.push(`- ${l}`));
      lines.push('');
    });
  });
  const violations = reports.reduce((n, r) => n + r.invariantViolations.length, 0);
  lines.push('## Invariants');
  lines.push('');
  lines.push(violations ? `⚠️ ${violations} violations across the runs — see the JSON.` : 'No invariant violations in any run (money, equipment, vehicles, contracts, personnel checked monthly).');
  lines.push('');
  return lines.join('\n');
}
